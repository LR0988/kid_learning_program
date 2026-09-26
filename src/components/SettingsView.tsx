import React, { useState, useEffect } from 'react';
import { 
  fetchChildren, 
  fetchCategories, 
  fetchAssets, 
  saveChild, 
  saveCategory, 
  saveAsset, 
  deleteChild, 
  deleteAsset,
  fetchRecurringRules,
  saveRecurringRule,
  deleteRecurringRule,
  checkAndExecuteRecurringRules,
  executeSingleRecurringRule
} from '../firebase/services';
import { Child, ReasonCategory, Asset, RecurringRule } from '../types/models';
import RecurringRuleModal from './RecurringRuleModal';

interface Props {
  onLogout?: () => void;
}

type SettingsTab = 'recurring' | 'entities' | 'system';

const SettingsView: React.FC<Props> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('recurring');

  const [apiKey, setApiKey] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<ReasonCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);

  // 表單輸入狀態
  const [newChildName, setNewChildName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryEmoji, setSelectedCategoryEmoji] = useState('📁');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUnit, setNewAssetUnit] = useState('');
  const [isStock, setIsStock] = useState(false);

  // 彈窗與執行狀態
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [isExecutingCheck, setIsExecutingCheck] = useState(false);
  const [checkResultMsg, setCheckResultMsg] = useState('');

  const emojis = ["📁", "📚", "🏠", "🎨", "🏃", "🎮", "🌟", "🍎", "🧸", "💰", "☕", "📈"];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const loadData = async () => {
    const [cList, catList, aList, rList] = await Promise.all([
      fetchChildren(),
      fetchCategories(),
      fetchAssets(),
      fetchRecurringRules()
    ]);
    setChildren(cList);
    setCategories(catList);
    setAssets(aList);
    setRecurringRules(rList);
  };

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) setApiKey(savedKey);
    loadData();
  }, []);

  const handleSaveApi = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    alert('API Key 已成功儲存！');
  };

  const handleAddChild = async () => {
    if (!newChildName.trim()) return;
    const newChild: Child = { id: newChildName.trim(), name: newChildName.trim() };
    await saveChild(newChild);
    setNewChildName('');
    loadData();
  };

  const handleDeleteChild = async (name: string) => {
    if (window.confirm(`確定要刪除「${name}」嗎？`)) {
      await deleteChild(name);
      loadData();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const newCat: ReasonCategory = { id: newCategoryName.trim(), name: newCategoryName.trim(), icon: selectedCategoryEmoji };
    await saveCategory(newCat);
    setNewCategoryName('');
    loadData();
  };

  const handleDeleteAsset = async (name: string) => {
    if (window.confirm(`確定要刪除資產「${name}」嗎？`)) {
      await deleteAsset(name);
      loadData();
    }
  };

  const handleToggleRule = async (rule: RecurringRule) => {
    rule.enabled = !rule.enabled;
    await saveRecurringRule(rule);
    loadData();
  };

  const handleDeleteRule = async (rule: RecurringRule) => {
    if (window.confirm(`確定要刪除「${rule.title}」這項週期分派規則嗎？`)) {
      await deleteRecurringRule(rule.id);
      loadData();
    }
  };

  const handleExecuteSingle = async (rule: RecurringRule) => {
    const targetNames = rule.childNames?.join('、') || '小朋友';
    if (!window.confirm(`確定要立即為「${targetNames}」發放「${rule.title}」($${rule.amount}) 嗎？`)) {
      return;
    }
    try {
      const res = await executeSingleRecurringRule(rule);
      alert(`✅ 已成功執行！為 ${res.executedCount} 位小朋友完成「${res.title}」發放！`);
      loadData();
    } catch (e: any) {
      alert('❌ 發放失敗：' + (e.message || '未知錯誤'));
    }
  };

  const handleManualCheck = async (force: boolean = false) => {
    setIsExecutingCheck(true);
    setCheckResultMsg('');
    try {
      const result = await checkAndExecuteRecurringRules(force);
      if (result.executedCount > 0) {
        setCheckResultMsg(`✅ 成功分派 ${result.executedCount} 筆款項 (${result.titles.join(', ')})！`);
      } else {
        const details = result.skippedDetails && result.skippedDetails.length > 0 
          ? ` (${result.skippedDetails.join('；')})` 
          : ' (今日未達發放日或已發放過)';
        setCheckResultMsg(`ℹ️ 今日無需分派${details}。若要立即發放，可點擊規則卡片上的「▶️ 立即發放」按鈕。`);
      }
      loadData();
    } catch (e: any) {
      setCheckResultMsg('❌ 分派檢查失敗：' + (e.message || '未知錯誤'));
    }
    setIsExecutingCheck(false);
  };

  const handleLogout = () => {
    if (window.confirm('確定要登出此裝置嗎？')) {
      localStorage.removeItem('AUTH_TOKEN');
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    }
  };

  const formatFrequency = (rule: RecurringRule) => {
    if (rule.frequency === 'daily') return '每天';
    if (rule.frequency === 'weekly') return `每週${weekDays[rule.dayOfWeek ?? 0]}`;
    if (rule.frequency === 'monthly') return `每月 ${rule.dayOfMonth ?? 1} 號`;
    return '定期';
  };

  return (
    <div>
      {/* 導航列 */}
      <header className="ios-nav-bar">
        <h1>系統設定</h1>
      </header>

      {/* 頂部分段切換選單 (iOS Segmented Control) - 徹底消除手機上的冗長混亂 */}
      <div className="ios-segmented-control">
        <button 
          type="button" 
          className={`ios-segment-btn ${activeTab === 'recurring' ? 'active' : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          📅 週期發放 ({recurringRules.length})
        </button>
        <button 
          type="button" 
          className={`ios-segment-btn ${activeTab === 'entities' ? 'active' : ''}`}
          onClick={() => setActiveTab('entities')}
        >
          👨‍👩‍👧 成員與項目
        </button>
        <button 
          type="button" 
          className={`ios-segment-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          ⚙️ 系統設定
        </button>
      </div>

      {/* ========================================================= */}
      {/* 分頁 1：週期性自動分派 (Recurring Rules)                  */}
      {/* ========================================================= */}
      {activeTab === 'recurring' && (
        <div style={{ padding: '0 16px', animation: 'fadeIn 0.2s ease' }}>
          {/* 新增規則主要按鈕 */}
          <button 
            type="button" 
            className="btn-primary"
            onClick={() => { setEditingRule(null); setShowRecurringModal(true); }}
            style={{ marginBottom: '14px' }}
          >
            + 新增週期分派規則
          </button>

          {/* 規則卡片列表 */}
          {recurringRules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>⏰</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>尚無週期發放規則</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>點擊上方按鈕，即可為小朋友設定每週或每月固定零用錢</div>
            </div>
          ) : (
            recurringRules.map(rule => (
              <div 
                key={rule.id} 
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '12px',
                  boxShadow: 'var(--card-shadow)',
                  border: '0.5px solid var(--border-color)'
                }}
              >
                {/* 規則標題與金額 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)' }}>{rule.title}</span>
                      <span className={`ios-badge ${rule.enabled ? 'active' : ''}`}>
                        {rule.enabled ? '啟用中' : '已暫停'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      ⏰ {formatFrequency(rule)} · {rule.assetName || '現金'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontWeight: '800', 
                      fontSize: '18px', 
                      color: (rule.recordType || 1) >= 0 ? 'var(--success)' : 'var(--danger)' 
                    }}>
                      {(rule.recordType || 1) >= 0 ? '+' : '-'}${rule.amount}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>每位小朋友</div>
                  </div>
                </div>

                {/* 小朋友名單標籤 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {rule.childNames?.map(name => (
                    <span key={name} className="ios-pill-tag">
                      👦 {name}
                    </span>
                  ))}
                </div>

                {/* 底部功能操作按鈕群 */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderTop: '0.5px solid var(--card-sub-bg)',
                  paddingTop: '10px'
                }}>
                  <button 
                    type="button"
                    onClick={() => handleExecuteSingle(rule)} 
                    style={{ 
                      backgroundColor: 'var(--success-bg)', 
                      color: 'var(--success)', 
                      border: 'none', 
                      padding: '6px 14px', 
                      borderRadius: '16px',
                      fontSize: '13px', 
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ▶️ 立即發放
                  </button>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => handleToggleRule(rule)} 
                      style={{ background: 'none', border: 'none', color: rule.enabled ? 'var(--warning)' : 'var(--primary-color)', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      {rule.enabled ? '暫停' : '啟用'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setEditingRule(rule); setShowRecurringModal(true); }} 
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      編輯
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleDeleteRule(rule)} 
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 全域檢查工具按鈕 */}
          <div style={{ marginTop: '16px', padding: '0 4px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button"
                onClick={() => handleManualCheck(false)}
                disabled={isExecutingCheck}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--card-sub-bg)',
                  color: 'var(--primary-color)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {isExecutingCheck ? '檢查中...' : '🔄 檢查今日排程'}
              </button>
              <button 
                type="button"
                onClick={() => handleManualCheck(true)}
                disabled={isExecutingCheck}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--card-sub-bg)',
                  color: 'var(--warning)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ⚡ 強制發放一次
              </button>
            </div>

            {checkResultMsg && (
              <div style={{ 
                fontSize: '13px', 
                marginTop: '10px', 
                padding: '10px 12px', 
                borderRadius: '10px',
                backgroundColor: checkResultMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--card-sub-bg)',
                color: checkResultMsg.startsWith('✅') ? 'var(--success)' : 'var(--text-secondary)',
                lineHeight: 1.4
              }}>
                {checkResultMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 分頁 2：成員與項目 (Children, Assets, Categories)          */}
      {/* ========================================================= */}
      {activeTab === 'entities' && (
        <div style={{ padding: '0 16px', animation: 'fadeIn 0.2s ease' }}>
          {/* 小朋友名單 */}
          <div className="ios-section" style={{ margin: '0 0 18px 0' }}>
            <div className="ios-section-header">👦 小朋友名單 ({children.length})</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <input 
                  type="text" 
                  placeholder="輸入小朋友名字" 
                  value={newChildName} 
                  onChange={e => setNewChildName(e.target.value)} 
                  style={{ textAlign: 'left', flex: 1 }} 
                />
                <button 
                  type="button" 
                  onClick={handleAddChild} 
                  style={{ 
                    background: 'var(--primary-color)', 
                    border: 'none', 
                    color: '#fff', 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>
              {children.map(child => (
                <div key={child.name} className="ios-list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>👦</span>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>{child.name}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteChild(child.name)} 
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 資產項目設定 */}
          <div className="ios-section" style={{ margin: '0 0 18px 0' }}>
            <div className="ios-section-header">💰 資產項目設定 ({assets.length})</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <input 
                  type="text" 
                  placeholder="資產名稱 (如現金、存款)" 
                  value={newAssetName} 
                  onChange={e => setNewAssetName(e.target.value)} 
                  style={{ textAlign: 'left' }} 
                />
                <input 
                  type="text" 
                  placeholder="單位 (如元)" 
                  value={newAssetUnit} 
                  onChange={e => setNewAssetUnit(e.target.value)} 
                  style={{ width: '70px', marginLeft: '10px' }} 
                />
              </div>

              <div className="ios-form-row">
                <label>股票 / 外幣模式</label>
                <input 
                  type="checkbox" 
                  checked={isStock} 
                  onChange={e => setIsStock(e.target.checked)} 
                  style={{ width: '22px', height: '22px', accentColor: 'var(--primary-color)' }} 
                />
              </div>

              {isStock && (
                <div className="ios-form-row">
                  <input 
                    type="text" 
                    placeholder="股票代號 (例如 2330)" 
                    id="symbol-input-tab" 
                    style={{ textAlign: 'left', width: '100%' }} 
                  />
                </div>
              )}

              <button 
                type="button"
                className="ios-form-row" 
                onClick={() => {
                  const symbol = isStock ? (document.getElementById('symbol-input-tab') as HTMLInputElement)?.value || '' : '';
                  if (!newAssetName.trim()) return;
                  const newAsset: Asset = { 
                    id: newAssetName.trim(), 
                    name: newAssetName.trim(), 
                    unit: newAssetUnit || '元', 
                    isStock, 
                    symbol, 
                    lastPrice: 1, 
                    lastUpdated: new Date() 
                  };
                  saveAsset(newAsset).then(() => {
                    setNewAssetName('');
                    setNewAssetUnit('');
                    setIsStock(false);
                    loadData();
                  });
                }} 
                disabled={!newAssetName.trim()} 
                style={{ 
                  color: newAssetName.trim() ? 'var(--primary-color)' : 'var(--text-secondary)', 
                  width: '100%', 
                  justifyContent: 'center', 
                  background: 'var(--card-bg)', 
                  border: 'none', 
                  fontWeight: '600' 
                }}
              >
                + 新增資產項目
              </button>

              {assets.map(asset => (
                <div key={asset.name} className="ios-list-item">
                  <div>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>{asset.name} ({asset.unit})</span>
                    {asset.isStock && (
                      <span className="ios-pill-tag" style={{ marginLeft: '8px' }}>
                        📈 {asset.symbol || '股票'}
                      </span>
                    )}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteAsset(asset.name)} 
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '14px', cursor: 'pointer' }}
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 事由分類管理 */}
          <div className="ios-section" style={{ margin: '0 0 18px 0' }}>
            <div className="ios-section-header">📁 常用事由分類 ({categories.length})</div>
            <div className="ios-list">
              <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="新增事由分類 (如做家事、獎學金)" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)} 
                    style={{ textAlign: 'left', flex: 1 }} 
                  />
                  <button 
                    type="button" 
                    onClick={handleAddCategory} 
                    style={{ 
                      background: 'var(--primary-color)', 
                      border: 'none', 
                      color: '#fff', 
                      width: '30px', 
                      height: '30px', 
                      borderRadius: '50%',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    +
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {emojis.map(emoji => (
                    <div 
                      key={emoji} 
                      onClick={() => setSelectedCategoryEmoji(emoji)}
                      style={{ 
                        fontSize: '22px', 
                        padding: '6px 8px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        background: selectedCategoryEmoji === emoji ? 'var(--card-sub-bg)' : 'transparent',
                        border: selectedCategoryEmoji === emoji ? '1px solid var(--primary-color)' : 'none'
                      }}
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>

              {categories.map(cat => (
                <div key={cat.name} className="ios-list-item">
                  <span style={{ fontSize: '15px', fontWeight: '500' }}>{cat.icon} {cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 分頁 3：系統與帳號 (AI, Account, Logout)                  */}
      {/* ========================================================= */}
      {activeTab === 'system' && (
        <div style={{ padding: '0 16px', animation: 'fadeIn 0.2s ease' }}>
          {/* AI Assistant Setting */}
          <div className="ios-section" style={{ margin: '0 0 20px 0' }}>
            <div className="ios-section-header">🤖 Gemini AI 助理設定</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <label>API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="輸入 Gemini API Key" 
                />
              </div>
              <button 
                type="button"
                className="ios-form-row" 
                onClick={handleSaveApi} 
                style={{ color: 'var(--primary-color)', width: '100%', textAlign: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: 'none', fontWeight: '600' }}
              >
                儲存 API Key
              </button>
            </div>
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              用於語音自然語言自動記帳功能。請至 Google AI Studio 免費申請。
            </div>
          </div>

          {/* 帳號登出 */}
          <div className="ios-section" style={{ margin: '0 0 20px 0' }}>
            <div className="ios-list">
              <button 
                type="button"
                className="ios-form-row" 
                onClick={handleLogout}
                style={{ 
                  color: 'var(--danger)', 
                  width: '100%', 
                  textAlign: 'center', 
                  justifyContent: 'center', 
                  background: 'var(--card-bg)', 
                  border: 'none', 
                  fontSize: '16px', 
                  fontWeight: '600' 
                }}
              >
                登出此裝置
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '20px' }}>
            記帳小管家 Web v1.3.0 · 手機原生體驗加強版
          </div>
        </div>
      )}

      {/* 週期規則建立/編輯彈窗 */}
      {showRecurringModal && (
        <RecurringRuleModal 
          ruleToEdit={editingRule}
          onClose={() => { setShowRecurringModal(false); setEditingRule(null); }}
          onSaved={() => {
            loadData();
            setShowRecurringModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
};

export default SettingsView;
