import Foundation
import SwiftData
import FirebaseFirestore

@MainActor
class DataSyncManager {
    static let shared = DataSyncManager()
    private init() {}
    
    func syncFromCloud(context: ModelContext) async {
        print("🔄 Starting Cloud Sync (Cloud First)...")
        
        do {
            // 1. Fetch all cloud data
            let cloudChildren = try await FirestoreManager.shared.fetchChildren()
            let cloudAssets = try await FirestoreManager.shared.fetchAssets()
            let cloudRecordsSnapshot = try await Firestore.firestore().collection("records").getDocuments()
            
            // 2. Sync Children (Delete local if not in cloud)
            let localChildren = try context.fetch(FetchDescriptor<Child>())
            let cloudChildrenNames = Set(cloudChildren.compactMap { $0["name"] as? String })
            for child in localChildren {
                if !cloudChildrenNames.contains(child.name) {
                    context.delete(child)
                }
            }
            for name in cloudChildrenNames {
                let fetch = FetchDescriptor<Child>(predicate: #Predicate { $0.name == name })
                if (try? context.fetch(fetch))?.first == nil {
                    context.insert(Child(name: name))
                }
            }

            // 3. Sync Assets (Delete local if not in cloud)
            let localAssets = try context.fetch(FetchDescriptor<Asset>())
            let cloudAssetsNames = Set(cloudAssets.compactMap { $0["name"] as? String })
            for asset in localAssets {
                if !cloudAssetsNames.contains(asset.name) {
                    context.delete(asset)
                }
            }
            for data in cloudAssets {
                if let name = data["name"] as? String {
                    let fetch = FetchDescriptor<Asset>(predicate: #Predicate { $0.name == name })
                    if let existing = (try? context.fetch(fetch))?.first {
                        existing.unit = data["unit"] as? String ?? "元"
                        existing.isStock = data["isStock"] as? Bool ?? false
                        existing.lastPrice = data["lastPrice"] as? Double ?? 1.0
                    } else {
                        context.insert(Asset(name: name, unit: data["unit"] as? String ?? "元", isStock: data["isStock"] as? Bool ?? false, lastPrice: data["lastPrice"] as? Double ?? 1.0))
                    }
                }
            }
            
            // 3.5 Sync Categories & Reasons
            let cloudCategories = try await FirestoreManager.shared.fetchCategories()
            let cloudReasons = try await FirestoreManager.shared.fetchReasons()
            
            // Sync Categories
            let localCategories = try context.fetch(FetchDescriptor<ReasonCategory>())
            let cloudCatNames = Set(cloudCategories.compactMap { $0["name"] as? String })
            for cat in localCategories {
                if !cloudCatNames.contains(cat.name) {
                    context.delete(cat)
                }
            }
            for data in cloudCategories {
                if let name = data["name"] as? String {
                    let fetch = FetchDescriptor<ReasonCategory>(predicate: #Predicate { $0.name == name })
                    if let existing = (try? context.fetch(fetch))?.first {
                        existing.icon = data["icon"] as? String ?? "📁"
                    } else {
                        context.insert(ReasonCategory(name: name, icon: data["icon"] as? String ?? "📁"))
                    }
                }
            }
            
            // Sync Reasons
            let localReasons = try context.fetch(FetchDescriptor<RecordReason>())
            let cloudReasonNames = Set(cloudReasons.compactMap { $0["name"] as? String })
            for reason in localReasons {
                if !cloudReasonNames.contains(reason.name) {
                    context.delete(reason)
                }
            }
            for data in cloudReasons {
                if let name = data["name"] as? String {
                    let fetch = FetchDescriptor<RecordReason>(predicate: #Predicate { $0.name == name })
                    let reason: RecordReason
                    if let existing = (try? context.fetch(fetch))?.first {
                        reason = existing
                        reason.icon = data["icon"] as? String ?? "📝"
                        reason.usageCount = data["usageCount"] as? Int ?? 0
                    } else {
                        reason = RecordReason(name: name, icon: data["icon"] as? String ?? "📝")
                        reason.usageCount = data["usageCount"] as? Int ?? 0
                        context.insert(reason)
                    }
                    
                    // Link to Category
                    let catName = data["category"] as? String ?? ""
                    let catFetch = FetchDescriptor<ReasonCategory>(predicate: #Predicate { $0.name == catName })
                    reason.category = (try? context.fetch(catFetch))?.first
                }
            }

            // 4. Sync Records (Strict matching with Cloud IDs)
            let localRecords = try context.fetch(FetchDescriptor<AssetRecord>())
            let cloudRecordDocs = cloudRecordsSnapshot.documents
            let cloudRecordIDs = Set(cloudRecordDocs.map { $0.documentID })
            
            // Delete local records not in the cloud
            for localRecord in localRecords {
                if !localRecord.firebaseID.isEmpty && !cloudRecordIDs.contains(localRecord.firebaseID) {
                    context.delete(localRecord)
                }
            }
            
            // Update or Insert cloud records
            for doc in cloudRecordDocs {
                let data = doc.data()
                let cloudID = doc.documentID
                
                let fetch = FetchDescriptor<AssetRecord>(predicate: #Predicate { $0.firebaseID == cloudID })
                if let existing = (try? context.fetch(fetch))?.first {
                    // Update existing record from cloud
                    existing.amount = data["amount"] as? Double ?? 0
                    existing.date = (data["date"] as? Timestamp)?.dateValue() ?? Date()
                    existing.parentComment = data["parentComment"] as? String ?? ""
                    existing.moodRating = data["moodRating"] as? Int ?? 3
                    
                    // Update reason if it's missing or changed
                    let reasonName = data["reasonName"] as? String ?? ""
                    let reasonFetch = FetchDescriptor<RecordReason>(predicate: #Predicate { $0.name == reasonName })
                    existing.reason = (try? context.fetch(reasonFetch))?.first
                } else {
                    // Insert new record
                    let date = (data["date"] as? Timestamp)?.dateValue() ?? Date()
                    let amount = data["amount"] as? Double ?? 0
                    let newRecord = AssetRecord(date: date, amount: amount, firebaseID: cloudID)
                    newRecord.parentComment = data["parentComment"] as? String ?? ""
                    newRecord.moodRating = data["moodRating"] as? Int ?? 3
                    
                    let childName = data["childName"] as? String ?? ""
                    let childFetch = FetchDescriptor<Child>(predicate: #Predicate { $0.name == childName })
                    newRecord.child = (try? context.fetch(childFetch))?.first
                    
                    let assetName = data["assetName"] as? String ?? ""
                    let assetFetch = FetchDescriptor<Asset>(predicate: #Predicate { $0.name == assetName })
                    newRecord.asset = (try? context.fetch(assetFetch))?.first
                    
                    // Added: Link to reason
                    let reasonName = data["reasonName"] as? String ?? ""
                    let reasonFetch = FetchDescriptor<RecordReason>(predicate: #Predicate { $0.name == reasonName })
                    newRecord.reason = (try? context.fetch(reasonFetch))?.first
                    
                    context.insert(newRecord)
                }
            }
            
            try context.save()
            print("✅ Cloud Sync Complete (Strict Cloud-First)")
            
        } catch {
            print("❌ Sync Error: \(error.localizedDescription)")
        }
    }
}
