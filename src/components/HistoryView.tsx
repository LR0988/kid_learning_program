import React, { useEffect, useState } from 'react';
import { fetchRecords, fetchChildren, deleteRecord } from '../firebase/services';
import { AssetRecord, Child } from '../types/models';
import AddRecordModal from './AddRecordModal';

const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordData, childData] = await Promise.all([
        fetchRecords(),
        fetchChildren()
      ]);
      setRecords(recordData);
      setChildren(childData);
    } catch (error) {
      console.error("Failed to load records:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      await deleteRecord(id);
      loadData();
    }
  };

  const filteredRecords = selectedChild 
    ? records.filter(r => r.childName === selectedChild)
    : records;

  // Group by date string (YYYY-MM-DD)
  const groupedRecords = filteredRecords.reduce((groups, record) => {
    const dateStr = record.date.toISOString().split('T')[0];
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(record);
    return groups;
  }, {} as Record<string, AssetRecord[]>);

  const sortedDates = Object.keys(groupedRecords).sort().reverse();

  return (
    <div>
      <header className="ios-nav-bar">
        <h1>資產紀錄表</h1>
        <div className="nav-actions">
          <button onClick={() => alert("Voice input not hooked up yet")}>🎙</button>
          <button onClick={() => setShowAddModal(true)}>+</button>
        </div>
      </header>

      {children.length > 0 && (
        <div className="filter-bar">
          <button 
            className={`filter-btn ${selectedChild === null ? 'active' : ''}`}
            onClick={() => setSelectedChild(null)}
          >
            全部
          </button>
          {children.map(child => (
            <button 
              key={child.name}
              className={`filter-btn ${selectedChild === child.name ? 'active' : ''}`}
              onClick={() => setSelectedChild(child.name)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : filteredRecords.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
          <h3>尚無紀錄</h3>
          <p>點擊右上角「+」開始新增第一筆紀錄！</p>
        </div>
      ) : (
        <div>
          {sortedDates.map(date => (
            <div key={date} className="ios-section">
              <div className="ios-section-header">{new Date(date).toLocaleDateString()}</div>
              <div className="ios-list">
                {groupedRecords[date].map(record => (
                  <div key={record.firebaseID} className="ios-list-item">
                    
                    {/* Left Icon */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: record.amount >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      fontSize: '20px', marginRight: '12px'
                    }}>
                      📝
                    </div>

                    {/* Middle Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '16px' }}>{record.childName}</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{record.reasonName}</div>
                    </div>

                    {/* Right Amount */}
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <div style={{ 
                          fontWeight: 'bold', fontSize: '16px',
                          color: record.amount >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {record.amount >= 0 ? '+' : ''}{record.amount}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{record.assetName}</div>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(record.firebaseID)} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', padding: '5px' }}
                      >
                        🗑
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <AddRecordModal onClose={() => setShowAddModal(false)} onSaved={loadData} />}
    </div>
  );
};

export default HistoryView;
