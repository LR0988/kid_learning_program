import React, { useState } from 'react';

interface Props {
  onLogin: () => void;
}

const LoginView: React.FC<Props> = ({ onLogin }) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (account === 'hotpotlu' && password === 'qQ!0963067171') {
      localStorage.setItem('AUTH_TOKEN', 'authenticated');
      onLogin();
    } else {
      setError('帳號或密碼錯誤 (Invalid account or password)');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', backgroundColor: 'var(--bg-color)' }}>
      
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px' }}>Kids Learning Tracker</h1>
        <p style={{ color: 'var(--text-secondary)' }}>請登入以繼續 (Please log in to continue)</p>
      </div>

      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px' }}>
        <div className="ios-list" style={{ marginBottom: '20px' }}>
          <div className="ios-form-row">
            <input 
              type="text" 
              placeholder="帳號 (Account)" 
              value={account}
              onChange={e => setAccount(e.target.value)}
              style={{ width: '100%', textAlign: 'left', outline: 'none', border: 'none', background: 'transparent', fontSize: '17px' }}
            />
          </div>
          <div className="ios-form-row">
            <input 
              type="password" 
              placeholder="密碼 (Password)" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', textAlign: 'left', outline: 'none', border: 'none', background: 'transparent', fontSize: '17px' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '15px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button 
          type="submit"
          className="ios-form-row" 
          style={{ color: 'var(--primary-color)', width: '100%', textAlign: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: 'none', borderRadius: '10px', fontSize: '17px', fontWeight: 'bold' }}
        >
          登入 (Login)
        </button>
      </form>
    </div>
  );
};

export default LoginView;
