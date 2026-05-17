import Foundation

class GeminiService {
    static let shared = GeminiService()
    
    // 定義 Gemini 的回傳結構
    struct GeminiResponse: Decodable {
        let candidates: [Candidate]
        struct Candidate: Decodable {
            let content: Content
        }
        struct Content: Decodable {
            let parts: [Part]
        }
        struct Part: Decodable {
            let text: String
        }
    }
    
    enum GeminiError: Error, LocalizedError {
        case emptyApiKey
        case invalidURL
        case networkError(Error)
        case invalidResponse
        case parsingError(String)
        
        var errorDescription: String? {
            switch self {
            case .emptyApiKey: return "尚未設定 Gemini API Key。請至「設定」輸入金鑰。"
            case .invalidURL: return "無效的 API 網址"
            case .networkError(let err): return "網路錯誤：\(err.localizedDescription)"
            case .invalidResponse: return "伺服器回傳錯誤"
            case .parsingError(let msg): return "解析失敗：\(msg)"
            }
        }
    }
    
    func parseVoiceInput(
        text: String,
        apiKey: String,
        childrenNames: [String],
        assetNames: [String],
        reasonNames: [String]
    ) async throws -> DraftRecord {
        guard !apiKey.isEmpty else {
            throw GeminiError.emptyApiKey
        }
        
        let urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            throw GeminiError.invalidURL
        }
        
        // 進階系統提示詞
        let prompt = """
        你是一個專業的兒童記帳 AI 助理。請解析以下使用者的語音輸入，並精準對應到系統現有的資料欄位中。
        使用者的口說內容："\(text)"
        
        【系統現有資料庫（請嚴格從以下項目中配對）】
        - 👨‍👩‍👧‍👦 小朋友名單：\(childrenNames)
        - 💰 資產帳戶：\(assetNames)
        - 📝 事由分類：\(reasonNames)
        
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
        請「絕對不要」包含任何解釋，也不要包含 ```json 的 Markdown 標籤。只回傳下方結構的標準 JSON：
        {
           "childName": "名",
           "reasonName": "事由",
           "assetName": "現金",
           "amount": 100,
           "recordType": 1,
           "parentComment": "完整的口說原始內容"
        }
        """
        
        let body: [String: Any] = [
            "contents": [
                [
                    "role": "user",
                    "parts": [
                        ["text": prompt]
                    ]
                ]
            ],
            "generationConfig": [
                "responseMimeType": "application/json" // 強制回傳 JSON
            ]
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpRes = response as? HTTPURLResponse else {
            throw GeminiError.invalidResponse
        }
        
        if httpRes.statusCode != 200 {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown"
            print("❌ Gemini API Error: \(errorText)")
            throw GeminiError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        do {
            let geminiResponse = try decoder.decode(GeminiResponse.self, from: data)
            guard let responseText = geminiResponse.candidates.first?.content.parts.first?.text,
                  let jsonData = responseText.data(using: .utf8) else {
                throw GeminiError.parsingError("回傳內容為空")
            }
            
            let draft = try decoder.decode(DraftRecord.self, from: jsonData)
            print("✅ 解析成功！結果：\(draft)")
            return draft
        } catch {
            print("❌ 解析失敗：\(error)")
            throw GeminiError.parsingError(error.localizedDescription)
        }
    }
}
