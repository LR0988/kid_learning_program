import SwiftUI
import SwiftData
import FirebaseCore

@main
struct MyApp: App {
    init() {
        var path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist")
        
        if path == nil {
            for bundle in Bundle.allBundles {
                if let found = bundle.path(forResource: "GoogleService-Info", ofType: "plist") {
                    path = found
                    break
                }
            }
        }
                   
        if let path = path {
            if let options = FirebaseOptions(contentsOfFile: path) {
                FirebaseApp.configure(options: options)
                print("✅ Firebase initialized successfully with Project ID: \(options.projectID ?? "Unknown")")
            } else {
                print("❌ Failed to initialize Firebase: Could not parse GoogleService-Info.plist")
            }
        } else {
            print("❌ Failed to initialize Firebase: GoogleService-Info.plist not found in Bundle.module or Bundle.main")
            // 登出 Bundle 內容以供偵錯
            if let resourcePath = Bundle.main.resourcePath {
                try? print("Contents of main bundle: \(FileManager.default.contentsOfDirectory(atPath: resourcePath))")
            }
        }
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Child.self, Asset.self, AssetRecord.self, RecordReason.self, ReasonCategory.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            print("模型遷移失敗，正在刪除舊資料庫以重建：\(error)")
            
            // 取得 SwiftData 預設的資料庫路徑並徹底刪除相關檔案 (-shm, -wal)
            let storeURL = config.url
            let storeURLShm = storeURL.deletingPathExtension().appendingPathExtension("store-shm")
            let storeURLWal = storeURL.deletingPathExtension().appendingPathExtension("store-wal")
            
            try? FileManager.default.removeItem(at: storeURL)
            try? FileManager.default.removeItem(at: storeURLShm)
            try? FileManager.default.removeItem(at: storeURLWal)
            
            do {
                return try ModelContainer(for: schema, configurations: [config])
            } catch {
                fatalError("無法建立 ModelContainer: \(error)")
            }
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}

struct ContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HistoryView()
                .tabItem {
                    Label("資產紀錄表", systemImage: "list.bullet.indent")
                }
                .tag(0)
            
            StatisticsView()
                .tabItem {
                    Label("資產統計", systemImage: "chart.pie.fill")
                }
                .tag(1)
            
            SettingsView()
                .tabItem {
                    Label("設定管理", systemImage: "gear")
                }
                .tag(2)
        }
    }
}
