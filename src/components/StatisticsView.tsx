import React, { useEffect, useState } from 'react';
import { fetchRecords, fetchChildren, fetchAssets, saveAsset } from '../firebase/services';
import { AssetRecord, Child, Asset } from '../types/models';

const StatisticsView: React.FC = () => {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordData, childData, assetData] = await Promise.all([
        fetchRecords(),
        fetchChildren(),
        fetchAssets()
      ]);
      setRecords(recordData);
      setChildren(childData);
      setAssets(assetData);
    } catch (error) {
      console.error("Failed to load records for stats:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredChildren = selectedChild 
    ? children.filter(c => c.name === selectedChild)
    : children;

  const getAssetPrice = (assetName: string) => {
    const asset = assets.find(a => a.name === assetName);
    return asset ? (asset.lastPrice || 1) : 1;
  };

  const getAssetSymbol = (assetName: string) => {
    const asset = assets.find(a => a.name === assetName);
    return asset?.symbol || '';
  };

  const formatAmount = (amount: number) => {
    return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  };

  const handleUpdatePrices = async () => {
    const stocksToUpdate = assets.filter(a => a.isStock && a.symbol);
    if (stocksToUpdate.length === 0) {
      setUpdateMessage('沒有設定代號的股票項目。');
      return;
    }

    setIsUpdatingPrices(true);
    setUpdateMessage(`正在更新 ${stocksToUpdate.length} 個項目...`);
    let successCount = 0;

    for (const asset of stocksToUpdate) {
      try {
        const symbol = /^\d+$/.test(asset.symbol) ? `${asset.symbol}.TW` : asset.symbol;
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        const res = await fetch(proxyUrl);
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (price && typeof price === 'number') {
          asset.lastPrice = price;
          asset.lastUpdated = new Date();
          await saveAsset(asset);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to fetch price for ${asset.symbol}:`, error);
      }
    }

    await loadData();
    setIsUpdatingPrices(false);
    setUpdateMessage(`成功更新 ${successCount} 個項目的市價。`);
  };

  return (
    <div>
      <header className="ios-nav-bar">
        <h1>資產統計</h1>
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
      ) : children.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div>
          <h3>請先新增小朋友</h3>
        </div>
      ) : (
        <div style={{ paddingBottom: '20px' }}>
          {filteredChildren.map(child => {
            const childRecords = records.filter(r => r.childName === child.name);

            // Group by asset
            const assetTotals = childRecords.reduce((acc, record) => {
              const aName = record.assetName || '現金';
              acc[aName] = (acc[aName] || 0) + record.amount;
              return acc;
            }, {} as Record<string, number>);

            let totalValue = 0;
            const assetList = Object.entries(assetTotals).map(([assetName, amount]) => {
              const price = getAssetPrice(assetName);
              const symbol = getAssetSymbol(assetName);
              const isStock = assets.find(a => a.name === assetName)?.isStock;
              const unit = assets.find(a => a.name === assetName)?.unit || '';
              const value = amount * price;
              totalValue += value;
              return { assetName, amount, price, symbol, isStock, unit, value };
            });

            return (
              <div key={child.name} className="ios-section">
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '16px', marginBottom: '8px' }}>{child.name}</h2>
                
                <div className="ios-list">
                  <div className="ios-list-item">
                    <span>預估總價值 (NTD)</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '18px' }}>
                      {formatAmount(totalValue)} 元
                    </span>
                  </div>

                  {assetList.map(info => (
                    <div key={info.assetName} className="ios-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>{info.assetName}</span>
                        <span>{formatAmount(info.amount)} {info.unit}</span>
                      </div>
                      {info.isStock && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>代號: {info.symbol || '依名稱搜尋'}</span>
                          <span>市值: NTD {formatAmount(info.value)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="ios-section">
            <div className="ios-list">
              <button 
                onClick={handleUpdatePrices}
                disabled={isUpdatingPrices}
                className="ios-form-row" 
                style={{ 
                  color: isUpdatingPrices ? 'var(--text-secondary)' : 'var(--primary-color)', 
                  width: '100%', textAlign: 'center', justifyContent: 'center', 
                  background: 'var(--card-bg)', border: 'none', flexDirection: 'column', padding: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔄</span>
                  {isUpdatingPrices ? "正在嘗試連接..." : "同步最新市價"}
                </div>
                {updateMessage && <div style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '4px' }}>{updateMessage}</div>}
              </button>
            </div>
            <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              提示：若無法搜尋到現值，請在『設定』中手動更新『市價』。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsView;
