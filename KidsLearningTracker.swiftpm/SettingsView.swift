import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Child.name) var children: [Child]
    @Query(sort: \ReasonCategory.name) var categories: [ReasonCategory]
    @Query(sort: \Asset.name) var assets: [Asset]
    
    @State private var newChildName = ""
    @State private var newCategoryName = ""
    @State private var selectedCategoryEmoji = "📁"
    @State private var newAssetName = ""
    @State private var newAssetUnit = ""
    @State private var isStock = false
    
    @AppStorage("geminiApiKey") private var geminiApiKey = ""
    
    let emojis = ["📁", "📚", "🏠", "🎨", "🏃", "🎮", "🌟", "🍎", "🧸", "💰"]
    
    var body: some View {
        NavigationStack {
            List {
                Section("AI 助理設定") {
                    SecureField("輸入您的 Gemini API Key", text: $geminiApiKey)
                    Text("用於語音自動記帳功能。請至 Google AI Studio 免費申請。")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section("小朋友管理") {
                    HStack {
                        TextField("名字", text: $newChildName)
                        Button(action: addChild) { Image(systemName: "plus.circle.fill") }
                            .buttonStyle(.borderless)
                    }
                    ForEach(children) { child in Text(child.name) }.onDelete(perform: deleteChild)
                }
                
                Section("事由分類管理") {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            TextField("分類名稱", text: $newCategoryName)
                            Button(action: addCategory) { Image(systemName: "plus.circle.fill") }
                                .buttonStyle(.borderless)
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(emojis, id: \.self) { emoji in
                                    Text(emoji).font(.title2).padding(8)
                                        .background(selectedCategoryEmoji == emoji ? Color.blue.opacity(0.1) : Color.clear)
                                        .cornerRadius(8).onTapGesture { selectedCategoryEmoji = emoji }
                                }
                            }
                        }
                    }
                    ForEach(categories) { category in
                        NavigationLink { CategoryDetailView(category: category) } label: {
                            Text("\(category.icon) \(category.name)")
                        }
                    }.onDelete(perform: deleteCategory)
                }
                
                Section("資產項目設定") {
                    VStack(spacing: 12) {
                        HStack {
                            TextField("資產名稱", text: $newAssetName)
                            TextField("單位", text: $newAssetUnit).frame(width: 50)
                        }
                        Toggle("股票/外幣 (需更新市價)", isOn: $isStock)
                        Button("新增資產項目") { addAsset() }.buttonStyle(.borderedProminent).disabled(newAssetName.isEmpty)
                    }
                    
                    ForEach(assets) { asset in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(asset.name).font(.headline)
                                Spacer()
                                Toggle("股票模式", isOn: Binding(get: { asset.isStock }, set: { asset.isStock = $0 }))
                                    .labelsHidden()
                                    .onChange(of: asset.isStock) { _, _ in FirestoreManager.shared.saveAsset(asset) }
                            }
                            if asset.isStock {
                                HStack {
                                    Text("代號(可選):").font(.caption)
                                    TextField("例如 2330", text: Binding(get: { asset.symbol }, set: { asset.symbol = $0 }))
                                        .textFieldStyle(.roundedBorder)
                                        .onChange(of: asset.symbol) { _, _ in FirestoreManager.shared.saveAsset(asset) }
                                }
                            }
                            HStack {
                                TextField("單位", text: Binding(get: { asset.unit }, set: { asset.unit = $0 }))
                                    .textFieldStyle(.roundedBorder).frame(width: 60)
                                    .onChange(of: asset.unit) { _, _ in FirestoreManager.shared.saveAsset(asset) }
                                Spacer()
                                Text(asset.isStock ? "市價(NTD):" : "匯率:")
                                TextField("價格", value: Binding(get: { asset.lastPrice }, set: { asset.lastPrice = $0 }), format: .number)
                                    .textFieldStyle(.roundedBorder).keyboardType(.decimalPad).frame(width: 100)
                                    .onChange(of: asset.lastPrice) { _, _ in FirestoreManager.shared.saveAsset(asset) }
                            }
                        }.padding(.vertical, 4)
                    }.onDelete(perform: deleteAsset)
                }
            }
            .navigationTitle("系統設定")
            .toolbar { EditButton() }
        }
    }
    
    private func addChild() { 
        if !newChildName.isEmpty { 
            let child = Child(name: newChildName)
            modelContext.insert(child)
            FirestoreManager.shared.saveChild(child)
            newChildName = "" 
        } 
    }
    
        private func addCategory() { 
            if !newCategoryName.isEmpty { 
                let category = ReasonCategory(name: newCategoryName, icon: selectedCategoryEmoji)
                modelContext.insert(category)
                FirestoreManager.shared.saveCategory(category)
                newCategoryName = ""; selectedCategoryEmoji = "📁" 
            } 
        }
        
        private func addAsset() { 
            if !newAssetName.isEmpty { 
                let asset = Asset(name: newAssetName, unit: newAssetUnit, isStock: isStock)
                modelContext.insert(asset)
                FirestoreManager.shared.saveAsset(asset)
                newAssetName = ""; newAssetUnit = ""; isStock = false 
            } 
        }
        
        private func deleteChild(at offsets: IndexSet) { 
            offsets.forEach { index in
                let child = children[index]
                FirestoreManager.shared.deleteChild(child.name)
                modelContext.delete(child)
            }
        }
        
        private func deleteCategory(at offsets: IndexSet) { 
            offsets.forEach { index in
                let category = categories[index]
                // Delete all sub-reasons from Firestore first
                for reason in category.reasons {
                    FirestoreManager.shared.deleteReason(reason.name)
                }
                FirestoreManager.shared.deleteCategory(category.name)
                modelContext.delete(category)
            }
        }
    
    private func deleteAsset(at offsets: IndexSet) { 
        offsets.forEach { index in
            let asset = assets[index]
            FirestoreManager.shared.deleteAsset(asset.name)
            modelContext.delete(asset)
        }
    }
}

