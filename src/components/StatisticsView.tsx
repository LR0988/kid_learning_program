import React, { useEffect, useState, useMemo } from 'react';
import { fetchRecords, fetchChildren, fetchAssets, saveAsset } from '../firebase/services';
import { AssetRecord, Child, Asset } from '../types/models';

const ASSET_COLORS = ['#34c759', '#007aff', '#ff9500', '#af52de', '#5856d6', '#ff2d55'];

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

  const getAssetPrice = (assetName: string) => {
    const asset = assets.find(a => a.name === assetName);
    return asset ? (asset.lastPrice || 1) : 1;
  };

  const getAssetInfo = (assetName: string) => {
    return assets.find(a => a.name === assetName);
  };

  const formatAmount = (amount: number) => {
    return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  };

  // 股票市價同步更新
  const handleUpdatePrices = async () => {
    const stocksToUpdate = assets.filter(a => a.isStock && a.symbol);
    if (stocksToUpdate.length === 0) {
      setUpdateMessage('尚未設定含有股票代號的資產');
      setTimeout(() => setUpdateMessage(''), 3000);
      return;
    }

    setIsUpdatingPrices(true);
    setUpdateMessage(`正在同步 ${stocksToUpdate.length} 個股票市價...`);
    let successCount = 0;

    for (const asset of stocksToUpdate) {
      try {
        const symbol = /^\d+$/.test(asset.symbol) ? `${asset.symbol}.TW` : asset.symbol;
        const targetUrl = `/api/stock?symbol=${encodeURIComponent(symbol)}`;
        const res = await fetch(targetUrl);
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
    setUpdateMessage(`✅ 成功更新 ${successCount} 檔股票最新市價！`);
    setTimeout(() => setUpdateMessage(''), 4000);
  };

  const filteredChildren = useMemo(() => {
    return selectedChild 
      ? children.filter(c => c.name === selectedChild)
      : children;
  }, [children, selectedChild]);

  // 計算每個小朋友的詳細資產與總淨值
  const childrenStats = useMemo(() => {
    return filteredChildren.map(child => {
      const childRecords = records.filter(r => r.childName === child.name);

      // 加總各資產數量
      const assetTotals = childRecords.reduce((acc, record) => {
        const aName = record.assetName || '現金';
        acc[aName] = (acc[aName] || 0) + record.amount;
        return acc;
      }, {} as Record<string, number>);

      let totalVal = 0;
      const list = Object.entries(assetTotals).map(([assetName, amount], idx) => {
        const price = getAssetPrice(assetName);
        const assetInfo = getAssetInfo(assetName);
        const isStock = assetInfo?.isStock || false;
        const symbol = assetInfo?.symbol || '';
        const unit = assetInfo?.unit || '元';
        const value = amount * price;
        totalVal += value;
        return {
          assetName,
          amount,
          price,
          symbol,
          isStock,
          unit,
          value,
          color: ASSET_COLORS[idx % ASSET_COLORS.length]
        };
      });

      return {
        child,
        totalValue: totalVal,
        assets: list
      };
    });
  }, [filteredChildren, records, assets]);

  // 全體總資產
  const familyTotalValue = useMemo(() => {
    return childrenStats.reduce((sum, item) => sum + item.totalValue, 0);
  }, [childrenStats]);

  return (
    <div>
      {/* 頂部導航列：右側整合同步市價按鈕，不再霸佔底部螢幕空間 */}
      <header className="ios-nav-bar">
        <h1>資產統計</h1>
        <div className="nav-actions">
          <button 
            type="button" 
            onClick={handleUpdatePrices}
            disabled={isUpdatingPrices}
            style={{ 
              fontSize: '13px', 
              fontWeight: '600',
              padding: '6px 10px',
              backgroundColor: 'var(--card-sub-bg)',
              borderRadius: '16px',
              gap: '4px'
            }}
            title="更新股票最新市價"
          >
            <span style={{ display: 'inline-block', transform: isUpdatingPrices ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}>
              🔄
            </span>
            <span>{isUpdatingPrices ? '同步中' : '同步市價'}</span>
          </button>
        </div>
      </header>

      {/* 更新訊息反饋橫幅 */}
      {updateMessage && (
        <div className="ios-banner" style={{ margin: '12px 16px 0' }}>
          <div>{updateMessage}</div>
        </div>
      )}

      {/* 小朋友篩選膠囊 */}
      {children.length > 0 && (
        <div className="filter-bar">
          <button 
            type="button"
            className={`filter-btn ${selectedChild === null ? 'active' : ''}`}
            onClick={() => setSelectedChild(null)}
          >
            全部對象
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

      {/* 頂部總覽大儀表板卡片 */}
      <div style={{ margin: '14px 16px 8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #007aff 0%, #0051ba 100%)',
          borderRadius: '18px',
          padding: '18px 20px',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(0, 122, 255, 0.25)'
        }}>
          <div style={{ fontSize: '13px', opacity: 0.85, fontWeight: '500', marginBottom: '4px' }}>
            {selectedChild ? `${selectedChild} 預估總資產` : '全體小朋友預估總資產'}
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.8px' }}>
            NT$ {formatAmount(familyTotalValue).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '6px' }}>
            含現金儲蓄與股票即時折算市值
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
          載入統計中...
        </div>
      ) : children.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div>
          <h3>尚未新增任何小朋友</h3>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>請至「設定」頁面新增小朋友名單</p>
        </div>
      ) : (
        <div style={{ padding: '8px 16px 20px' }}>
          {childrenStats.map(({ child, totalValue, assets: childAssets }) => (
            <div key={child.name} className="portfolio-card">
              {/* 卡片標題與總額 */}
              <div className="portfolio-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px' }}>👦</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{child.name}</span>
                  </div>
                  <div className="portfolio-total-label">個人資產折合總值</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="portfolio-total-val" style={{ color: 'var(--primary-color)' }}>
                    ${formatAmount(totalValue)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>新台幣 (NTD)</div>
                </div>
              </div>

              {/* 彩色資產佔比進度條 (Visual Asset Allocation Bar) */}
              {totalValue > 0 && childAssets.length > 0 && (
                <div>
                  <div className="asset-progress-bar">
                    {childAssets.map(item => {
                      const percentage = Math.max(0, (item.value / totalValue) * 100);
                      return (
                        <div 
                          key={item.assetName}
                          className="asset-progress-segment"
                          style={{ 
                            width: `${percentage}%`, 
                            backgroundColor: item.color 
                          }}
                          title={`${item.assetName}: ${percentage.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>

                  {/* 標籤小圖例 (Legend) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', fontSize: '12px' }}>
                    {childAssets.map(item => {
                      const percentage = Math.max(0, (item.value / totalValue) * 100);
                      return (
                        <div key={item.assetName} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{item.assetName}</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{percentage.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 資產明細條列 */}
              <div style={{ borderTop: '0.5px solid var(--border-color)', paddingTop: '10px' }}>
                {childAssets.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '12px 0' }}>
                    尚無資產明細紀錄
                  </div>
                ) : (
                  childAssets.map(item => (
                    <div 
                      key={item.assetName} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '9px 0',
                        borderBottom: '0.5px solid var(--card-sub-bg)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>
                          {item.assetName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {item.isStock ? (
                            <span>代號 {item.symbol || '台股'} · 市價 ${item.price}</span>
                          ) : (
                            <span>基礎儲蓄帳戶</span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
                          {formatAmount(item.amount)} {item.unit}
                        </div>
                        {item.isStock && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            市值 NT${formatAmount(item.value)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatisticsView;
