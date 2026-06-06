import React, { useState, useEffect } from 'react';
import { saveAssetRecord, fetchChildren, fetchAssets, fetchReasons } from '../firebase/services';
import { AssetRecord, Child, Asset, RecordReason } from '../types/models';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  recordToEdit?: AssetRecord | null;
}

const AddRecordModal: React.FC<Props> = ({ onClose, onSaved, recordToEdit }) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reasons, setReasons] = useState<RecordReason[]>([]);

  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [recordType, setRecordType] = useState<number>(1);
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      setChildren(await fetchChildren());
      setAssets(await fetchAssets());
      setReasons(await fetchReasons());
    };
    loadData();
  }, []);

  useEffect(() => {
    if (recordToEdit) {
      setSelectedChildren([recordToEdit.childName]);
      setSelectedAsset(recordToEdit.assetName);
      setSelectedReason(recordToEdit.reasonName);
      setAmount(Math.abs(recordToEdit.amount).toString());
      setRecordType(recordToEdit.amount >= 0 ? 1 : -1);
      setComment(recordToEdit.parentComment || '');
      setDate(recordToEdit.date.toISOString().split('T')[0]);
    }
  }, [recordToEdit]);

  const handleSave = async () => {
    if (selectedChildren.length === 0 || !selectedAsset || !selectedReason) {
      alert("請選擇至少一位小朋友，並填寫事由與資產！");
      return;
    }
    
    const numAmount = (parseFloat(amount) || 0) * recordType;

    for (const childName of selectedChildren) {
      const newRecord: AssetRecord = {
        firebaseID: recordToEdit ? recordToEdit.firebaseID : '',
        date: new Date(date),
        moodRating: 3,
        parentComment: comment,
        amount: numAmount,
        childName: childName,
        reasonName: selectedReason,
        assetName: selectedAsset
      };
      await saveAssetRecord(newRecord);
    }
    
    onSaved();
    onClose();
  };

  const toggleChild = (name: string) => {
    if (recordToEdit) return; // Disable multi-select if editing
    if (selectedChildren.includes(name)) {
      setSelectedChildren(selectedChildren.filter(c => c !== name));
    } else {
      setSelectedChildren([...selectedChildren, name]);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        
        <header className="ios-nav-bar" style={{ position: 'relative', background: 'var(--bg-color)', borderBottom: 'none' }}>
          <button onClick={onClose} style={{ position: 'absolute', left: 16, color: 'var(--primary-color)', background: 'none', border: 'none', fontSize: '17px' }}>取消</button>
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0 }}>
            {recordToEdit ? '編輯紀錄' : '新增紀錄'}
          </h1>
          <button onClick={handleSave} style={{ position: 'absolute', right: 16, color: 'var(--primary-color)', fontWeight: 'bold', background: 'none', border: 'none', fontSize: '17px' }}>儲存</button>
        </header>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className="ios-section">
            <div className="ios-section-header">對象與日期</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <label>日期</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="ios-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ marginBottom: '8px' }}>小朋友 (可複選)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {children.map(c => (
                    <button
                      key={c.name}
                      onClick={() => toggleChild(c.name)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        fontSize: '15px',
                        cursor: recordToEdit ? 'default' : 'pointer',
                        opacity: recordToEdit && !selectedChildren.includes(c.name) ? 0.5 : 1,
                        background: selectedChildren.includes(c.name) ? 'var(--primary-color)' : 'rgba(142, 142, 147, 0.15)',
                        color: selectedChildren.includes(c.name) ? '#fff' : 'var(--text-primary)'
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ios-section">
            <div className="ios-section-header">紀錄事由</div>
            <div className="ios-list">
              <div className="ios-form-row">
                <label>事由</label>
                <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}>
                  <option value="">請選擇</option>
                  {reasons.map(r => <option key={r.name} value={r.name}>{r.icon} {r.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="ios-section">
            <div className="ios-section-header">資產變動</div>
            <div className="ios-list">
              <div className="ios-form-row" style={{ justifyContent: 'center' }}>
                <div style={{ display: 'flex', background: 'rgba(142,142,147,0.12)', borderRadius: '8px', padding: '2px', width: '100%' }}>
                  <button onClick={() => setRecordType(1)} style={{ flex: 1, padding: '6px', border: 'none', background: recordType === 1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', boxShadow: recordType === 1 ? '0 3px 1px rgba(0,0,0,0.04)' : 'none' }}>獎勵(+)</button>
                  <button onClick={() => setRecordType(-1)} style={{ flex: 1, padding: '6px', border: 'none', background: recordType === -1 ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', boxShadow: recordType === -1 ? '0 3px 1px rgba(0,0,0,0.04)' : 'none' }}>扣除(-)</button>
                </div>
              </div>
              <div className="ios-form-row">
                <label>資產</label>
                <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                  <option value="">請選擇</option>
                  {assets.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div className="ios-form-row">
                <label>數量</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" />
              </div>
            </div>
          </div>

          <div className="ios-section">
            <div className="ios-section-header">內容</div>
            <div className="ios-list">
              <div className="ios-form-row" style={{ alignItems: 'flex-start' }}>
                <textarea 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                  placeholder="請輸入細節..." 
                  style={{ width: '100%', height: '100px', border: 'none', background: 'transparent', outline: 'none', fontSize: '17px', resize: 'none', fontFamily: 'inherit' }}
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
  height: '90%', width: '100%',
  backgroundColor: 'var(--bg-color)',
  borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden'
};

export default AddRecordModal;
