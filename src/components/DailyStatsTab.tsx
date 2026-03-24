// src/components/DailyStatsTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayFoodLogs, getDayWorkoutLogs, getAllWeightLogs, getHealthLogs, getSyncedHealthWorkouts, getIgnoredWorkouts, getDoneLoggingDates } from '../services/database';
import { FoodLog, WorkoutLog, WeightLog } from '../types';
import './DailyStatsTab.css';

// --- Helper Functions ---

const formatTime12Hour = (timeStr: string) => {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const parseSafeDate = (dateVal: any, fallbackTimestamp: number) => {
  if (!dateVal) return new Date(fallbackTimestamp);
  if (typeof dateVal === 'number') return new Date(dateVal);
  let dStr = String(dateVal);
  let d = new Date(dStr);
  if (!isNaN(d.getTime())) return d;
  dStr = dStr.replace(' ', 'T').replace(' -', '-').replace(' +', '+');
  d = new Date(dStr);
  if (!isNaN(d.getTime())) return d;
  return new Date(fallbackTimestamp);
};

const formatSyncDate = (dateObj: Date) => {
  if (isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}`,
    timeMs: dateObj.getTime()
  };
};

const parseUnit = (u: string) => {
  if (!u) return 'lbs';
  return u.toLowerCase().includes('kg') ? 'kg' : 'lbs';
};

const getWeekDates = (date: Date) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const getMonthDates = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  
  const dates = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const isWorkoutOnDate = (rawDate: any, targetDateStr: string) => {
  if (!rawDate) return false;
  if (typeof rawDate === 'string') {
    const prefix = rawDate.split(' ')[0].split('T')[0];
    return prefix === targetDateStr;
  }
  const d = new Date(rawDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === targetDateStr;
};

// --- Sub-Components ---

const NutrientCircle = ({ label, consumed, budget, unit, color = "#2563eb" }: { label: string, consumed: number, budget: number, unit: string, color?: string }) => {
  const [showRemaining, setShowRemaining] = useState(false);
  const percentage = Math.min(Math.round((consumed / (budget || 1)) * 100), 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const diff = Math.round((budget || 0) - consumed);
  const isOver = diff < 0;

  return (
    <div className="nutrient-circle-container" onClick={() => setShowRemaining(!showRemaining)} style={{ cursor: 'pointer' }} title="Click to toggle text">
      <div className="svg-wrapper">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle 
            cx="42" cy="42" r={radius} 
            fill="none" 
            stroke={color} 
            strokeWidth="6" 
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 42 42)" 
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        <div className="circle-inner-text">
          {showRemaining ? (
             <>
               <span className="circle-val" style={{ color: isOver ? (label === 'Protein' || label === 'Fiber' ? '#10b981' : '#ef4444') : undefined, fontSize: isOver ? '1.1rem' : undefined }}>
                 {Math.abs(diff)}<span style={{ fontSize: '0.75em', marginLeft: '1px' }}>{unit}</span>
               </span>
               <span className="circle-unit">{isOver ? 'over' : 'left'}</span>
             </>
          ) : (
             <>
               <span className="circle-val">
                 {Math.round(consumed)}<span style={{ fontSize: '0.75em', marginLeft: '1px' }}>{unit}</span>
               </span>
               <span className="circle-unit">/ {budget}{unit}</span>
             </>
          )}
        </div>
      </div>
      <span className="circle-name">{label}</span>
    </div>
  );
};

// --- Main Component ---

export default function DailyStatsTab() {
  const { user, userProfile } = useAuth();
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [syncedWorkouts, setSyncedWorkouts] = useState<any[]>([]);
  const [todayWeight, setTodayWeight] = useState<WeightLog | null>(null);
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  const [showCalRemaining, setShowCalRemaining] = useState(false);
  const [streak, setStreak] = useState(0);

  // 1. Create the reference point for scrolling to the top
  const topRef = useRef<HTMLDivElement>(null);

  // 2. Scroll to the reference point instantly when the tab loads
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);

  const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrevDay = () => {
    const prev = new Date(viewDate);
    prev.setDate(prev.getDate() - 1);
    setViewDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + 1);
    setViewDate(next);
  };

  const handleGoToToday = () => setViewDate(new Date());

  const handlePrevMonth = () => {
    const targetDate = new Date(viewDate);
    targetDate.setDate(1);
    targetDate.setMonth(viewDate.getMonth() - 1);
    const today = new Date();
    if (targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear()) {
      setViewDate(new Date());
    } else {
      setViewDate(targetDate);
    }
  };

  const handleNextMonth = () => {
    const targetDate = new Date(viewDate);
    targetDate.setDate(1);
    targetDate.setMonth(viewDate.getMonth() + 1);
    const today = new Date();
    if (targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear()) {
      setViewDate(new Date());
    } else {
      setViewDate(targetDate);
    }
  };

  // --- Calculate Streak from Firebase ---
  useEffect(() => {
    const fetchStreak = async () => {
      if (!user) return;
      try {
        const doneDates = await getDoneLoggingDates(user.uid);
        let currentStreak = 0;
        const today = new Date();
        const todayStr = getDateString(today);
        
        // 1. Check if today is marked done
        if (doneDates[todayStr]) {
           currentStreak++;
        }
        
        // 2. Count backward from yesterday
        let checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (true) {
          const checkStr = getDateString(checkDate);
          if (doneDates[checkStr]) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break; // Streak broken!
          }
        }
        setStreak(currentStreak);
      } catch (e) {
        console.error("Failed to fetch streak", e);
      }
    };

    fetchStreak();
  }, [user, viewDate]); 

  useEffect(() => {
    const loadNavigatorStats = async () => {
      if (!user || viewMode === 'none') return;
      const datesToFetch = viewMode === 'monthly' ? getMonthDates(viewDate) : getWeekDates(viewDate);
      const summaries: Record<string, number> = {};

      const [allHealthWorkouts, ignoredWorkouts] = await Promise.all([
        getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]),
        getIgnoredWorkouts(user.uid).catch(() => [] as string[]) 
      ]);

      await Promise.all(datesToFetch.map(async (date) => {
        const dStr = getDateString(date);
        const [foods, workouts] = await Promise.all([
          getDayFoodLogs(user.uid, dStr).catch(() => []),
          getDayWorkoutLogs(user.uid, dStr).catch(() => [])
        ]);

        const todaysSynced = allHealthWorkouts.filter((w: any) => {
          const isToday = isWorkoutOnDate(w.start || w.date || w.timestamp, dStr);
          const isIgnored = ignoredWorkouts.includes(String(w.id || w.dbId)); 
          return isToday && !isIgnored; 
        });

        let dailyBurned = todaysSynced.reduce((sum, w) => {
          if (w.activeEnergyBurned && w.activeEnergyBurned.units === 'kcal') {
             return sum + Math.round(w.activeEnergyBurned.qty);
          }
          return sum;
        }, 0);
        
        const manualBurned = workouts.reduce((sum, log) => sum + log.caloriesBurned, 0);
        dailyBurned += manualBurned;

        const consumed = foods.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        const budget = (userProfile?.caloriesBudget || 0) + dailyBurned;
        summaries[dStr] = budget > 0 ? (consumed / budget) : 0;
      }));

      setNavigatorSummaries(summaries);
    };

    loadNavigatorStats();
  }, [user, viewDate, viewMode, userProfile?.caloriesBudget]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const dateStr = getDateString(viewDate);
        
        const [foods, workouts, manualWeights, healthLogsRaw, syncedWorkoutsRaw, ignoredWorkouts] = await Promise.all([
          getDayFoodLogs(user.uid, dateStr).catch(() => []),
          getDayWorkoutLogs(user.uid, dateStr).catch(() => []),
          getAllWeightLogs(user.uid).catch(() => []),
          getHealthLogs(user.uid).catch(() => []), 
          getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]),
          getIgnoredWorkouts(user.uid).catch(() => [] as string[])
        ]);
        
        setFoodLogs(foods || []);
        setWorkoutLogs(workouts || []);

        const todaysSyncedWorkouts = (syncedWorkoutsRaw || []).filter((w: any) => {
          const isToday = isWorkoutOnDate(w.start || w.date || w.timestamp, dateStr);
          const isIgnored = (ignoredWorkouts || []).includes(String(w.id || w.dbId)); 
          return isToday && !isIgnored; 
        });
        
        setSyncedWorkouts(todaysSyncedWorkouts);
        
        const todaysManualWeights = (manualWeights || []).filter(w => w.date === dateStr).map(w => ({
          ...w,
          timestamp: w.timestamp || new Date(`${w.date}T${w.time}`).getTime()
        }));

        const todaysHealthWeights: any[] = [];
        
        const safeHealthLogsRaw = Array.isArray(healthLogsRaw) ? healthLogsRaw : [];
        
        safeHealthLogsRaw.forEach((log: any) => {
          const baseTimestampObj = parseSafeDate(log.timestamp, Date.now());
          const baseTimestamp = baseTimestampObj.getTime();

          const processMetric = (metric: any) => {
            if (metric.name === 'weight_body_mass' && Array.isArray(metric.data)) {
              metric.data.forEach((entry: any) => {
                const dateObj = parseSafeDate(entry.date || log.date || log.timestamp, baseTimestamp);
                const parsedDate = formatSyncDate(dateObj);
                if (parsedDate && parsedDate.dateStr === dateStr) {
                  todaysHealthWeights.push({
                    date: parsedDate.dateStr,
                    time: parsedDate.timeStr,
                    weight: Number(entry.qty || entry.value || 0),
                    unit: parseUnit(metric.units || log.units),
                    timestamp: parsedDate.timeMs,
                    isSynced: true
                  });
                }
              });
            }
          };

          if (log.name === 'weight_body_mass') {
            if (Array.isArray(log.data)) {
              processMetric(log);
            } else {
              const dateObj = parseSafeDate(log.date || log.timestamp, baseTimestamp);
              const parsedDate = formatSyncDate(dateObj);
              if (parsedDate && parsedDate.dateStr === dateStr) {
                todaysHealthWeights.push({
                  date: parsedDate.dateStr,
                  time: parsedDate.timeStr,
                  weight: Number(log.qty || log.value || log.weight || 0),
                  unit: parseUnit(log.units || log.unit),
                  timestamp: parsedDate.timeMs,
                  isSynced: true
                });
              }
            }
          } else if (Array.isArray(log.metrics)) {
            log.metrics.forEach(processMetric);
          } else if (log.data && Array.isArray(log.data.metrics)) {
            log.data.metrics.forEach(processMetric);
          }
        });

        const combinedTodaysWeights = [...todaysManualWeights, ...todaysHealthWeights].filter(w => w.weight > 0);
        if (combinedTodaysWeights.length > 0) {
          combinedTodaysWeights.sort((a, b) => b.timestamp - a.timestamp);
          setTodayWeight(combinedTodaysWeights[0]);
        } else {
          setTodayWeight(null);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, viewDate]);

  const todayStr = getDateString(new Date());
  const viewStr = getDateString(viewDate);
  const isToday = todayStr === viewStr;

  const caloriesConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
  
  const manualBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const healthBurned = syncedWorkouts.reduce((sum, w) => {
    if (w.activeEnergyBurned && w.activeEnergyBurned.units === 'kcal') {
       return sum + Math.round(w.activeEnergyBurned.qty);
    }
    return sum;
  }, 0);
  const caloriesBurned = manualBurned + healthBurned;

  const totalBudget = (userProfile?.caloriesBudget || 0) + caloriesBurned;
  const remaining = totalBudget - caloriesConsumed;
  const percentage = Math.round((caloriesConsumed / (totalBudget || 1)) * 100);

  const fatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0);
  const saturatedFatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0);
  const carbsConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0);
  const fiberConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? log.fiber ?? 0), 0);
  const sugarConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0);
  const proteinConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? log.protein ?? 0), 0);

  return (
    <div className="daily-stats">
      
      {/* Invisible anchor point for auto-scrolling to the top */}
      <div ref={topRef} />
      
      <div className="date-navigator">
        <button className="nav-btn" onClick={handlePrevDay}>←</button>
        <div className="date-display" onClick={handleGoToToday} style={{ cursor: 'pointer' }}>
          <h2>{isToday ? "Today's Summary" : "Daily Summary"}</h2>
          <p className="date">
            {viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className="nav-btn" onClick={handleNextDay}>→</button>
      </div>

      <div className="view-toggle-container">
        <button 
          className="btn-weekly-toggle" 
          onClick={() => setViewMode(viewMode === 'none' ? 'weekly' : 'none')}
        >
          {viewMode === 'none' ? '▼ Show Navigator' : '▲ Hide Navigator'}
        </button>
        
        {viewMode !== 'none' && (
          <button 
            className="btn-mode-switch"
            onClick={() => setViewMode(viewMode === 'weekly' ? 'monthly' : 'weekly')}
          >
            Switch to {viewMode === 'weekly' ? 'Month' : 'Week'} View
          </button>
        )}
      </div>

      {viewMode !== 'none' && (
        <div className={`navigator-container ${viewMode}-view`}>
          {viewMode === 'monthly' && (
            <div className="month-header">
              <button className="nav-btn small-nav-btn" onClick={handlePrevMonth}>←</button>
              <span>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <button className="nav-btn small-nav-btn" onClick={handleNextMonth}>→</button>
            </div>
          )}
          
          <div className="navigator-grid">
            {(viewMode === 'weekly' ? getWeekDates(viewDate) : getMonthDates(viewDate)).map((date) => {
              const dStr = getDateString(date);
              const isSelected = dStr === viewStr;
              const isActualToday = dStr === todayStr;
              const isDifferentMonth = date.getMonth() !== viewDate.getMonth();
              const progress = navigatorSummaries[dStr] || 0;
              
              return (
                <button 
                  key={dStr} 
                  className={`week-day-btn ${isSelected ? 'selected' : ''} ${isActualToday ? 'is-today' : ''} ${isDifferentMonth ? 'diff-month' : ''}`}
                  onClick={() => setViewDate(date)}
                >
                  <span className="day-name">{date.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                  <div className="day-circle">
                     <div className="day-progress" style={{ height: `${Math.min(progress * 100, 100)}%`, backgroundColor: progress > 1 ? '#ef4444' : '#2563eb' }} />
                     <span className="day-number">{date.getDate()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading stats...</div>
      ) : (
        <>
          {/* Streak Banner */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', marginTop: viewMode === 'none' ? '1rem' : '0' }}>
            <div style={{ 
              background: streak > 0 ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#f1f5f9', 
              color: streak > 0 ? 'white' : '#64748b', 
              padding: '0.6rem 1.5rem', 
              borderRadius: '2rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: streak > 0 ? '0 4px 6px -1px rgba(234, 88, 12, 0.3)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {streak > 0 ? '🔥' : '⏳'} {streak} Day Streak
            </div>
          </div>

          <div className="stats-card">
            <div className="stat-item hero-stat" onClick={() => setShowCalRemaining(!showCalRemaining)} style={{ cursor: 'pointer' }} title="Click to toggle text">
              <div className="stat-header-row">
                <span className="stat-label">Calories</span>
                <span 
                  className={`remaining ${remaining >= 0 ? 'positive' : 'negative'}`}
                  style={Math.round(remaining) === 0 ? { color: '#94a3b8' } : {}}
                >
                  {showCalRemaining ? (
                     `${Math.round(caloriesConsumed)} eaten`
                  ) : (
                     Math.round(remaining) === 0 
                       ? '0 left' 
                       : `${remaining > 0 ? '+' : ''}${Math.abs(Math.round(remaining))} ${remaining < 0 ? 'over' : 'remaining'}`
                  )}
                </span>
              </div>
              
              {/* ALWAYS GREEN PROGRESS BAR */}
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${Math.min(percentage, 100)}%`, 
                    background: '#16a34a' 
                  }}
                ></div>
              </div>
              
              {/* TEXT ADAPTS TO EXACTLY 0 (GRAY) OR OVER (RED) */}
              <div className="stat-value full-width">
                {showCalRemaining ? (
                   <>
                     <span className="consumed" style={{ color: Math.round(remaining) === 0 ? '#94a3b8' : (remaining < 0 ? '#ef4444' : undefined) }}>
                       {Math.round(remaining) === 0 ? '0' : `${remaining > 0 ? '+' : ''}${Math.abs(Math.round(remaining))}`} <span style={{ fontSize: '1.25rem' }}>kcal</span>
                     </span>
                     {Math.round(remaining) !== 0 && (
                       <span className="budget" style={{ color: remaining < 0 ? '#ef4444' : undefined }}> {remaining < 0 ? 'over' : 'left'}</span>
                     )}
                   </>
                ) : (
                   <>
                     <span className="consumed" style={{ color: Math.round(remaining) === 0 ? '#94a3b8' : (remaining < 0 ? '#ef4444' : undefined) }}>
                       {Math.round(caloriesConsumed)} <span style={{ fontSize: '1.25rem' }}>kcal</span>
                     </span>
                     <span className="separator" style={{ color: Math.round(remaining) === 0 ? '#94a3b8' : undefined }}>/</span>
                     <span className="budget" style={{ color: Math.round(remaining) === 0 ? '#94a3b8' : undefined }}>
                       {totalBudget} kcal
                       {caloriesBurned > 0 && (
                         <span style={{ fontSize: '1rem', color: '#f97316', marginLeft: '0.5rem', fontWeight: 600 }}>(+{caloriesBurned} 🔥)</span>
                       )}
                     </span>
                   </>
                )}
              </div>
            </div>

            <div className="nutrients-grid">
              {userProfile?.trackFat && <NutrientCircle label="Fat" consumed={fatConsumed} budget={userProfile.fatBudget || 0} unit="g" color="#f59e0b" />}
              {userProfile?.trackSaturatedFat && <NutrientCircle label="Sat Fat" consumed={saturatedFatConsumed} budget={userProfile.saturatedFatBudget || 0} unit="g" color="#dc2626" />}
              {userProfile?.trackCarbs && <NutrientCircle label="Carbs" consumed={carbsConsumed} budget={userProfile.carbsBudget || 0} unit="g" color="#10b981" />}
              {userProfile?.trackFiber && <NutrientCircle label="Fiber" consumed={fiberConsumed} budget={userProfile.fiberBudget || 0} unit="g" color="#8b5cf6" />}
              {userProfile?.trackSugar && <NutrientCircle label="Sugar" consumed={sugarConsumed} budget={userProfile.sugarBudget || 0} unit="g" color="#ec4899" />}
              {userProfile?.trackProtein && <NutrientCircle label="Protein" consumed={proteinConsumed} budget={userProfile.proteinBudget || 0} unit="g" color="#3b82f6" />}
            </div>
          </div>

          <div className="dashboard-bottom-row">
            <div className="stats-card half-width-card">
              <div className="stat-item">
                <span className="stat-label">Weight</span>
                {todayWeight ? (
                  <div className="weight-highlight">
                    <span className="weight-number">{todayWeight.weight}</span>
                    <span className="weight-unit">{todayWeight.unit}</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                      at {formatTime12Hour(todayWeight.time)}
                    </span>
                  </div>
                ) : (
                  <div className="empty-weight"><span>No weight logged</span></div>
                )}
              </div>
            </div>

            {caloriesBurned > 0 && (
              <div className="stats-card half-width-card">
                <div className="stat-item">
                  <span className="stat-label">Calories Burned</span>
                  <div className="weight-highlight">
                    <span className="burned" style={{ fontSize: '2rem', fontWeight: 700, color: '#f97316' }}>
                      {caloriesBurned}
                    </span>
                    <span className="weight-unit">kcal</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}