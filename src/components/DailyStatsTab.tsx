import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayFoodLogs, getDayWorkoutLogs, getAllWeightLogs, getHealthLogs } from '../services/database';
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
  start.setDate(date.getDate() - date.getDay()); // Start on Sunday
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

// --- Sub-Components ---

const NutrientCircle = ({ label, consumed, budget, unit, color = "#2563eb" }: { label: string, consumed: number, budget: number, unit: string, color?: string }) => {
  const percentage = Math.min(Math.round((consumed / (budget || 1)) * 100), 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="nutrient-circle-container">
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
          <span className="circle-val">{Math.round(consumed)}</span>
          <span className="circle-unit">/ {budget}{unit}</span>
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
  const [todayWeight, setTodayWeight] = useState<WeightLog | null>(null);
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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

  const handleGoToToday = () => {
    setViewDate(new Date());
  };

  // Load Summaries for Weekly/Monthly navigator
  useEffect(() => {
    const loadNavigatorStats = async () => {
      if (!user || viewMode === 'none') return;
      const datesToFetch = viewMode === 'monthly' ? getMonthDates(viewDate) : getWeekDates(viewDate);
      const summaries: Record<string, number> = {};

      await Promise.all(datesToFetch.map(async (date) => {
        const dStr = getDateString(date);
        const [foods, workouts] = await Promise.all([
          getDayFoodLogs(user.uid, dStr),
          getDayWorkoutLogs(user.uid, dStr)
        ]);
        
        const consumed = foods.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        const burned = workouts.reduce((sum, log) => sum + log.caloriesBurned, 0);
        const budget = (userProfile?.caloriesBudget || 0) + burned;
        summaries[dStr] = budget > 0 ? (consumed / budget) : 0;
      }));

      setNavigatorSummaries(summaries);
    };

    loadNavigatorStats();
  }, [user, viewDate, viewMode, userProfile?.caloriesBudget]);

  // Load Detailed Daily Data
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const dateStr = getDateString(viewDate);
        const [foods, workouts, manualWeights, healthLogsRaw] = await Promise.all([
          getDayFoodLogs(user.uid, dateStr),
          getDayWorkoutLogs(user.uid, dateStr),
          getAllWeightLogs(user.uid),
          getHealthLogs(user.uid)
        ]);
        
        setFoodLogs(foods || []);
        setWorkoutLogs(workouts || []);
        
        const todaysManualWeights = (manualWeights || []).filter(w => w.date === dateStr).map(w => ({
          ...w,
          timestamp: w.timestamp || new Date(`${w.date}T${w.time}`).getTime()
        }));

        const todaysHealthWeights: any[] = [];
        healthLogsRaw.forEach((log: any) => {
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
  const caloriesBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
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
          {/* MONTH HEADER: Shows the month name only in Monthly View */}
          {viewMode === 'monthly' && (
            <div className="month-header">
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
          <div className="stats-card">
            <div className="stat-item hero-stat">
              <div className="stat-header-row">
                <span className="stat-label">Calories</span>
                <span className={`remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
                  {remaining >= 0 ? '+' : ''}{Math.round(remaining)} remaining
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
              </div>
              <div className="stat-value full-width">
                <span className="consumed">{Math.round(caloriesConsumed)}</span>
                <span className="separator">/</span>
                <span className="budget">{totalBudget} kcal</span>
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