import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { AssetRecord, Child, Asset, RecordReason, ReasonCategory, RecurringRule } from '../types/models';

// ==========================================
// Records
// ==========================================
export const saveAssetRecord = async (record: AssetRecord) => {
  const isNew = !record.firebaseID;
  const docRef = isNew ? doc(collection(db, 'records')) : doc(db, 'records', record.firebaseID);
  
  if (isNew) {
    record.firebaseID = docRef.id;
  }
  
  await setDoc(docRef, {
    firebaseID: record.firebaseID,
    date: record.date instanceof Date ? Timestamp.fromDate(record.date) : record.date,
    amount: record.amount,
    moodRating: record.moodRating,
    parentComment: record.parentComment,
    childName: record.childName || "Unknown",
    reasonName: record.reasonName || "Unknown",
    assetName: record.assetName || "Unknown",
    timestamp: serverTimestamp()
  });
  return record.firebaseID;
};

export const deleteRecord = async (firebaseID: string) => {
  if (!firebaseID) return;
  await deleteDoc(doc(db, 'records', firebaseID));
};

export const fetchRecords = async (): Promise<AssetRecord[]> => {
  const q = query(collection(db, 'records'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      date: data.date?.toDate() || new Date()
    } as AssetRecord;
  });
};

// ==========================================
// Children
// ==========================================
export const saveChild = async (child: Child) => {
  await setDoc(doc(db, 'children', child.name), {
    id: child.id,
    name: child.name,
    updatedAt: serverTimestamp()
  });
};

export const deleteChild = async (name: string) => {
  await deleteDoc(doc(db, 'children', name));
};

export const fetchChildren = async (): Promise<Child[]> => {
  const snapshot = await getDocs(collection(db, 'children'));
  return snapshot.docs.map(doc => doc.data() as Child);
};

// ==========================================
// Assets
// ==========================================
export const saveAsset = async (asset: Asset) => {
  await setDoc(doc(db, 'assets', asset.name), {
    ...asset,
    updatedAt: serverTimestamp()
  });
};

export const deleteAsset = async (name: string) => {
  await deleteDoc(doc(db, 'assets', name));
};

export const fetchAssets = async (): Promise<Asset[]> => {
  const snapshot = await getDocs(collection(db, 'assets'));
  return snapshot.docs.map(doc => doc.data() as Asset);
};

// ==========================================
// Reasons & Categories
// ==========================================
export const fetchReasons = async (): Promise<RecordReason[]> => {
  const snapshot = await getDocs(collection(db, 'reasons'));
  return snapshot.docs.map(doc => doc.data() as RecordReason);
};

export const fetchCategories = async (): Promise<ReasonCategory[]> => {
  const snapshot = await getDocs(collection(db, 'categories'));
  return snapshot.docs.map(doc => doc.data() as ReasonCategory);
};

export const saveCategory = async (category: ReasonCategory) => {
  await setDoc(doc(db, 'categories', category.name), {
    id: category.id,
    name: category.name,
    icon: category.icon,
    updatedAt: serverTimestamp()
  });
};

// ==========================================
// 週期性分派規則 (Recurring Rules)
// ==========================================
export const saveRecurringRule = async (rule: RecurringRule) => {
  const isNew = !rule.id;
  const docRef = isNew ? doc(collection(db, 'recurring_rules')) : doc(db, 'recurring_rules', rule.id);
  if (isNew) {
    rule.id = docRef.id;
  }
  await setDoc(docRef, {
    ...rule,
    updatedAt: serverTimestamp()
  });
  return rule.id;
};

export const deleteRecurringRule = async (id: string) => {
  if (!id) return;
  await deleteDoc(doc(db, 'recurring_rules', id));
};

export const fetchRecurringRules = async (): Promise<RecurringRule[]> => {
  const snapshot = await getDocs(collection(db, 'recurring_rules'));
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id
  } as RecurringRule));
};

/**
 * 檢查並執行所有符合條件的週期性分派規則
 * @param forceRun 若為 true，則忽略今日是否已發放，強制發放一次
 */
export const checkAndExecuteRecurringRules = async (forceRun: boolean = false): Promise<{ executedCount: number; titles: string[] }> => {
  const rules = await fetchRecurringRules();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentDayOfWeek = now.getDay(); // 0-6 (0 is Sunday)
  const currentDayOfMonth = now.getDate(); // 1-31
  const currentYearMonth = todayStr.substring(0, 7); // YYYY-MM

  let executedCount = 0;
  const titles: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.childNames || rule.childNames.length === 0) continue;

    let isDue = false;

    if (forceRun) {
      isDue = true;
    } else {
      // 避免同一天重複發放
      if (rule.lastExecutedDate === todayStr) continue;

      if (rule.frequency === 'daily') {
        isDue = true;
      } else if (rule.frequency === 'weekly') {
        const targetDay = rule.dayOfWeek ?? 0;
        if (currentDayOfWeek === targetDay) {
          isDue = true;
        }
      } else if (rule.frequency === 'monthly') {
        const targetDate = rule.dayOfMonth ?? 1;
        // 如果這個月還沒發過且到了指定日
        const lastExecutedYearMonth = rule.lastExecutedDate ? rule.lastExecutedDate.substring(0, 7) : '';
        if (currentDayOfMonth >= targetDate && lastExecutedYearMonth !== currentYearMonth) {
          isDue = true;
        }
      }
    }

    if (isDue) {
      const netAmount = (Math.abs(rule.amount) || 0) * (rule.recordType || 1);
      
      // 為每位指定的小朋友建立分派紀錄
      for (const childName of rule.childNames) {
        const record: AssetRecord = {
          firebaseID: '',
          date: new Date(),
          moodRating: 5,
          parentComment: rule.comment ? `[定期分派] ${rule.comment}` : `[定期分派] ${rule.title}`,
          amount: netAmount,
          childName: childName,
          reasonName: rule.reasonName || '零用錢',
          assetName: rule.assetName || '現金'
        };
        await saveAssetRecord(record);
      }

      // 更新上次執行日期
      rule.lastExecutedDate = todayStr;
      await saveRecurringRule(rule);

      executedCount += rule.childNames.length;
      titles.push(rule.title);
    }
  }

  return { executedCount, titles };
};
