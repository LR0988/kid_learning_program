import React, { useState, useEffect } from 'react';
import { saveRecurringRule, fetchChildren, fetchAssets, fetchReasons } from '../firebase/services';
import { Child, Asset, RecordReason, RecurringRule } from '../types/models';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  ruleToEdit?: RecurringRule | null;
}

const RecurringRuleModal: React.FC<Props> = ({ onClose, onSaved, ruleToEdit }) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reasons, setReasons] = useState<RecordReason[]>([]);

  const [title, setTitle] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(0); // 0 = 週日
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [recordType, setRecordType] = useState<number>(1);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [comment, setComment] = useState('');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cList, aList, rList] = await Promise.all([
          fetchChildren(),
          fetchAssets(),
          fetchReasons()
        ]);
        setChildren(cList);
        setAssets(aList);
        setReasons(rList);

        if (!ruleToEdit) {
          // 新增模式時，智慧預設全選小朋友，並設定預設資產與事由
          if (cList.length > 0) {
            setSelectedChildren(cList.map(c => c.name));
          }
          if (aList.length > 0) {
            // 優先選擇新台幣或現金
            const defaultAsset = aList.find(a => a.name.includes('台幣') || a.name.includes('現金')) || aList[0];
            setSelectedAsset(defaultAsset.name);
          }
          if (rList.length > 0) {
            const defaultReason = rList.find(r => r.name.includes('零用錢') || r.name.includes('津貼') || r.name.includes('獎勵')) || rList[0];
            setSelectedReason(defaultReason.name);
          }
        }
      } catch (err) {
        console.error('Failed to load modal metadata:', err);
      }
    };
    loadData();
  }, [ruleToEdit]);

  useEffect(() => {
    if (ruleToEdit) {
      setTitle(ruleToEdit.title || '');
      setSelectedChildren(ruleToEdit.childNames || []);
      setFrequency(ruleToEdit.frequency || 'weekly');
      setDayOfWeek(ruleToEdit.dayOfWeek ?? 0);
      setDayOfMonth(ruleToEdit.dayOfMonth ?? 1);
      setAmount(Math.abs(ruleToEdit.amount || 0).toString());
      setRecordType(ruleToEdit.recordType || 1);
      setSelectedAsset(ruleToEdit.assetName || '');
      setSelectedReason(ruleToEdit.reasonName || '');
      setComment(ruleToEdit.comment || '');
    }
  }, [ruleToEdit]);

  const toggleChild = (name: string) => {
    setFormError('');
    if (selectedChildren.includes(name)) {
      setSelectedChildren(selectedChildren.filter(c => c !== name));
    } else {
      setSelectedChildren([...selectedChildren, name]);
    }
  };

  const selectAllChildren = () => {
    if (selectedChildren.length === children.length) {
      setSelectedChildren([]);
    } else {
      setSelectedChildren(children.map(c => c.name));
    }
  };

  const handleSave = async () => {
    setFormError('');

    if (!title.trim()) {
      setFormError('請填寫規則名稱（例如：每週零用錢）');
      return;
    }
    if (selectedChildren.length === 0) {
      setFormError('請至少選取一位小朋友');
      return;
    }

    // 寬容金額輸入（去除 $ 或元）
    const cleanAmountStr = amount.replace(/[^0-9.]/g, '');
    const numAmount = parseFloat(cleanAmountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('請輸入大於 0 的有效金額');
      return;
    }

    const fallbackAsset = assets.length > 0 ? assets[0].name : '現金';
    const fallbackReason = reasons.length > 0 ? reasons[0].name : '零用錢';

    const rule: RecurringRule = {
      id: ruleToEdit ? ruleToEdit.id : '',
      title: title.trim(),
      amount: numAmount,
      recordType: recordType,
      assetName: selectedAsset || fallbackAsset,
      reasonName: selectedReason || fallbackReason,
      childNames: selectedChildren,
      frequency: frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : 0,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : 1,
      lastExecutedDate: ruleToEdit ? (ruleToEdit.lastExecutedDate || '') : '',
      enabled: ruleToEdit ? (ruleToEdit.enabled !== false) : true,
      comment: comment.trim()
    };

    setIsSaving(true);
    try {
      await saveRecurringRule(rule);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save recurring rule error:', err);
      setFormError('儲存失敗：' + (err.message || '請檢查網路連線'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        {/* iOS 標準 Flexbox 導航標頭，確保按鈕必定可點擊無遮蔽 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '0.5px solid var(--border-color)',
          backgroundColor: 'var(--card-bg)'
        }}>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '17px', cursor: 'pointer', padding: '4px' }}
          >
            取消
          </button>
          <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {ruleToEdit ? '編輯週期規則' : '新增週期分派'}
          </div>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: isSaving ? 'var(--text-secondary)' : 'var(--primary-color)', 
              fontSize: '17px', 
              fontWeight: 'bold', 
              cursor: isSaving ? 'default' : 'pointer', 
              padding: '4px' 
            }}
          >
            {isSaving ? '儲存中...' : '儲存'}
          </button>
        </div>

        {/* 醒目的表單錯誤提示橫幅 (避免依賴 window.alert) */}
        {formError && (
          <div style={{ 
            margin: '12px 16px 0', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            backgroundColor: 'rgba(255, 59, 48, 0.12)', 
            color: 'var(--danger)', 
            fontSize: '14px', 
            fontWeight: '500',
            textAlign: 'center',
            animation: 'fadeIn 0.2s ease'
          }}>
            ⚠️ {formError}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '30px' }}>
          {/* 規則基本資訊 */}
          <div className="ios-section">
            <div className="ios-section-header">規則設定</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <label>規則名稱</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => { setTitle(e.target.value); setFormError(''); }} 
                  placeholder="例如：每週零用錢、助學獎勵" 
                />
              </div>

              {/* 目標小朋友 */}
              <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>目標小朋友 (可複選)</label>
                  {children.length > 1 && (
                    <button 
                      type="button" 
                      onClick={selectAllChildren}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                    >
                      {selectedChildren.length === children.length ? '取消全選' : '全部選取'}
                    </button>
                  )}
                </div>

                {children.length === 0 ? (
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>請先於「設定」新增小朋友</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {children.map(c => {
                      const isSelected = selectedChildren.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => toggleChild(c.name)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: isSelected ? '600' : 'normal',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--primary-color)' : 'var(--card-sub-bg)',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 週期頻率 */}
          <div className="ios-section">
            <div className="ios-section-header">發放頻率</div>
            <div className="ios-list">
              <div className="ios-form-row" style={{ justifyContent: 'center' }}>
                <div style={{ display: 'flex', background: 'var(--card-sub-bg)', borderRadius: '8px', padding: '2px', width: '100%' }}>
                  <button 
                    type="button"
                    onClick={() => setFrequency('daily')} 
                    style={{ flex: 1, padding: '8px', border: 'none', background: frequency === 'daily' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'daily' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    每天
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFrequency('weekly')} 
                    style={{ flex: 1, padding: '8px', border: 'none', background: frequency === 'weekly' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'weekly' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    每週
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFrequency('monthly')} 
                    style={{ flex: 1, padding: '8px', border: 'none', background: frequency === 'monthly' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'monthly' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    每月
                  </button>
                </div>
              </div>

              {frequency === 'weekly' && (
                <div className="ios-form-row">
                  <label>每週固定於</label>
                  <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                    {weekDays.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div className="ios-form-row">
                  <label>每月固定於</label>
                  <select value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                      <option key={date} value={date}>{date} 號</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 資產與金額 */}
          <div className="ios-section">
            <div className="ios-section-header">資產與金額</div>
            <div className="ios-list">
              <div className="ios-form-row" style={{ justifyContent: 'center' }}>
                <div style={{ display: 'flex', background: 'var(--card-sub-bg)', borderRadius: '8px', padding: '2px', width: '100%' }}>
                  <button 
                    type="button"
                    onClick={() => setRecordType(1)} 
                    style={{ flex: 1, padding: '8px', border: 'none', background: recordType === 1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: recordType === 1 ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    發放津貼(+)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRecordType(-1)} 
                    style={{ flex: 1, padding: '8px', border: 'none', background: recordType === -1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: recordType === -1 ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    定額扣除(-)
                  </button>
                </div>
              </div>

              <div className="ios-form-row">
                <label>資產項目</label>
                <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                  {assets.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>

              <div className="ios-form-row">
                <label>事由項目</label>
                <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}>
                  {reasons.map(r => <option key={r.name} value={r.name}>{r.icon ? `${r.icon} ` : ''}{r.name}</option>)}
                </select>
              </div>

              <div className="ios-form-row">
                <label>每人單次金額</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={amount} 
                  onChange={e => { setAmount(e.target.value); setFormError(''); }} 
                  placeholder="0.0" 
                />
              </div>
            </div>
          </div>

          {/* 說明備註 */}
          <div className="ios-section">
            <div className="ios-section-header">說明備註 (選填)</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <input 
                  type="text" 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                  placeholder="例如：例行每週零用錢" 
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>
          </div>

          {/* 底部醒目的確認儲存大按鈕 */}
          <div style={{ padding: '0 16px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={isSaving}
              style={{ marginTop: '10px' }}
            >
              {isSaving ? '正在儲存中...' : '確認儲存規則'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  zIndex: 1000,
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
};

const modalStyle: React.CSSProperties = {
  height: '92%', width: '100%',
  backgroundColor: 'var(--bg-color)',
  borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom))'
};

export default RecurringRuleModal;
