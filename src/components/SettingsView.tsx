import React, { useState, useEffect } from 'react';
import { fetchChildren, fetchCategories, fetchAssets, saveChild, saveCategory, saveAsset, deleteChild, deleteAsset } from '../firebase/services';
import { Child, ReasonCategory, Asset } from '../types/models';

const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<ReasonCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Form states
  const [newChildName, setNewChildName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryEmoji, setSelectedCategoryEmoji] = useState('📁');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUnit, setNewAssetUnit] = useState('');
  const [isStock, setIsStock] = useState(false);

  const emojis = ["📁", "📚", "🏠", "🎨", "🏃", "🎮", "🌟", "🍎", "🧸", "💰"];

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) setApiKey(savedKey);

    const loadData = async () => {
      setChildren(await fetchChildren());
      setCategories(await fetchCategories());
      setAssets(await fetchAssets());
    };
    loadData();
  }, []);

  const handleSaveApi = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    alert('API Key Saved!');
  };

  const handleAddChild = async () => {
    if (!newChildName) return;
    const newChild: Child = { id: newChildName, name: newChildName };
    await saveChild(newChild);
    setNewChildName('');
    setChildren(await fetchChildren());
  };

  const handleDeleteChild = async (name: string) => {
    if (window.confirm("Delete this child?")) {
      await deleteChild(name);
      setChildren(await fetchChildren());
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    const newCat: ReasonCategory = { id: newCategoryName, name: newCategoryName, icon: selectedCategoryEmoji };
    await saveCategory(newCat);
    setNewCategoryName('');
    setCategories(await fetchCategories());
  };

  const handleAddAsset = async () => {
    if (!newAssetName) return;
    const newAsset: Asset = { id: newAssetName, name: newAssetName, unit: newAssetUnit, isStock, symbol: '', lastPrice: 1, lastUpdated: new Date() };
    await saveAsset(newAsset);
    setNewAssetName('');
    setNewAssetUnit('');
    setAssets(await fetchAssets());
  };

  const handleDeleteAsset = async (name: string) => {
    if (window.confirm("Delete this asset?")) {
      await deleteAsset(name);
      setAssets(await fetchAssets());
    }
  };

  return (
    <div>
      <header className="ios-nav-bar">
        <h1>系統設定</h1>
      </header>

      {/* AI Assistant Setting */}
      <div className="ios-section">
        <div className="ios-section-header">AI 助理設定</div>
        <div className="ios-list">
          <div className="ios-form-row">
            <label>API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="輸入您的 Gemini API Key" 
            />
          </div>
          <button className="ios-form-row" onClick={handleSaveApi} style={{ color: 'var(--primary-color)', width: '100%', textAlign: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: 'none' }}>
            Save API Key
          </button>
        </div>
        <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          用於語音自動記帳功能。請至 Google AI Studio 免費申請。
        </div>
      </div>

      {/* Children Management */}
      <div className="ios-section">
        <div className="ios-section-header">小朋友管理</div>
        <div className="ios-list">
          <div className="ios-form-row">
            <input 
              type="text" 
              placeholder="名字" 
              value={newChildName} 
              onChange={e => setNewChildName(e.target.value)} 
              style={{ textAlign: 'left', flex: 1 }} 
            />
            <button onClick={handleAddChild} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '24px' }}>+</button>
          </div>
          {children.map(child => (
            <div key={child.name} className="ios-list-item">
              <span>{child.name}</span>
              <button onClick={() => handleDeleteChild(child.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)' }}>刪除</button>
            </div>
          ))}
        </div>
      </div>

      {/* Category Management */}
      <div className="ios-section">
        <div className="ios-section-header">事由分類管理</div>
        <div className="ios-list">
          <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
            <div style={{ display: 'flex' }}>
              <input 
                type="text" 
                placeholder="分類名稱" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                style={{ textAlign: 'left', flex: 1 }} 
              />
              <button onClick={handleAddCategory} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '24px' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {emojis.map(emoji => (
                <div 
                  key={emoji} 
                  onClick={() => setSelectedCategoryEmoji(emoji)}
                  style={{ 
                    fontSize: '24px', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                    background: selectedCategoryEmoji === emoji ? 'rgba(0,122,255,0.1)' : 'transparent'
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
              <span style={{ color: 'var(--border-color)' }}>&gt;</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assets Management */}
      <div className="ios-section">
        <div className="ios-section-header">資產項目設定</div>
        <div className="ios-list">
          <div className="ios-form-row">
            <input type="text" placeholder="資產名稱" value={newAssetName} onChange={e => setNewAssetName(e.target.value)} style={{ textAlign: 'left' }} />
            <input type="text" placeholder="單位" value={newAssetUnit} onChange={e => setNewAssetUnit(e.target.value)} style={{ width: '60px', marginLeft: '10px' }} />
          </div>
          <div className="ios-form-row">
            <span>股票/外幣</span>
            <input type="checkbox" checked={isStock} onChange={e => setIsStock(e.target.checked)} style={{ width: 'auto' }} />
          </div>
          {isStock && (
            <div className="ios-form-row">
              <input type="text" placeholder="代號 (例如 2330)" value={newAssetName} onChange={(e) => {}} style={{ display: 'none' }} />
              <input type="text" placeholder="代號 (例如 2330)" id="symbol-input" style={{ textAlign: 'left', width: '100%' }} />
            </div>
          )}
          <button className="ios-form-row" onClick={() => {
            const symbol = isStock ? (document.getElementById('symbol-input') as HTMLInputElement)?.value || '' : '';
            if (!newAssetName) return;
            const newAsset: Asset = { id: newAssetName, name: newAssetName, unit: newAssetUnit, isStock, symbol, lastPrice: 1, lastUpdated: new Date() };
            saveAsset(newAsset).then(() => {
              setNewAssetName('');
              setNewAssetUnit('');
              setIsStock(false);
              fetchAssets().then(setAssets);
            });
          }} disabled={!newAssetName} style={{ color: newAssetName ? 'var(--primary-color)' : 'var(--text-secondary)', width: '100%', justifyContent: 'center', background: 'var(--card-bg)', border: 'none' }}>
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
              <button onClick={() => handleDeleteAsset(asset.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)' }}>刪除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
