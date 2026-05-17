import SwiftUI
import SwiftData

struct HistoryView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \AssetRecord.date, order: .reverse) var allRecords: [AssetRecord]
    @Query(sort: \Child.name) var children: [Child]
    
    @State private var isShowingAddSheet = false
    @State private var selectedChildID: PersistentIdentifier?
    @State private var recordToEdit: AssetRecord?
    
    // 語音智慧記帳用狀態
    @State private var isShowingVoiceInput = false
    @State private var draftRecord: DraftRecord?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(UIColor.systemGroupedBackground).ignoresSafeArea()
                
                VStack(spacing: 0) {
                    if !children.isEmpty { 
                        filterBar 
                            .padding(.vertical, 8)
                            .background(Color(UIColor.systemBackground))
                    }
                    
                    if filteredRecords.isEmpty {
                        ContentUnavailableView(
                            "尚無紀錄",
                            systemImage: "tray.fill",
                            description: Text("點擊右上角「+」開始新增第一筆紀錄！")
                        )
                    } else {
                        recordsList
                    }
                }
            }
            .navigationTitle("資產紀錄表")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        Button { 
                            isShowingVoiceInput = true 
                        } label: {
                            Image(systemName: "mic.circle.fill")
                                .font(.title3)
                                .foregroundColor(.purple)
                        }
                        
                        Button { 
                            draftRecord = nil
                            isShowingAddSheet = true 
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundColor(.blue)
                        }
                    }
                }
            }
            .sheet(isPresented: $isShowingAddSheet) { 
                if let draft = draftRecord {
                    AddRecordView(prefilledDraft: draft)
                } else {
                    let preSelectedChild = children.first { $0.id == selectedChildID }
                    AddRecordView(initialChild: preSelectedChild) 
                }
            }
            .sheet(isPresented: $isShowingVoiceInput) {
                VoiceInputView { parsedDraft in
                    // 接收 Gemini 解析完畢的草稿，接著開啟新增畫面進行確認
                    self.draftRecord = parsedDraft
                    self.isShowingAddSheet = true
                }
            }
            .onChange(of: isShowingAddSheet) { _, isShowing in
                // 若確認畫面關閉，就把草稿清空，避免下次點擊普通新增時帶入舊資料
                if !isShowing {
                    self.draftRecord = nil
                }
            }
            .sheet(item: $recordToEdit) { record in AddRecordView(recordToEdit: record) }
            .task {
                await DataSyncManager.shared.syncFromCloud(context: modelContext)
            }
            .refreshable {
                await DataSyncManager.shared.syncFromCloud(context: modelContext)
            }
        }
    }
    
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FilterButton(title: "全部", isSelected: selectedChildID == nil) { selectedChildID = nil }
                ForEach(children) { child in
                    FilterButton(title: child.name, isSelected: selectedChildID == child.id) { selectedChildID = child.id }
                }
            }.padding(.horizontal)
        }
    }
    
    private var recordsList: some View {
        List {
            ForEach(groupedDateKeys, id: \.self) { date in
                Section {
                    let records = groupedRecords[date] ?? []
                    ForEach(records) { record in
                        NavigationLink(destination: RecordDetailView(record: record)) {
                            AssetRecordRow(record: record)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) { 
                                withAnimation { 
                                    FirestoreManager.shared.deleteRecord(record.firebaseID)
                                    modelContext.delete(record) 
                                }
                            } label: { 
                                Label("刪除", systemImage: "trash") 
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button { recordToEdit = record } label: { 
                                Label("編輯", systemImage: "pencil") 
                            }.tint(.orange)
                        }
                    }
                } header: {
                    Text(date, style: .date)
                        .font(.headline)
                        .foregroundColor(.secondary)
                        .padding(.bottom, 4)
                }
            }
        }
        .listStyle(.insetGrouped) // 更現代化的卡片式列表
    }
    
    private var filteredRecords: [AssetRecord] {
        if let selectedChildID { return allRecords.filter { $0.child?.id == selectedChildID } }
        return allRecords
    }
    private var groupedRecords: [Date: [AssetRecord]] { Dictionary(grouping: filteredRecords) { Calendar.current.startOfDay(for: $0.date) } }
    private var groupedDateKeys: [Date] { groupedRecords.keys.sorted(by: >) }
}

