import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { List, PieChart, Settings } from 'lucide-react';
import HistoryView from './components/HistoryView';
import StatisticsView from './components/StatisticsView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { checkAndExecuteRecurringRules } from './firebase/services';
import './index.css';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [autoDispatchedBanner, setAutoDispatchedBanner] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('AUTH_TOKEN');
    if (token === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  // 登入後或開啟 App 時自動執行週期分派檢查
  useEffect(() => {
    if (isAuthenticated) {
      checkAndExecuteRecurringRules(false).then(result => {
        if (result.executedCount > 0) {
          setAutoDispatchedBanner(`✨ 已為小朋友自動分派定期款項：${result.titles.join('、')} (共 ${result.executedCount} 筆)！`);
        }
      }).catch(err => {
        console.warn('Auto recurring check error:', err);
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="app-container">
        <main>
          <Routes>
            <Route 
              path="/" 
              element={
                <HistoryView 
                  bannerMessage={autoDispatchedBanner} 
                  onDismissBanner={() => setAutoDispatchedBanner(null)} 
                />
              } 
            />
            <Route path="/statistics" element={<StatisticsView />} />
            <Route 
              path="/settings" 
              element={<SettingsView onLogout={() => setIsAuthenticated(false)} />} 
            />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <List />
            <span>紀錄</span>
          </NavLink>
          <NavLink to="/statistics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <PieChart />
            <span>統計</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings />
            <span>設定</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  );
};

export default App;
