export interface Child {
  id: string; // Used locally for unique identification
  name: string;
}

export interface ReasonCategory {
  id: string;
  name: string;
  icon: string;
}

export interface RecordReason {
  id: string;
  name: string;
  icon: string;
  usageCount: number;
  categoryName?: string;
}

export interface Asset {
  id: string;
  name: string;
  unit: string;
  isStock: boolean;
  symbol: string;
  lastPrice: number;
  lastUpdated: Date;
}

export interface AssetRecord {
  firebaseID: string;
  date: Date;
  moodRating: number;
  parentComment: string;
  imageData?: string; // base64 or URL
  amount: number;
  childName: string;
  reasonName: string;
  assetName: string;
}

// 週期性分派規則 (Recurring Distribution Rule)
export interface RecurringRule {
  id: string;
  title: string; // 規則名稱，例如「每週日零用錢」
  amount: number; // 分派金額 (絕對值)
  recordType: number; // 1: 獎勵/發放 (+), -1: 扣除 (-)
  assetName: string; // 資產類別，例如「現金」
  reasonName: string; // 紀錄事由，例如「零用錢」
  childNames: string[]; // 分派對象名單 (支援複選)
  frequency: 'daily' | 'weekly' | 'monthly'; // 頻率：每天 / 每週 / 每月
  dayOfWeek?: number; // 0=週日, 1=週一, 2=週二, 3=週三, 4=週四, 5=週五, 6=週六
  dayOfMonth?: number; // 每月幾號 (1~31)
  lastExecutedDate?: string; // 上次發放日期 (YYYY-MM-DD)
  enabled: boolean; // 開關
  comment?: string; // 備註
}

// For Gemini Parsing
export interface DraftRecord {
  childName: string | null;
  reasonName: string | null;
  assetName: string | null;
  amount: number | null;
  recordType: number | null; // 1 = add, -1 = subtract
  parentComment: string;
}
