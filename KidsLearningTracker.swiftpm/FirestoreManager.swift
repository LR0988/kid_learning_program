import Foundation
import FirebaseFirestore
import FirebaseCore

class FirestoreManager {
    static let shared = FirestoreManager()
    private let db = Firestore.firestore()
    
    private init() {}
    
    // MARK: - Save Records
    func saveAssetRecord(_ record: AssetRecord) {
        print("🚀 Attempting to save record for \(record.child?.name ?? "Unknown")...")
        
        // Use existing firebaseID if editing, otherwise create a new document
        let docRef: DocumentReference
        if !record.firebaseID.isEmpty {
            docRef = db.collection("records").document(record.firebaseID)
        } else {
            docRef = db.collection("records").document()
            record.firebaseID = docRef.documentID // Store locally
        }
        
        let data: [String: Any] = [
            "firebaseID": docRef.documentID,
            "date": Timestamp(date: record.date),
            "amount": record.amount,
            "moodRating": record.moodRating,
            "parentComment": record.parentComment,
            "childName": record.child?.name ?? "Unknown",
            "reasonName": record.reason?.name ?? "Unknown",
            "assetName": record.asset?.name ?? "Unknown",
            "timestamp": FieldValue.serverTimestamp()
        ]
        
        docRef.setData(data) { error in
            if let error = error {
                print("❌ Firestore Error: \(error.localizedDescription)")
            } else {
                print("✅ Record successfully saved to Firestore! Doc ID: \(docRef.documentID)")
            }
        }
    }
    
    // MARK: - Save Other Entities (Optional sync)
    func saveChild(_ child: Child) {
        db.collection("children").document(child.name).setData([
            "name": child.name,
            "updatedAt": FieldValue.serverTimestamp()
        ])
    }
    
    func saveAsset(_ asset: Asset) {
        db.collection("assets").document(asset.name).setData([
            "name": asset.name,
            "unit": asset.unit,
            "isStock": asset.isStock,
            "symbol": asset.symbol,
            "lastPrice": asset.lastPrice,
            "updatedAt": FieldValue.serverTimestamp()
        ])
    }
    
    func saveReason(_ reason: RecordReason) {
        db.collection("reasons").document(reason.name).setData([
            "name": reason.name,
            "icon": reason.icon,
            "category": reason.category?.name ?? "",
            "usageCount": reason.usageCount,
            "updatedAt": FieldValue.serverTimestamp()
        ])
    }
    
    func saveCategory(_ category: ReasonCategory) {
        db.collection("categories").document(category.name).setData([
            "name": category.name,
            "icon": category.icon,
            "updatedAt": FieldValue.serverTimestamp()
        ])
    }
    
    func renameCategory(oldName: String, newCategory: ReasonCategory) {
        if oldName != newCategory.name {
            db.collection("categories").document(oldName).delete()
            
            // Update all associated reasons in cloud
            db.collection("reasons").whereField("category", isEqualTo: oldName).getDocuments { snapshot, _ in
                snapshot?.documents.forEach { doc in
                    doc.reference.updateData(["category": newCategory.name])
                }
            }
        }
        saveCategory(newCategory)
    }
    
    // MARK: - Delete Data
    func deleteChild(_ name: String) {
        db.collection("children").document(name).delete()
    }
    
    func deleteAsset(_ name: String) {
        db.collection("assets").document(name).delete()
    }
    
    func deleteReason(_ name: String) {
        db.collection("reasons").document(name).delete()
    }
    
    func deleteCategory(_ name: String) {
        db.collection("categories").document(name).delete()
    }
    
    func deleteRecord(_ firebaseID: String) {
        guard !firebaseID.isEmpty else { return }
        db.collection("records").document(firebaseID).delete()
    }
    
    // MARK: - Fetch Data
    func fetchChildren() async throws -> [[String: Any]] {
        let snapshot = try await db.collection("children").getDocuments()
        return snapshot.documents.map { $0.data() }
    }
    
    func fetchAssets() async throws -> [[String: Any]] {
        let snapshot = try await db.collection("assets").getDocuments()
        return snapshot.documents.map { $0.data() }
    }
    
    func fetchCategories() async throws -> [[String: Any]] {
        let snapshot = try await db.collection("categories").getDocuments()
        return snapshot.documents.map { $0.data() }
    }
    
    func fetchReasons() async throws -> [[String: Any]] {
        let snapshot = try await db.collection("reasons").getDocuments()
        return snapshot.documents.map { $0.data() }
    }
    
    func fetchRecords() async throws -> [[String: Any]] {
        let snapshot = try await db.collection("records").order(by: "date", descending: true).getDocuments()
        return snapshot.documents.map { $0.data() }
    }
}
