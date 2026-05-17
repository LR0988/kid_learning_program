import SwiftUI
import SwiftData

struct VoiceInputView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    
    @Query(sort: \Child.name) var children: [Child]
    @Query(sort: \Asset.name) var assets: [Asset]
    @Query(sort: \RecordReason.usageCount, order: .reverse) var reasons: [RecordReason]
    
    @AppStorage("geminiApiKey") private var geminiApiKey = ""
    
    @State private var voiceManager = VoiceManager()
    @State private var isProcessing = false
    @State private var processingError: String?
    
    // Callback 讓我們可以把解析完的草稿傳遞給外層的 HistoryView 再去開啟 AddRecordView
    var onParsedResult: (DraftRecord) -> Void
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 30) {
                Spacer()
                
                // 即時語音轉文字顯示區塊
                ScrollView {
                    Text(voiceManager.transcribedText.isEmpty ? "請點擊麥克風並說出內容..." : voiceManager.transcribedText)
                        .font(.title2)
                        .foregroundColor(voiceManager.transcribedText.isEmpty ? .secondary : .primary)
                        .multilineTextAlignment(.center)
                        .padding()
                }
                .frame(maxHeight: 200)
                
                // 麥克風錄製按鈕
                Button(action: toggleRecording) {
                    ZStack {
                        // 波形動畫效果的背景圈圈
                        Circle()
                            .fill(voiceManager.isRecording ? Color.red.opacity(0.8) : Color.blue)
                            .frame(width: 100, height: 100)
                            .scaleEffect(voiceManager.isRecording ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: voiceManager.isRecording)
                        
                        Image(systemName: voiceManager.isRecording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.white)
                    }
                }
                .disabled(isProcessing)
                
                // 錯誤訊息提示區
                if let error = voiceManager.errorMessage {
                    Text(error).foregroundColor(.red).font(.caption).padding(.horizontal)
                }
                
                if let error = processingError {
                    Text(error).foregroundColor(.red).font(.caption).padding(.horizontal)
                }
                
                Spacer()
                
                // 底部的送出解析按鈕
                if isProcessing {
                    ProgressView("呼叫 Gemini AI 解析中...")
                        .padding()
                } else {
                    Button("送出解析") {
                        processWithGemini()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(voiceManager.transcribedText.isEmpty || voiceManager.isRecording)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle("語音智慧記事")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .onAppear(perform: checkPermissions)
        }
    }
    
    private func checkPermissions() {
        voiceManager.requestPermissions { granted in
            if !granted {
                voiceManager.errorMessage = "需要麥克風與語音辨識權限才能使用。如果無法彈出權限視窗，請嘗試去 Playgrounds 左上角的設定中手動開啟能力 (Capabilities)。"
            }
        }
    }
    
    private func toggleRecording() {
        if voiceManager.isRecording {
            voiceManager.stopRecording()
        } else {
            // 清除之前的錯誤
            processingError = nil
            voiceManager.startRecording()
        }
    }
    
    private func processWithGemini() {
        guard !voiceManager.transcribedText.isEmpty else { return }
        isProcessing = true
        processingError = nil
        
        // 準備傳送給 Gemini 的上下文選項
        let text = voiceManager.transcribedText
        let childrenNames = children.map { $0.name }
        let assetNames = assets.map { $0.name }
        let reasonNames = reasons.map { "\($0.name) (分類:\($0.category?.name ?? "無"))" }
        
        Task {
            do {
                let draft = try await GeminiService.shared.parseVoiceInput(
                    text: text,
                    apiKey: geminiApiKey,
                    childrenNames: childrenNames,
                    assetNames: assetNames,
                    reasonNames: reasonNames
                )
                
                // 解析成功，回主執行緒關閉對話框，並用 callback 回傳草稿資料
                await MainActor.run {
                    isProcessing = false
                    dismiss()
                    
                    // 延遲一點點讓畫面完整 dismiss 再跳出下一個 sheet
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        onParsedResult(draft)
                    }
                }
            } catch {
                await MainActor.run {
                    isProcessing = false
                    processingError = error.localizedDescription
                }
            }
        }
    }
}