struct CategoryDetailView: View {
    @Environment(\.modelContext) private var modelContext
    let category: ReasonCategory
    @State private var newReasonName = ""
    @State private var selectedEmoji = "📝"
    
    @State private var editingName: String = ""
    @State private var oldName: String = ""

    let emojis = ["📝", "📚", "🧹", "🍱", "🏃", "🎨", "🎸", "🌟", "💰", "❤️", "✅", "❌"]
    
    var body: some View {
        List {
            Section("事由分類名稱與圖示") {
                TextField("分類名稱", text: $editingName, onCommit: {
                    syncCategoryRename()
                })
                .font(.headline)
                
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(["📁", "📚", "🏠", "🎨", "🏃", "🎮", "🌟", "🍎", "🧸", "💰"], id: \.self) { emoji in
                            Text(emoji).font(.title).padding(8)
                                .background(category.icon == emoji ? Color.blue.opacity(0.1) : Color.clear)
                                .cornerRadius(8).onTapGesture { 
                                    category.icon = emoji 
                                    FirestoreManager.shared.saveCategory(category)
                                }
                        }
                    }
                }
            }
            Section("新增事由") {
                VStack(spacing: 12) {
                    TextField("事由名稱", text: $newReasonName).textFieldStyle(.roundedBorder)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(emojis, id: \.self) { emoji in
                                Text(emoji).font(.title).padding(8)
                                    .background(selectedEmoji == emoji ? Color.blue.opacity(0.2) : Color.clear)
                                    .cornerRadius(8).onTapGesture { selectedEmoji = emoji }
                            }
                        }
                    }
                    Button("新增事由") {
                        let reason = RecordReason(name: newReasonName, icon: selectedEmoji)
                        reason.category = category
                        modelContext.insert(reason)
                        FirestoreManager.shared.saveReason(reason)
                        newReasonName = ""
                    }.disabled(newReasonName.isEmpty).buttonStyle(.bordered)
                }
            }
            Section("事由列表") {
                ForEach(category.reasons) { reason in
                    HStack {
                        TextField("Emoji", text: Binding(get: { reason.icon }, set: { 
                            reason.icon = $0
                            FirestoreManager.shared.saveReason(reason)
                        })).frame(width: 40)
                        
                        TextField("名稱", text: Binding(get: { reason.name }, set: { 
                            let oldReasonName = reason.name
                            reason.name = $0
                            // Rename document in Firestore if name changed
                            if oldReasonName != reason.name {
                                FirestoreManager.shared.deleteReason(oldReasonName)
                            }
                            FirestoreManager.shared.saveReason(reason)
                        }))
                    }
                }.onDelete { offsets in 
                    offsets.forEach { index in
                        let reason = category.reasons[index]
                        FirestoreManager.shared.deleteReason(reason.name)
                        modelContext.delete(reason)
                    }
                }
            }
        }
        .navigationTitle(category.name)
        .onAppear {
            editingName = category.name
            oldName = category.name
        }
    }
    
    private func syncCategoryRename() {
        guard !editingName.isEmpty, editingName != oldName else { 
            editingName = category.name
            return 
        }
        
        // Pass old name to Firestore to handle the document key change
        FirestoreManager.shared.renameCategory(oldName: oldName, newCategory: category)
        
        category.name = editingName
        oldName = editingName // Update tracked oldName
    }
}
