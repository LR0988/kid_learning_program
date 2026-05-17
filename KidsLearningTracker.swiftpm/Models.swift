import Foundation
import SwiftData

@Model
final class Child {
    var name: String
    @Relationship(deleteRule: .cascade, inverse: \AssetRecord.child) 
    var records: [AssetRecord] = []
    init(name: String) { self.name = name }
}

@Model
final class ReasonCategory {
    var name: String
    var icon: String
    @Relationship(deleteRule: .cascade, inverse: \RecordReason.category)
    var reasons: [RecordReason] = []
    init(name: String, icon: String = "📁") { self.name = name; self.icon = icon }
}

@Model
final class RecordReason {
    var name: String
    var icon: String
    var usageCount: Int = 0
    var category: ReasonCategory?
    init(name: String, icon: String = "📝") { self.name = name; self.icon = icon }
}

@Model
final class Asset {
    var name: String
    var unit: String
    var isStock: Bool = false
    var symbol: String = "" // 股票代號，例如 2330
    var lastPrice: Double = 1.0
    var lastUpdated: Date?
    
    init(name: String, unit: String = "元", isStock: Bool = false, lastPrice: Double = 1.0, symbol: String = "") {
        self.name = name
        self.unit = unit
        self.isStock = isStock
        self.lastPrice = lastPrice
        self.symbol = symbol
        self.lastUpdated = Date()
    }
}

@Model
final class AssetRecord {
    var date: Date
    var moodRating: Int 
    var parentComment: String
    var imageData: Data?
    var reason: RecordReason?
    var child: Child?
    var asset: Asset?
    var amount: Double = 0 
    var firebaseID: String = "" // Firestore document ID
    
    init(date: Date = Date(), moodRating: Int = 3, parentComment: String = "", imageData: Data? = nil, amount: Double = 0, firebaseID: String = "") {
        self.date = date
        self.moodRating = moodRating
        self.parentComment = parentComment
        self.imageData = imageData
        self.amount = amount
        self.firebaseID = firebaseID
    }
}
