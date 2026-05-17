import { DraftRecord } from '../types/models';

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

export const parseVoiceInput = async (
  text: string,
  apiKey: string,
  childrenNames: string[],
  assetNames: string[],
  reasonNames: string[]
): Promise<DraftRecord> => {

  if (!apiKey) {
    throw new GeminiError("API Key is missing. Please set it in Settings.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
  你是一個專業的兒童記帳 AI 助理。請解析以下使用者的語音輸入，並精準對應到系統現有的資料欄位中。
  使用者的口說內容："${text}"
  
  【系統現有資料庫（請嚴格從以下項目中配對）】
  - 👨‍👩‍👧‍👦 小朋友名單：${JSON.stringify(childrenNames)}
  - 💰 資產帳戶：${JSON.stringify(assetNames)}
  - 📝 事由分類：${JSON.stringify(reasonNames)}
  
  【判斷與擷取規則】
  1. childName：從「小朋友名單」中精準找出被提到的人物。若無符合填 null。
  2. assetName：從「資產帳戶」中尋找對應的資產（如現金、點數、銀行等）。若無明確提到填 null。
  3. reasonName：分析語意並推論出最適合的「事由分類」名稱，包含相似詞的語意推測（例如說「洗碗」可以對應「做家事」）。
  4. amount：抽取出純數字的金額（請填絕對值大於 0 的數字，不帶正負號）。
  5. recordType（資金流向，這非常重要）：
     - 【值為 1 (資產增加)】：存現金、發放零用錢、給予零用錢、賺取點數、獎勵、獲得報酬等「讓小朋友的資產水位上升」的動作。
     - 【值為 -1 (資產減少)】：扣款、發現金 (將點數/虛擬餘額兌換成實體現金發出)、買東西、花費、懲罰等「讓小朋友在 App 內的虛擬資產水位下降」的動作。
  6. parentComment：直接將使用者剛剛的口說完整原始字串作為備註填入。
  
  【輸出格式要求】
  請「絕對不要」包含任何解釋，也不要包含 \`\`\`json 的 Markdown 標籤。只回傳下方結構的標準 JSON：
  {
     "childName": "名",
     "reasonName": "事由",
     "assetName": "現金",
     "amount": 100,
     "recordType": 1,
     "parentComment": "完整的口說原始內容"
  }
  `;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiError(`Gemini API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new GeminiError("Empty response from Gemini.");
    }

    const draft: DraftRecord = JSON.parse(responseText);
    return draft;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new GeminiError(error.message || "Unknown error occurred during parsing.");
    }
    throw new GeminiError("Unknown error occurred during parsing.");
  }
};
