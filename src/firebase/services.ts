import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { AssetRecord, Child, Asset, RecordReason, ReasonCategory } from '../types/models';

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
