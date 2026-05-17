import Foundation

struct DraftRecord: Codable {
    var childName: String?
    var reasonName: String?
    var assetName: String?
    var amount: Double?
    var recordType: Int? // 1 for Add, -1 for Deduct
    var parentComment: String?
}
