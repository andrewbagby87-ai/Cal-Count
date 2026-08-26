import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'wouter';
import UserSettings from '../components/UserSettings';
import DailyStatsTab from '../components/DailyStatsTab';
import FoodLogTab from '../components/FoodLogTab';
import WeightTab from '../components/WeightTab';
import WorkoutTab from '../components/WorkoutTab';
import { preloadWeeklyMeals } from '../components/AddPreviousFoodModal';
import './Dashboard.css';

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState<'account' | 'preferences' | null>(null);
  
  // NEW: State to manage the isolated Health Logs view
  const [healthTab, setHealthTab] = useState<'weight' | 'workout' | null>(null);
  
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
  const { user, userProfile, loading, logout } = useAuth();
  
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

  // Preload the weekly meals silently in the background
  useEffect(() => {
    if (user?.uid) {
      preloadWeeklyMeals(user.uid);
    }
  }, [user]);

  // 2. THE WATERFALL BOOT SEQUENCE
  useEffect(() => {
    let isMounted = true;

    const runBootSequence = async () => {
      // Wait 800ms, then silently boot the Food Log
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setBootedTabs(prev => prev.includes('foodlog') ? prev : [...prev, 'foodlog']);
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

  // NEW: Isolate Health Logs in its own full-screen view
  if (healthTab) {
    return (
      <div className="dashboard">
        <header className="dashboard-header" style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => setHealthTab(null)} 
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 10px 0 0', color: '#1e293b' }}
          >
            ←
          </button>
          <h1 style={{ margin: 0 }}>Health Logs</h1>
        </header>

        <nav style={{ 
          display: 'flex', position: 'relative', backgroundColor: '#f8fafc', 
          border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '4px', 
          margin: '0 1rem 1rem 1rem', flexShrink: 0 
        }}>
          {/* Animated Background Pill */}
          <div style={{
            position: 'absolute', top: '4px', bottom: '4px', left: '4px',
            width: 'calc(50% - 4px)', backgroundColor: '#2563eb', borderRadius: '0.5rem',
            transition: 'transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)',
            transform: healthTab === 'weight' ? 'translateX(0)' : 'translateX(100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)', zIndex: 1
          }} />

          <button
            onClick={() => setHealthTab('weight')}
            style={{
              flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
              color: healthTab === 'weight' ? '#fff' : '#64748b',
              background: 'transparent', border: 'none', zIndex: 2, cursor: 'pointer',
              transition: 'color 0.25s ease'
            }}
          >
            Weight
          </button>
          <button
            onClick={() => setHealthTab('workout')}
            style={{
              flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
              color: healthTab === 'workout' ? '#fff' : '#64748b',
              background: 'transparent', border: 'none', zIndex: 2, cursor: 'pointer',
              transition: 'color 0.25s ease'
            }}
          >
            Workouts
          </button>
        </nav>

        <div className="dashboard-content" style={{ overflowY: 'auto' }}>
          {healthTab === 'weight' && <WeightTab />}
          {healthTab === 'workout' && <WorkoutTab />}
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (contentRef.current && contentRef.current.scrollTop <= 5) {
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
      setPullDistance(Math.min(distance, 120)); 
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 75) {
      setRefreshKey(prev => prev + 1); 
    }
    setStartY(0);
    setPullDistance(0); 
  };

  const handleTouchCancel = () => {
    setStartY(0);
    setPullDistance(0);
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
            👤 {userProfile?.name || 'Account'} {userProfile?.isAdmin && <img src="./shield.png" alt="Admin Icon" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />} ▾
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
                  setHealthTab('weight'); // Opens the new isolated view
                }}
              >
                ❤️ Health Logs
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
              {userProfile?.isAdmin && (
                <Link 
                  to="/admin" 
                  style={{ 
                    display: 'block', 
                    padding: '0.75rem 1rem', 
                    color: '#1e293b', 
                    textDecoration: 'none',
                    fontWeight: 500,
                    textAlign: 'left' // Ensures it matches your button alignment
                  }}
                  className="dropdown-item"
                  onClick={() => setShowDropdown(false)} // Closes dropdown on click
                >
                  🛡️ Admin Dashboard
                </Link>
              )}
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

      <nav style={{ 
        display: 'flex', position: 'relative', backgroundColor: '#f8fafc', 
        border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '4px', 
        margin: '0 1rem 1rem 1rem', flexShrink: 0 
      }}>
        {/* Animated Background Pill */}
        <div style={{
          position: 'absolute', top: '4px', bottom: '4px', left: '4px',
          width: 'calc(50% - 4px)', backgroundColor: '#2563eb', borderRadius: '0.5rem',
          transition: 'transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transform: activeTab === 'stats' ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)', zIndex: 1
        }} />

        <button
          onClick={() => setActiveTab('stats')}
          style={{
            flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
            color: activeTab === 'stats' ? '#fff' : '#64748b',
            background: 'transparent', border: 'none', zIndex: 2, cursor: 'pointer',
            transition: 'color 0.25s ease'
          }}
        >
          Daily Stats
        </button>
        <button
          onClick={() => setActiveTab('foodlog')}
          style={{
            flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
            color: activeTab === 'foodlog' ? '#fff' : '#64748b',
            background: 'transparent', border: 'none', zIndex: 2, cursor: 'pointer',
            transition: 'color 0.25s ease'
          }}
        >
          Food Log
        </button>
      </nav>

      <div 
        className="dashboard-content" 
        style={{ 
          position: 'relative', 
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : 'none', 
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none',
          overflowY: 'auto',
          overscrollBehaviorY: 'contain' 
        }}
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel} 
      >
        {/* Visual Pull Indicator */}
        {pullDistance > 0 && (
          <div style={{ position: 'absolute', top: -30, left: 0, right: 0, textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, zIndex: 10 }}>
            {pullDistance > 75 ? '⬇️ Release to refresh' : '⬇️ Pull to refresh'}
          </div>
        )}
        
        {/* 3. STAGGERED TAB RENDER AREA */}
        <div style={activeTab === 'stats' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
          <DailyStatsTab key={`stats-${refreshKey}`} />
        </div>
        
        {(bootedTabs.includes('foodlog') || activeTab === 'foodlog') && (
          <div style={activeTab === 'foodlog' ? { height: '100%' } : { position: 'absolute', visibility: 'hidden', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
            <FoodLogTab key={`foodlog-${refreshKey}`} />
          </div>
        )}
        
      </div>
    </div>
  );
}