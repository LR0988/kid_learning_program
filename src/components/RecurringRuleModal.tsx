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
  const [selectedAsset, setSelectedAsset] = useState('現金');
  const [selectedReason, setSelectedReason] = useState('零用錢');
  const [comment, setComment] = useState('');

  const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  useEffect(() => {
    const loadData = async () => {
      const [cList, aList, rList] = await Promise.all([
        fetchChildren(),
        fetchAssets(),
        fetchReasons()
      ]);
      setChildren(cList);
      setAssets(aList);
      setReasons(rList);

      if (aList.length > 0 && !selectedAsset) setSelectedAsset(aList[0].name);
      if (rList.length > 0 && !selectedReason) setSelectedReason(rList[0].name);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (ruleToEdit) {
      setTitle(ruleToEdit.title);
      setSelectedChildren(ruleToEdit.childNames || []);
      setFrequency(ruleToEdit.frequency);
      setDayOfWeek(ruleToEdit.dayOfWeek ?? 0);
      setDayOfMonth(ruleToEdit.dayOfMonth ?? 1);
      setAmount(Math.abs(ruleToEdit.amount).toString());
      setRecordType(ruleToEdit.recordType || 1);
      setSelectedAsset(ruleToEdit.assetName || '現金');
      setSelectedReason(ruleToEdit.reasonName || '零用錢');
      setComment(ruleToEdit.comment || '');
    }
  }, [ruleToEdit]);

  const toggleChild = (name: string) => {
    if (selectedChildren.includes(name)) {
      setSelectedChildren(selectedChildren.filter(c => c !== name));
    } else {
      setSelectedChildren([...selectedChildren, name]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('請輸入規則名稱！');
      return;
    }
    if (selectedChildren.length === 0) {
      alert('請至少選擇一位小朋友！');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('請輸入有效的金額！');
      return;
    }

    const rule: RecurringRule = {
      id: ruleToEdit ? ruleToEdit.id : '',
      title: title.trim(),
      amount: numAmount,
      recordType: recordType,
      assetName: selectedAsset || '現金',
      reasonName: selectedReason || '零用錢',
      childNames: selectedChildren,
      frequency: frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      lastExecutedDate: ruleToEdit ? ruleToEdit.lastExecutedDate : undefined,
      enabled: ruleToEdit ? ruleToEdit.enabled : true,
      comment: comment.trim()
    };

    try {
      await saveRecurringRule(rule);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save recurring rule error:', err);
      alert('儲存週期規則失敗：' + (err.message || '未知錯誤'));
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        {/* iOS 頂部導航列 */}
        <header className="ios-nav-bar" style={{ position: 'relative', background: 'var(--card-bg)', borderBottom: 'none' }}>
          <button onClick={onClose} style={{ position: 'absolute', left: 16, color: 'var(--primary-color)', background: 'none', border: 'none', fontSize: '17px' }}>取消</button>
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontSize: '17px' }}>
            {ruleToEdit ? '編輯週期規則' : '新增週期分派'}
          </h1>
          <button onClick={handleSave} style={{ position: 'absolute', right: 16, color: 'var(--primary-color)', fontWeight: 'bold', background: 'none', border: 'none', fontSize: '17px' }}>儲存</button>
        </header>

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
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="例如：每週零用錢、學習津貼" 
                />
              </div>

              {/* 目標小朋友 */}
              <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ marginBottom: '8px' }}>目標小朋友 (可複選)</label>
                {children.length === 0 ? (
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>請先於「設定」新增小朋友</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {children.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => toggleChild(c.name)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          border: 'none',
                          fontSize: '14px',
                          cursor: 'pointer',
                          background: selectedChildren.includes(c.name) ? 'var(--primary-color)' : 'var(--card-sub-bg)',
                          color: selectedChildren.includes(c.name) ? '#fff' : 'var(--text-primary)'
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
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
                    style={{ flex: 1, padding: '6px', border: 'none', background: frequency === 'daily' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'daily' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    每天
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFrequency('weekly')} 
                    style={{ flex: 1, padding: '6px', border: 'none', background: frequency === 'weekly' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'weekly' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    每週
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFrequency('monthly')} 
                    style={{ flex: 1, padding: '6px', border: 'none', background: frequency === 'monthly' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: frequency === 'monthly' ? 'bold' : 'normal', color: 'var(--text-primary)' }}
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
                    style={{ flex: 1, padding: '6px', border: 'none', background: recordType === 1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: recordType === 1 ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    發放津貼(+)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRecordType(-1)} 
                    style={{ flex: 1, padding: '6px', border: 'none', background: recordType === -1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', fontWeight: recordType === -1 ? 'bold' : 'normal', color: 'var(--text-primary)' }}
                  >
                    定額扣除(-)
                  </button>
                </div>
              </div>

              <div className="ios-form-row">
                <label>資產項目</label>
                <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                  {assets.length === 0 && <option value="現金">現金</option>}
                  {assets.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>

              <div className="ios-form-row">
                <label>事由項目</label>
                <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}>
                  {reasons.length === 0 && <option value="零用錢">零用錢</option>}
                  {reasons.map(r => <option key={r.name} value={r.name}>{r.icon} {r.name}</option>)}
                </select>
              </div>

              <div className="ios-form-row">
                <label>單次金額</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
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
                  placeholder="例如：每週定額零用錢" 
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  zIndex: 1000,
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
};

const modalStyle: React.CSSProperties = {
  height: '92%', width: '100%',
  backgroundColor: 'var(--bg-color)',
  borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  paddingBottom: 'env(safe-area-inset-bottom)'
};

export default RecurringRuleModal;
