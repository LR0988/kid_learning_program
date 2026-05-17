import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { List, PieChart, Settings } from 'lucide-react';
import HistoryView from './components/HistoryView';
import StatisticsView from './components/StatisticsView';
import SettingsView from './components/SettingsView';
import './index.css';

const App: React.FC = () => {
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