// 修復遺失的 FilterButton 並且美化它
struct FilterButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .fontWeight(isSelected ? .bold : .regular)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.15))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
                .shadow(color: isSelected ? Color.blue.opacity(0.3) : Color.clear, radius: 4, y: 2)
        }
    }
}

// 重新設計的紀錄列表行 (Row)
struct AssetRecordRow: View {
    let record: AssetRecord
    var body: some View {
        HStack(spacing: 16) {
            // 左側圖示區（圓形背景 + Emoji）
            ZStack {
                Circle()
                    .fill(record.amount >= 0 ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
                    .frame(width: 50, height: 50)
                Text(record.reason?.icon ?? "📝")
                    .font(.title2)
            }
            
            // 中間資訊區
            VStack(alignment: .leading, spacing: 6) {
                Text(record.child?.name ?? "未知")
                    .font(.headline)
                Text(record.reason?.name ?? "無事由")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // 右側金額區
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(record.amount >= 0 ? "+" : "")\(formattedAmount)")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(record.amount >= 0 ? .green : .red)
                Text(record.asset?.name ?? "")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var formattedAmount: String {
        let absAmount = abs(record.amount)
        if absAmount == floor(absAmount) {
            return String(format: "%.0f", absAmount)
        } else {
            return String(format: "%.2f", absAmount)
        }
    }
}

// 徹底翻新的紀錄詳情頁面 (Detail View)
struct RecordDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    let record: AssetRecord
    @State private var isEditing = false
    @State private var showingDeleteAlert = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // 頂部滿版圖片
                if let imageData = record.imageData, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 250)
                        .clipped()
                        .cornerRadius(16)
                        .shadow(radius: 5)
                        .padding(.horizontal)
                }
                
                // 主要資訊卡片
                VStack(spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(record.child?.name ?? "未知")
                                .font(.title)
                                .fontWeight(.bold)
                            Text(record.date.formatted(date: .long, time: .shortened))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        ZStack {
                            Circle()
                                .fill(Color.gray.opacity(0.1))
                                .frame(width: 60, height: 60)
                            Text(record.reason?.icon ?? "📝")
                                .font(.largeTitle)
                        }
                    }
                    
                    Divider()
                    
                    HStack {
                        Label(record.reason?.name ?? "無事由", systemImage: "tag.fill")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("變動金額")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            let formattedDetailAmount = record.amount == floor(record.amount) ? String(format: "%.0f", record.amount) : String(format: "%.2f", record.amount)
                            Text("\(record.amount >= 0 ? "+" : "")\(formattedDetailAmount) \(record.asset?.unit ?? "")")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(record.amount >= 0 ? .green : .red)
                        }
                    }
                }
                .padding()
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.05), radius: 8, y: 2)
                .padding(.horizontal)
                
                // 備註卡片
                if !record.parentComment.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("備註內容", systemImage: "text.quote")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text(record.parentComment)
                            .font(.body)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding()
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .cornerRadius(16)
                    .shadow(color: Color.black.opacity(0.05), radius: 8, y: 2)
                    .padding(.horizontal)
                }
                
                // 大型操作按鈕區
                VStack(spacing: 12) {
                    Button { isEditing = true } label: {
                        Label("編輯紀錄", systemImage: "pencil")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    
                    Button { showingDeleteAlert = true } label: {
                        Label("刪除此紀錄", systemImage: "trash")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .foregroundColor(.red)
                            .cornerRadius(12)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
            .padding(.vertical)
        }
        .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("紀錄詳情")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isEditing) { AddRecordView(recordToEdit: record) }
        .alert("確定要刪除嗎？", isPresented: $showingDeleteAlert) {
            Button("確定刪除", role: .destructive) { 
                FirestoreManager.shared.deleteRecord(record.firebaseID)
                modelContext.delete(record)
                dismiss() 
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("刪除後將無法復原。")
        }
    }
}
