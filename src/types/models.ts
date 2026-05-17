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

// For Gemini Parsing
export interface DraftRecord {
  childName: string | null;
  reasonName: string | null;
  assetName: string | null;
  amount: number | null;
  recordType: number | null; // 1 = add, -1 = subtract
  parentComment: string;
}
