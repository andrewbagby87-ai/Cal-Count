import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserSettings from '../components/UserSettings';
import DailyStatsTab from '../components/DailyStatsTab';
import FoodLogTab from '../components/FoodLogTab';
import WeightTab from '../components/WeightTab';
import WorkoutTab from '../components/WorkoutTab';
import './Dashboard.css';

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState<'account' | 'preferences' | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  
  // 1. Tell React to ONLY mount the Daily Stats tab when the app first opens
  const [bootedTabs, setBootedTabs] = useState<string[]>(['stats']);
  
  // Pull-to-refresh state
  const [refreshKey, setRefreshKey] = useState(0);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
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
    return <UserSettings onBack={() => setShowSettings(null)} mode={showSettings} />;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only trigger pull-to-refresh if we are at the very top of the scroll view
    if (contentRef.current && contentRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    } else {
      setStartY(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    // Only register if pulling downwards
    if (distance > 0) {
      setPullDistance(Math.min(distance, 120)); // Cap the visual stretch
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 75) {
      setRefreshKey(prev => prev + 1); // Trigger the refresh!
    }
    setStartY(0);
    setPullDistance(0); // Snap back
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
                  setShowSettings('preferences');
                }}
              >
                📊 Preferences
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  setShowSettings('account');
                }}
              >
                ⚙️ Account
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

      <div 
        className="dashboard-content" 
        style={{ 
          position: 'relative', 
          // FIX: Use 'none' when not pulling to prevent trapping fixed pop-ups
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : 'none', 
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none',
          overflowY: 'auto'
        }}
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Visual Pull Indicator */}
        {pullDistance > 0 && (
          <div style={{ position: 'absolute', top: -30, left: 0, right: 0, textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, zIndex: 10 }}>
            {pullDistance > 75 ? '⬇️ Release to refresh' : '⬇️ Pull to refresh'}
          </div>
        )}
        
        {/* 3. STAGGERED TAB RENDER AREA */}
        {/* Daily Stats is always in the DOM immediately */}
        <div style={activeTab === 'stats' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
          <DailyStatsTab key={`stats-${refreshKey}`} />
        </div>
        
        {/* Other tabs only exist AFTER the boot sequence reaches them OR if the user clicks them early */}
        {(bootedTabs.includes('foodlog') || activeTab === 'foodlog') && (
          <div style={activeTab === 'foodlog' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
            <FoodLogTab key={`foodlog-${refreshKey}`} />
          </div>
        )}
        
        {(bootedTabs.includes('weight') || activeTab === 'weight') && (
          <div style={activeTab === 'weight' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
            <WeightTab key={`weight-${refreshKey}`} />
          </div>
        )}
        
        {(bootedTabs.includes('workout') || activeTab === 'workout') && (
          <div style={activeTab === 'workout' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
            <WorkoutTab key={`workout-${refreshKey}`} />
          </div>
        )}
        
      </div>
    </div>
  );
}