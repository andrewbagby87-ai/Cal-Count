import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserSettings from '../components/UserSettings';
import DailyStatsTab from '../components/DailyStatsTab';
import FoodLogTab from '../components/FoodLogTab';
import WeightTab from '../components/WeightTab';
import WorkoutTab from '../components/WorkoutTab';
import './Dashboard.css';

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  
  // 1. Tell React to ONLY mount the Daily Stats tab when the app first opens
  const [bootedTabs, setBootedTabs] = useState<string[]>(['stats']);
  
  // Bring in the logout function from useAuth
  const { userProfile, loading, logout } = useAuth();
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // This effect listens for clicks outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. THE WATERFALL BOOT SEQUENCE
  // We delay the mounting of hidden tabs so the network isn't choked on startup
  useEffect(() => {
    let isMounted = true;

    const runBootSequence = async () => {
      // Wait 800ms, then silently boot the Food Log
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setBootedTabs(prev => prev.includes('foodlog') ? prev : [...prev, 'foodlog']);

      // Wait another 800ms, then boot Weight
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setBootedTabs(prev => prev.includes('weight') ? prev : [...prev, 'weight']);

      // Wait another 800ms, then boot Workouts
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setBootedTabs(prev => prev.includes('workout') ? prev : [...prev, 'workout']);
    };

    runBootSequence();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Load Settings page directly, letting its own CSS handle the full screen
  if (showSettings) {
    return <UserSettings onBack={() => setShowSettings(false)} />;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Cal-Count</h1>
        
        {/* Dropdown Container */}
        <div className="profile-menu-container" ref={dropdownRef}>
          <button 
            className="user-profile-btn"
            onClick={() => setShowDropdown(!showDropdown)}
            title="Account Menu"
          >
            👤 {userProfile?.name || 'Account'} ▾
          </button>
          
          {showDropdown && (
            <div className="dropdown-menu">
              <button 
                className="dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  setShowSettings(true);
                }}
              >
                ⚙️ Settings
              </button>
              <button 
                className="dropdown-item logout-btn"
                onClick={handleLogout}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
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
        
        {/* 3. STAGGERED TAB RENDER AREA */}
        {/* Daily Stats is always in the DOM immediately */}
        <div style={{ display: activeTab === 'stats' ? 'block' : 'none', height: '100%' }}>
          <DailyStatsTab />
        </div>
        
        {/* Other tabs only exist AFTER the boot sequence reaches them OR if the user clicks them early */}
        {(bootedTabs.includes('foodlog') || activeTab === 'foodlog') && (
          <div style={{ display: activeTab === 'foodlog' ? 'block' : 'none', height: '100%' }}>
            <FoodLogTab />
          </div>
        )}
        
        {(bootedTabs.includes('weight') || activeTab === 'weight') && (
          <div style={{ display: activeTab === 'weight' ? 'block' : 'none', height: '100%' }}>
            <WeightTab />
          </div>
        )}
        
        {(bootedTabs.includes('workout') || activeTab === 'workout') && (
          <div style={{ display: activeTab === 'workout' ? 'block' : 'none', height: '100%' }}>
            <WorkoutTab />
          </div>
        )}
        
      </div>
    </div>
  );
}