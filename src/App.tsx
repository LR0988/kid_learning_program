import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { List, PieChart, Settings } from 'lucide-react';
import HistoryView from './components/HistoryView';
import StatisticsView from './components/StatisticsView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import './index.css';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('AUTH_TOKEN');
    if (token === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="app-container">
        <main>
          <Routes>
            <Route path="/" element={<HistoryView />} />
            <Route path="/statistics" element={<StatisticsView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <List />
            <span>History</span>
          </NavLink>
          <NavLink to="/statistics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <PieChart />
            <span>Statistics</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  );
};

export default App;
