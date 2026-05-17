import SwiftUI
import SwiftData
import PhotosUI

struct AddRecordView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    
    // 如果傳入此紀錄，則為編輯模式
    var recordToEdit: AssetRecord?
    // 預設選擇的小朋友
    var initialChild: Child?
    // 從語音分析得來的初稿
    var prefilledDraft: DraftRecord?
    
    @Query(sort: \Child.name) var children: [Child]
    @Query(sort: \RecordReason.usageCount, order: .reverse) var reasons: [RecordReason]
    @Query(sort: \Asset.name) var assets: [Asset]
    
    @State private var selectedChild: Child?
    @State private var selectedReason: RecordReason?
    @State private var selectedAsset: Asset?
    @State private var amountString: String = ""
    @State private var recordType: Int = 1 
    
    @State private var moodRating = 3
    @State private var comment = ""
    @State private var recordDate = Date()
    @State private var reasonSearchText = ""
    @State private var imageData: Data?
    @State private var showCamera = false
    @State private var selectedItem: PhotosPickerItem?
    
    var filteredReasons: [RecordReason] {
        if reasonSearchText.isEmpty {
            return Array(reasons.prefix(20))
        } else {
            return reasons.filter { $0.name.contains(reasonSearchText) || ($0.category?.name.contains(reasonSearchText) ?? false) }
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                if children.isEmpty || assets.isEmpty || reasons.isEmpty {
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("⚠️ 缺少必要資訊")
                                .font(.headline)
                                .foregroundColor(.red)
                            Text("您必須先前往「系統設定」建立以下項目才能新增紀錄：")
                                .font(.subheadline)
                            if children.isEmpty { Text("• 小朋友").font(.caption).foregroundColor(.secondary) }
                            if assets.isEmpty { Text("• 資產項目").font(.caption).foregroundColor(.secondary) }
                            if reasons.isEmpty { Text("• 事由分類與事由").font(.caption).foregroundColor(.secondary) }
                        }
                        .padding(.vertical, 8)
                    }
                }
                
                Section("對象與日期") {
                    DatePicker("日期", selection: $recordDate, displayedComponents: .date)
                    Picker("小朋友", selection: $selectedChild) {
                        Text("請選擇").tag(nil as Child?)
                        ForEach(children) { child in Text(child.name).tag(child as Child?) }
                    }
                }
                
                Section("紀錄事由") {
                    TextField("搜尋事由...", text: $reasonSearchText).textFieldStyle(.roundedBorder)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(filteredReasons) { reason in
                                VStack {
                                    Text(reason.icon).font(.title2)
                                    Text(reason.name).font(.caption2).lineLimit(1)
                                }
                                .padding(8)
                                .background(selectedReason == reason ? Color.blue.opacity(0.2) : Color.gray.opacity(0.1))
                                .cornerRadius(8)
                                .onTapGesture { selectedReason = reason }
                            }
                        }
                    }
                }
                
                Section("資產變動") {
                    Picker("變動類型", selection: $recordType) {
                        Text("獎勵(+)").tag(1)
                        Text("扣除(-)").tag(-1)
                    }.pickerStyle(.segmented)
                    
                    Picker("資產", selection: $selectedAsset) {
                        Text("請選擇").tag(nil as Asset?)
                        ForEach(assets) { asset in Text(asset.name).tag(asset as Asset?) }
                    }
                    
                    HStack {
                        Text("數量")
                        Spacer()
                        TextField("0.0", text: $amountString).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                        if let unit = selectedAsset?.unit { Text(unit) }
                    }
                }
                
                Section("內容與照片") {
                    ZStack(alignment: .topLeading) {
                        if comment.isEmpty {
                            Text("請輸入細節...")
                                .foregroundColor(Color(UIColor.placeholderText))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 8)
                        }
                        TextEditor(text: $comment)
                            .frame(minHeight: 100)
                    }
                    
                    HStack {
                        Text("滿意度")
                        Spacer()
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= moodRating ? "star.fill" : "star")
                                .foregroundColor(.yellow)
                                .onTapGesture { moodRating = star }
                        }
                    }
                    if let imageData, let uiImage = UIImage(data: imageData) {
                        Image(uiImage: uiImage).resizable().scaledToFit().frame(maxHeight: 150).cornerRadius(8)
                    }
                    HStack {
                        Button { showCamera = true } label: { Label("拍攝", systemImage: "camera") }
                        Spacer()
                        PhotosPicker(selection: $selectedItem, matching: .images) { Label("相簿", systemImage: "photo") }
                    }
                }
            }
            .navigationTitle(recordToEdit == nil ? "新增紀錄" : "編輯紀錄")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("儲存") { saveRecord() }.disabled(selectedChild == nil || selectedAsset == nil || selectedReason == nil)
                }
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            }
            .onAppear(perform: setupFields)
            .sheet(isPresented: $showCamera) { ImagePicker(imageData: $imageData) }
            .onChange(of: selectedItem) { _, newItem in
                Task { if let data = try? await newItem?.loadTransferable(type: Data.self) { await MainActor.run { imageData = data } } }
            }
        }
    }
    
    private func setupFields() {
        if let record = recordToEdit {
            selectedChild = record.child
            selectedReason = record.reason
            selectedAsset = record.asset
            
            // 格式化金額：如果是整數則不顯示小數點
            let absAmount = abs(record.amount)
            if absAmount == floor(absAmount) {
                amountString = String(format: "%.0f", absAmount)
            } else {
                amountString = String(format: "%.2f", absAmount)
            }
            
            recordType = record.amount >= 0 ? 1 : -1
            moodRating = record.moodRating
            comment = record.parentComment
            recordDate = record.date
            imageData = record.imageData
        } else if let draft = prefilledDraft {
            // 從 Gemini 草稿自動配對對應的模型
            if let childName = draft.childName {
                selectedChild = children.first { $0.name == childName }
            }
            if let assetName = draft.assetName {
                selectedAsset = assets.first { $0.name == assetName }
            }
            if let reasonName = draft.reasonName {
                // Gemini 可能回傳包含分類名稱的格式，這裡嘗試做包含配對
                selectedReason = reasons.first { reasonName.contains($0.name) || $0.name.contains(reasonName) }
            }
            if let amount = draft.amount {
                let absAmount = abs(amount)
                if absAmount == floor(absAmount) {
                    amountString = String(format: "%.0f", absAmount)
                } else {
                    amountString = String(format: "%.2f", absAmount)
                }
            }
            if let type = draft.recordType {
                recordType = type
            }
            if let parentComment = draft.parentComment {
                comment = parentComment
            }
        } else if let initialChild = initialChild {
            selectedChild = initialChild
        }
    }
    
    private func saveRecord() {
        let finalAmount = (Double(amountString) ?? 0) * Double(recordType)
        
        if let record = recordToEdit {
            record.date = recordDate
            record.moodRating = moodRating
            record.parentComment = comment
            record.imageData = imageData
            record.child = selectedChild
            record.reason = selectedReason
            record.asset = selectedAsset
            record.amount = finalAmount
            
            // Sync to Firebase (Update)
            FirestoreManager.shared.saveAssetRecord(record)
        } else {
            let newRecord = AssetRecord(date: recordDate, moodRating: moodRating, parentComment: comment, imageData: imageData, amount: finalAmount)
            newRecord.child = selectedChild
            newRecord.reason = selectedReason
            newRecord.asset = selectedAsset
            selectedReason?.usageCount += 1
            if let reason = selectedReason {
                FirestoreManager.shared.saveReason(reason)
            }
            modelContext.insert(newRecord)
            
            // Sync to Firebase
            FirestoreManager.shared.saveAssetRecord(newRecord)
        }
        dismiss()
    }
}
