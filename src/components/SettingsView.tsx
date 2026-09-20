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

const SettingsView: React.FC<Props> = ({ onLogout }) => {
  const [apiKey, setApiKey] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<ReasonCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);

  // Form states
  const [newChildName, setNewChildName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryEmoji, setSelectedCategoryEmoji] = useState('📁');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUnit, setNewAssetUnit] = useState('');
  const [isStock, setIsStock] = useState(false);

  // Modal & execution states
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [isExecutingCheck, setIsExecutingCheck] = useState(false);
  const [checkResultMsg, setCheckResultMsg] = useState('');

  const emojis = ["📁", "📚", "🏠", "🎨", "🏃", "🎮", "🌟", "🍎", "🧸", "💰"];
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
    alert('API Key 已儲存！');
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
        setCheckResultMsg(`ℹ️ 今日無需分派${details}。若要立即發放，可點擊規則旁的「立即發放」按鈕。`);
      }
      loadData();
    } catch (e: any) {
      setCheckResultMsg('❌ 分派檢查失敗：' + (e.message || '未知錯誤'));
    }
    setIsExecutingCheck(false);
  };

  const handleLogout = () => {
    if (window.confirm('確定要登出帳號嗎？')) {
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
      <header className="ios-nav-bar">
        <h1>系統設定</h1>
      </header>

      {/* 週期性自動分派 (Recurring Rules) */}
      <div className="ios-section">
        <div className="ios-section-header">週期性自動分派 (定期零用錢/獎勵)</div>
        <div className="ios-list">
          {recurringRules.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              尚無週期分派規則。點選下方按鈕新增定期發放！
            </div>
          ) : (
            recurringRules.map(rule => (
              <div key={rule.id} className="ios-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>{rule.title}</span>
                    <span className={`ios-badge ${rule.enabled ? 'active' : ''}`}>
                      {rule.enabled ? '啟用中' : '暫停'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: (rule.recordType || 1) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {(rule.recordType || 1) >= 0 ? '+' : '-'}${rule.amount}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>
                    ⏰ {formatFrequency(rule)} · 👦 {rule.childNames?.join('、') || '無對象'} ({rule.assetName || '現金'})
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      type="button"
                      onClick={() => handleExecuteSingle(rule)} 
                      style={{ background: 'none', border: 'none', color: 'var(--success)', fontSize: '13px', cursor: 'pointer', padding: 0, fontWeight: '600' }}
                    >
                      ▶️ 立即發放
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleToggleRule(rule)} 
                      style={{ background: 'none', border: 'none', color: rule.enabled ? 'var(--warning)' : 'var(--primary-color)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                    >
                      {rule.enabled ? '暫停' : '啟用'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setEditingRule(rule); setShowRecurringModal(true); }} 
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                    >
                      編輯
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleDeleteRule(rule)} 
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 新增規則按鈕 */}
          <button 
            type="button"
            className="ios-form-row" 
            onClick={() => { setEditingRule(null); setShowRecurringModal(true); }}
            style={{ color: 'var(--primary-color)', width: '100%', textAlign: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: 'none', fontSize: '15px', fontWeight: '600' }}
          >
            + 新增週期分派規則
          </button>
        </div>

        {/* 手動執行與說明 */}
        <div style={{ marginTop: '8px', padding: '0 8px' }}>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button 
              type="button"
              onClick={() => handleManualCheck(false)}
              disabled={isExecutingCheck}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--card-sub-bg)',
                color: 'var(--primary-color)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {isExecutingCheck ? '檢查中...' : '🔄 立即檢查並分派'}
            </button>
            <button 
              type="button"
              onClick={() => handleManualCheck(true)}
              disabled={isExecutingCheck}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--card-sub-bg)',
                color: 'var(--warning)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ⚡ 強制發放一次
            </button>
          </div>

          {checkResultMsg && (
            <div style={{ fontSize: '13px', marginTop: '8px', color: checkResultMsg.startsWith('✅') ? 'var(--success)' : 'var(--text-secondary)' }}>
              {checkResultMsg}
            </div>
          )}

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            💡 系統在每次開啟 App 時均會自動檢查。若今天到了排程日且尚未發放，將會自動為小朋友計入帳本。
          </div>
        </div>
      </div>

      {/* 小朋友管理 */}
      <div className="ios-section">
        <div className="ios-section-header">小朋友名單</div>
        <div className="ios-list">
          <div className="ios-form-row">
            <input 
              type="text" 
              placeholder="新增小朋友名字" 
              value={newChildName} 
              onChange={e => setNewChildName(e.target.value)} 
              style={{ textAlign: 'left', flex: 1 }} 
            />
            <button type="button" onClick={handleAddChild} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '24px' }}>+</button>
          </div>
          {children.map(child => (
            <div key={child.name} className="ios-list-item">
              <span>👦 {child.name}</span>
              <button type="button" onClick={() => handleDeleteChild(child.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '14px' }}>刪除</button>
            </div>
          ))}
        </div>
      </div>

      {/* 資產項目設定 */}
      <div className="ios-section">
        <div className="ios-section-header">資產項目設定</div>
        <div className="ios-list">
          <div className="ios-form-row">
            <input type="text" placeholder="資產名稱 (如現金、存款)" value={newAssetName} onChange={e => setNewAssetName(e.target.value)} style={{ textAlign: 'left' }} />
            <input type="text" placeholder="單位" value={newAssetUnit} onChange={e => setNewAssetUnit(e.target.value)} style={{ width: '60px', marginLeft: '10px' }} />
          </div>
          <div className="ios-form-row">
            <span>股票/外幣</span>
            <input type="checkbox" checked={isStock} onChange={e => setIsStock(e.target.checked)} style={{ width: 'auto' }} />
          </div>
          {isStock && (
            <div className="ios-form-row">
              <input type="text" placeholder="代號 (例如 2330)" value={newAssetName} onChange={() => {}} style={{ display: 'none' }} />
              <input type="text" placeholder="股票代號 (例如 2330)" id="symbol-input" style={{ textAlign: 'left', width: '100%' }} />
            </div>
          )}
          <button 
            type="button"
            className="ios-form-row" 
            onClick={() => {
              const symbol = isStock ? (document.getElementById('symbol-input') as HTMLInputElement)?.value || '' : '';
              if (!newAssetName.trim()) return;
              const newAsset: Asset = { id: newAssetName.trim(), name: newAssetName.trim(), unit: newAssetUnit || '元', isStock, symbol, lastPrice: 1, lastUpdated: new Date() };
              saveAsset(newAsset).then(() => {
                setNewAssetName('');
                setNewAssetUnit('');
                setIsStock(false);
                loadData();
              });
            }} 
            disabled={!newAssetName.trim()} 
            style={{ color: newAssetName.trim() ? 'var(--primary-color)' : 'var(--text-secondary)', width: '100%', justifyContent: 'center', background: 'var(--card-bg)', border: 'none', fontWeight: '600' }}
          >
            新增資產項目
          </button>

          {assets.map(asset => (
            <div key={asset.name} className="ios-list-item">
              <div>
                <span>{asset.name} ({asset.unit})</span>
                {asset.isStock && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  股票模式 {asset.symbol ? `(${asset.symbol})` : ''}
                </span>}
              </div>
              <button type="button" onClick={() => handleDeleteAsset(asset.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '14px' }}>刪除</button>
            </div>
          ))}
        </div>
      </div>

      {/* 事由分類管理 */}
      <div className="ios-section">
        <div className="ios-section-header">事由分類管理</div>
        <div className="ios-list">
          <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
            <div style={{ display: 'flex' }}>
              <input 
                type="text" 
                placeholder="分類名稱 (如做家事、獎學金)" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                style={{ textAlign: 'left', flex: 1 }} 
              />
              <button type="button" onClick={handleAddCategory} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '24px' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
              {emojis.map(emoji => (
                <div 
                  key={emoji} 
                  onClick={() => setSelectedCategoryEmoji(emoji)}
                  style={{ 
                    fontSize: '24px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer',
                    background: selectedCategoryEmoji === emoji ? 'rgba(0,122,255,0.15)' : 'transparent'
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
          {categories.map(cat => (
            <div key={cat.name} className="ios-list-item">
              <span>{cat.icon} {cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant Setting */}
      <div className="ios-section">
        <div className="ios-section-header">Gemini AI 語音設定</div>
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
      </div>

      {/* 帳號登出 */}
      <div className="ios-section" style={{ marginTop: '30px' }}>
        <div className="ios-list">
          <button 
            type="button"
            className="ios-form-row" 
            onClick={handleLogout}
            style={{ color: 'var(--danger)', width: '100%', textAlign: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: 'none', fontSize: '16px', fontWeight: '600' }}
          >
            登出此裝置
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          記帳小管家 Web v1.2.0 · iPhone PWA Standalone
        </div>
      </div>

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
