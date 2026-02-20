import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserSettings from '../components/UserSettings';
import DailyStatsTab from '../components/DailyStatsTab';
import FoodLogTab from '../components/FoodLogTab';
import WeightTab from '../components/WeightTab';
import WorkoutTab from '../components/WorkoutTab';
import './Dashboard.css';

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Show settings as a modal/overlay, not replacing the dashboard
  if (showSettings) {
    return (
      <div className="dashboard-with-modal">
        <UserSettings onBack={() => setShowSettings(false)} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Cal-Count</h1>
        <button 
          className="user-profile-btn"
          onClick={() => setShowSettings(true)}
          title="Click to open settings"
        >
          👤 {userProfile?.name || 'Account'}
        </button>
      </header>

      <nav className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Daily Stats
        </button>
        <button
          className={`tab-btn ${activeTab === 'foodlog' ? 'active' : ''}`}
          onClick={() => setActiveTab('foodlog')}
        >
          Food Log
        </button>
        <button
          className={`tab-btn ${activeTab === 'weight' ? 'active' : ''}`}
          onClick={() => setActiveTab('weight')}
        >
          Weight
        </button>
        <button
          className={`tab-btn ${activeTab === 'workout' ? 'active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          Workout
        </button>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'stats' && <DailyStatsTab />}
        {activeTab === 'foodlog' && <FoodLogTab />}
        {activeTab === 'weight' && <WeightTab />}
        {activeTab === 'workout' && <WorkoutTab />}
      </div>
    </div>
  );
}
