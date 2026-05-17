import SwiftUI
import SwiftData

struct StatisticsView: View {
    @Query var children: [Child]
    @Query var assets: [Asset]
    @Query var records: [AssetRecord]
    
    @State private var selectedChildID: PersistentIdentifier?
    @State private var isUpdatingPrices = false
    @State private var updateMessage = ""
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !children.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            FilterButton(title: "全部", isSelected: selectedChildID == nil) { selectedChildID = nil }
                            ForEach(children) { child in
                                FilterButton(title: child.name, isSelected: selectedChildID == child.id) { selectedChildID = child.id }
                            }
                        }.padding(.horizontal).padding(.vertical, 8)
                    }
                    .background(Color(UIColor.systemBackground))
                }
                
                List {
                    ForEach(filteredChildren) { child in
                        Section(header: Text(child.name).font(.title3.bold()).foregroundColor(.primary)) {
                            let childTotals = calculateAssets(for: child)
                            let grandTotal = calculateGrandTotal(totals: childTotals)
                            
                            HStack {
                                Text("預估總價值 (NTD)")
                                Spacer()
                                Text("\(formatAmount(grandTotal)) 元")
                                    .font(.headline).foregroundColor(.blue)
                            }
                            .padding(.vertical, 4)
                            
                            ForEach(childTotals.keys.sorted(), id: \.self) { assetName in
                                let info = childTotals[assetName]!
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(assetName)
                                        Spacer()
                                        Text("\(formatAmount(info.amount)) \(info.unit)")
                                    }
                                    if info.isStock {
                                        HStack {
                                            if info.symbol.isEmpty {
                                                Text("依名稱搜尋")
                                                    .font(.caption2).foregroundColor(.secondary)
                                            } else {
                                                Text("代號: \(info.symbol)")
                                                    .font(.caption2).foregroundColor(.secondary)
                                            }
                                            Spacer()
                                            Text("市值: NTD \(formatAmount(info.amount * info.price))")
                                                .font(.caption).foregroundColor(.secondary)
                                        }
                                        if let date = info.lastUpdated {
                                            Text("更新時間: \(date.formatted(date: .abbreviated, time: .shortened))")
                                                .font(.system(size: 8)).foregroundColor(.gray)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    Section {
                        Button(action: updateAllPrices) {
                            VStack(alignment: .leading) {
                                Label(isUpdatingPrices ? "正在嘗試連接..." : "同步最新市價", systemImage: "arrow.clockwise")
                                if !updateMessage.isEmpty {
                                    Text(updateMessage).font(.caption).foregroundColor(.orange)
                                }
                            }
                        }
                        .disabled(isUpdatingPrices)
                    } footer: {
                        Text("提示：若無法搜尋到現值，請在『設定』中手動更新『市價』。")
                    }
                }
            }
            .navigationTitle("資產統計")
            .overlay { if children.isEmpty { ContentUnavailableView("請先新增小朋友", systemImage: "person.badge.plus") } }
        }
    }
    
    private var filteredChildren: [Child] {
        if let selectedChildID {
            return children.filter { $0.id == selectedChildID }
        }
        return children
    }
    
    struct AssetInfo {
        var amount: Double; var unit: String; var price: Double; var isStock: Bool; var symbol: String; var lastUpdated: Date?
    }
    
    private func calculateAssets(for child: Child) -> [String: AssetInfo] {
        var totals: [String: AssetInfo] = [:]
        let childRecords = records.filter { $0.child?.id == child.id }
        for record in childRecords {
            if let asset = record.asset {
                if totals[asset.name] == nil {
                    totals[asset.name] = AssetInfo(amount: 0, unit: asset.unit, price: asset.lastPrice, isStock: asset.isStock, symbol: asset.symbol, lastUpdated: asset.lastUpdated)
                }
                totals[asset.name]?.amount += record.amount
            }
        }
        return totals
    }
    
    private func calculateGrandTotal(totals: [String: AssetInfo]) -> Double {
        totals.values.reduce(0) { $0 + ($1.amount * $1.price) }
    }
    
    private func updateAllPrices() {
        let stocksToUpdate = assets.filter { $0.isStock && !$0.symbol.isEmpty }
        guard !stocksToUpdate.isEmpty else {
            updateMessage = "沒有設定代號的股票項目。"
            return
        }
        
        isUpdatingPrices = true
        updateMessage = "正在更新 \(stocksToUpdate.count) 個項目..."
        
        Task {
            var successCount = 0
            for asset in stocksToUpdate {
                // 台灣股票加上 .TW
                let symbol = asset.symbol.allSatisfy({ $0.isNumber }) ? "\(asset.symbol).TW" : asset.symbol
                if let price = await fetchStockPrice(symbol: symbol) {
                    await MainActor.run {
                        asset.lastPrice = price
                        asset.lastUpdated = Date()
                        FirestoreManager.shared.saveAsset(asset)
                        successCount += 1
                    }
                }
            }
            
            await MainActor.run {
                isUpdatingPrices = false
                updateMessage = "成功更新 \(successCount) 個項目的市價。"
            }
        }
    }
    
    private func fetchStockPrice(symbol: String) async -> Double? {
        // 如果是台灣股票（純數字代號），優先使用台灣交易所官方 API
        if symbol.hasSuffix(".TW") {
            let pureSymbol = symbol.replacingOccurrences(of: ".TW", with: "")
            if pureSymbol.allSatisfy({ $0.isNumber }) {
                if let price = await fetchTWSEPrice(symbol: pureSymbol) {
                    return price
                }
            }
        }
        
        // 否則或失敗時，嘗試使用 Yahoo v8 Chart API (目前較 v7 穩定且不需 Auth)
        return await fetchYahooChartPrice(symbol: symbol)
    }
    
    private func fetchTWSEPrice(symbol: String) async -> Double? {
        // 台灣交易所 MIS API
        let urlString = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_\(symbol).tw"
        guard let url = URL(string: urlString) else { return nil }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(TWSEResponse.self, from: data)
            if let firstMsg = response.msgArray.first, let priceStr = firstMsg.z, let price = Double(priceStr) {
                print("✅ TWSE Found price for \(symbol): \(price)")
                return price
            }
            // 有時候 'z' (成交價) 是 '-'，嘗試使用 'y' (昨收) 或 'o' (開盤)
            if let firstMsg = response.msgArray.first, let priceStr = firstMsg.y ?? firstMsg.o, let price = Double(priceStr) {
                print("✅ TWSE Found backup price for \(symbol): \(price)")
                return price
            }
            return nil
        } catch {
            print("❌ TWSE Fetch error: \(error.localizedDescription)")
            return nil
        }
    }
    
    private func fetchYahooChartPrice(symbol: String) async -> Double? {
        let urlString = "https://query1.finance.yahoo.com/v8/finance/chart/\(symbol)?interval=1m&range=1d"
        guard let url = URL(string: urlString) else { return nil }
        
        var request = URLRequest(url: url)
        request.setValue("Mozilla/5.0", forHTTPHeaderField: "User-Agent")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(YahooChartResponse.self, from: data)
            if let meta = response.chart.result.first?.meta {
                print("✅ Yahoo Chart Found price for \(symbol): \(meta.regularMarketPrice)")
                return meta.regularMarketPrice
            }
            return nil
        } catch {
            print("❌ Yahoo Chart Fetch error: \(error.localizedDescription)")
            return nil
        }
    }
    
    // API Decoding Structures
    struct TWSEResponse: Codable {
        let msgArray: [TWSEMsg]
    }
    struct TWSEMsg: Codable {
        let z: String? // 當前成交價
        let y: String? // 昨收
        let o: String? // 開盤
    }
    
    struct YahooChartResponse: Codable {
        let chart: ChartResult
    }
    struct ChartResult: Codable {
        let result: [ChartItem]
    }
    struct ChartItem: Codable {
        let meta: ChartMeta
    }
    struct ChartMeta: Codable {
        let regularMarketPrice: Double
    }
    
    private func formatAmount(_ amount: Double) -> String {
        let absAmount = abs(amount)
        if absAmount == floor(absAmount) {
            return String(format: "%.0f", amount)
        } else {
            return String(format: "%.2f", amount)
        }
    }
}
