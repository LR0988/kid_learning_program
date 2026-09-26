import React, { useEffect, useState, useMemo } from 'react';
import { fetchRecords, fetchChildren, deleteRecord } from '../firebase/services';
import { AssetRecord, Child } from '../types/models';
import AddRecordModal from './AddRecordModal';

interface Props {
  bannerMessage?: string | null;
  onDismissBanner?: () => void;
}

// 根據事由與類型智慧給予對應的 Emoji
const getReasonEmoji = (reason: string, amount: number) => {
  if (reason.includes('股票')) return '📈';
  if (reason.includes('零用錢') || reason.includes('現金') || reason.includes('存')) return '💰';
  if (reason.includes('書') || reason.includes('學') || reason.includes('功課') || reason.includes('作業')) return '📚';
  if (reason.includes('咖啡') || reason.includes('家事') || reason.includes('幫忙')) return '☕';
  if (reason.includes('電視') || reason.includes('遊戲') || reason.includes('玩')) return '🎮';
  if (reason.includes('獎')) return '🌟';
  if (amount < 0) return '🔻';
  return '📝';
};

const HistoryView: React.FC<Props> = ({ bannerMessage, onDismissBanner }) => {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AssetRecord | null>(null);
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
  }, [bannerMessage]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 阻止觸發整張卡片的編輯事件
    if (window.confirm("確定要刪除這筆紀錄嗎？")) {
      await deleteRecord(id);
      loadData();
    }
  };

  const handleEdit = (record: AssetRecord) => {
    setEditingRecord(record);
    setShowAddModal(true);
  };

  const filteredRecords = useMemo(() => {
    return selectedChild 
      ? records.filter(r => r.childName === selectedChild)
      : records;
  }, [records, selectedChild]);

  // 統計摘要計算
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredRecords.forEach(r => {
      if (r.amount > 0) income += r.amount;
      else expense += Math.abs(r.amount);
    });
    return {
      income,
      expense,
      net: income - expense,
      totalCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // 按日期分組 (YYYY-MM-DD)
  const groupedRecords = useMemo(() => {
    return filteredRecords.reduce((groups, record) => {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(record);
      return groups;
    }, {} as Record<string, AssetRecord[]>);
  }, [filteredRecords]);

  const sortedDates = Object.keys(groupedRecords).sort().reverse();

  return (
    <div>
      {/* 頂部導航列 */}
      <header className="ios-nav-bar">
        <h1>資產紀錄表</h1>
        <div className="nav-actions">
          <button 
            type="button" 
            onClick={() => { setEditingRecord(null); setShowAddModal(true); }}
            style={{ 
              backgroundColor: 'var(--primary-color)', 
              color: '#fff', 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%',
              fontSize: '20px',
              fontWeight: '600'
            }}
            title="新增紀錄"
          >
            +
          </button>
        </div>
      </header>

      {/* 系統自動分派橫幅 */}
      {bannerMessage && (
        <div className="ios-banner">
          <div>{bannerMessage}</div>
          {onDismissBanner && (
            <button 
              type="button"
              onClick={onDismissBanner} 
              style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '18px', cursor: 'pointer', padding: '0 4px', fontWeight: 'bold' }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* 小朋友篩選膠囊列 */}
      {children.length > 0 && (
        <div className="filter-bar">
          <button 
            type="button"
            className={`filter-btn ${selectedChild === null ? 'active' : ''}`}
            onClick={() => setSelectedChild(null)}
          >
            全部對象 ({records.length})
          </button>
          {children.map(child => (
            <button 
              type="button"
              key={child.name}
              className={`filter-btn ${selectedChild === child.name ? 'active' : ''}`}
              onClick={() => setSelectedChild(child.name)}
            >
              👦 {child.name}
            </button>
          ))}
        </div>
      )}

      {/* 收支摘要速覽卡片 (Dashboard Summary Widget) */}
      <div style={{ margin: '14px 16px 6px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(52, 199, 89, 0.08) 100%)',
          borderRadius: '16px',
          padding: '14px 16px',
          border: '0.5px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '500' }}>
              {selectedChild ? `${selectedChild} 的結餘變動` : '整體收支變動'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.5px' }}>
              {summary.net >= 0 ? '+' : ''}{summary.net.toLocaleString()} 元
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>累計發放</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>
                +${summary.income.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>累計扣除</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--danger)' }}>
                -${summary.expense.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)', fontSize: '15px' }}>
          讀取紀錄中...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '50px', marginBottom: '12px' }}>📁</div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>尚無資產紀錄</h3>
          <p style={{ marginTop: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>點擊右上角「+」即可快速記錄第一筆零用錢或獎勵！</p>
        </div>
      ) : (
        <div style={{ marginTop: '8px' }}>
          {sortedDates.map(date => (
            <div key={date} style={{ margin: '14px 16px' }}>
              {/* 日期分組標籤 */}
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                color: 'var(--text-secondary)', 
                marginBottom: '8px', 
                marginLeft: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>📅 {new Date(date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({groupedRecords[date].length} 筆)</span>
              </div>

              {/* 紀錄卡片清單 (整張卡片點擊可直接編輯) */}
              <div>
                {groupedRecords[date].map(record => {
                  const emoji = getReasonEmoji(record.reasonName, record.amount);
                  const isPositive = record.amount >= 0;
                  const isRecurring = record.parentComment && record.parentComment.startsWith('[定期分派]');

                  return (
                    <div 
                      key={record.firebaseID} 
                      className="record-card"
                      onClick={() => handleEdit(record)}
                    >
                      {/* 左側：精美 Emoji 圖示盒 */}
                      <div 
                        className="record-icon-box"
                        style={{
                          backgroundColor: isPositive ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: isPositive ? 'var(--success)' : 'var(--danger)'
                        }}
                      >
                        {emoji}
                      </div>

                      {/* 中間：事由名稱、對象標籤、備註 */}
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ 
                          fontWeight: '600', 
                          fontSize: '16px', 
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: '4px'
                        }}>
                          {record.reasonName}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="ios-pill-tag">
                            👦 {record.childName}
                          </span>
                          <span className="ios-pill-tag">
                            {record.assetName || '現金'}
                          </span>
                          {isRecurring && (
                            <span className="ios-badge active" style={{ fontSize: '10px', padding: '1px 5px' }}>
                              週期自動
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 右側：大金額與單一優雅刪除按鈕 */}
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{ 
                          fontWeight: '700', 
                          fontSize: '17px',
                          color: isPositive ? 'var(--success)' : 'var(--danger)',
                          letterSpacing: '-0.3px',
                          marginBottom: '2px'
                        }}>
                          {isPositive ? '+' : ''}{record.amount.toLocaleString()}
                        </div>

                        <button 
                          type="button"
                          onClick={(e) => handleDelete(e, record.firebaseID)} 
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--text-tertiary)', 
                            padding: '4px 2px', 
                            fontSize: '14px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.8
                          }}
                          title="刪除紀錄"
                        >
                          🗑
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/編輯彈窗 */}
      {showAddModal && (
        <AddRecordModal 
          onClose={() => { setShowAddModal(false); setEditingRecord(null); }} 
          onSaved={loadData} 
          recordToEdit={editingRecord} 
        />
      )}
    </div>
  );
};

export default HistoryView;
