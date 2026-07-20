// src/components/DailyStatsTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayFoodLogs, getDayWorkoutLogs, getAllWeightLogs, getHealthLogs, getSyncedHealthWorkouts, getIgnoredWorkouts, getDoneLoggingDates, getWeeklyFoodLogs, getWeeklyWorkoutLogs, toggleIgnoredWorkout, deleteWorkoutLog} from '../services/database';
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
  // Shift the start date to 3 days before the currently viewed date
  start.setDate(date.getDate() - 3);
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
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

// --- TIME MACHINE BUDGET LOOKUP ---
const getActiveBudgets = (userProfile: any, targetDateStr: string) => {
  if (!userProfile) return null;
  if (!userProfile.goalHistory || userProfile.goalHistory.length === 0) return userProfile;

  let activeGoals = null; 
  for (const entry of userProfile.goalHistory) {
    if (entry.date <= targetDateStr) {
      activeGoals = entry;
    } else {
      break; 
    }
  }
  
  if (!activeGoals) {
    activeGoals = userProfile.goalHistory[0];
  }
  
  return { ...userProfile, ...activeGoals };
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
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [syncedWorkouts, setSyncedWorkouts] = useState<any[]>([]);
  const [todayWeight, setTodayWeight] = useState<WeightLog | null>(null);
  const [todaySteps, setTodaySteps] = useState<number>(0);
  const [todaySleep, setTodaySleep] = useState<number>(0);
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, { progress: number, color: string }>>({});
  const [loading, setLoading] = useState(true);
  const todayCache = useRef<any>(null);
  const [showCalRemaining, setShowCalRemaining] = useState(false);
  const [streak, setStreak] = useState(0);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isBackgroundRefresh = useRef(false);
  
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleToggleIgnoreWorkout = async (workoutId: string, isCurrentlyIgnored: boolean) => {
    if (!user?.uid) return;
    try {
      await toggleIgnoredWorkout(user.uid, workoutId, !isCurrentlyIgnored);
      
      // NEW: Broadcast the change to the Workout Tab
      window.dispatchEvent(new Event('workoutDataChanged'));
      setRefreshTrigger(prev => prev + 1); 
    } catch (error) {
      console.error('Failed to toggle workout:', error);
    }
  };

  const handleDeleteManualWorkout = async (workoutId: string) => {
    if (!user?.uid || !window.confirm('Are you sure you want to delete this workout?')) return;
    try {
      await deleteWorkoutLog(workoutId);
      
      // NEW: Broadcast the change to the Workout Tab
      window.dispatchEvent(new Event('workoutDataChanged'));
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete manual workout:', error);
    }
  };
  
  useEffect(() => {
    const handleUpdate = () => {
      isBackgroundRefresh.current = true;
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('foodDataChanged', handleUpdate);
    window.addEventListener('workoutDataChanged', handleUpdate);
    window.addEventListener('dayCompletedChanged', handleUpdate);
    return () => {
      window.removeEventListener('foodDataChanged', handleUpdate);
      window.removeEventListener('workoutDataChanged', handleUpdate);
      window.removeEventListener('dayCompletedChanged', handleUpdate);
    };
  }, []);

  const topRef = useRef<HTMLDivElement>(null);

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

  const handleGoToToday = () => setViewDate(new Date());

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextWeek();
    } else if (isRightSwipe) {
      handlePrevWeek();
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(viewDate);
    // Jump exactly 7 days backward
    prev.setDate(prev.getDate() - 7);
    setViewDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(viewDate);
    // Jump exactly 7 days forward
    next.setDate(next.getDate() + 7);
    setViewDate(next);
  };

  useEffect(() => {
    const fetchStreak = async () => {
      if (!user?.uid) return;
      try {
        const doneDates = await getDoneLoggingDates(user.uid);
        let currentStreak = 0;
        const today = new Date();
        const todayStr = getDateString(today);
        
        if (doneDates[todayStr]) {
           currentStreak++;
        }
        
        let checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (true) {
          const checkStr = getDateString(checkDate);
          if (doneDates[checkStr]) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break; 
          }
        }
        setStreak(currentStreak);
      } catch (e) {
        console.error("Failed to fetch streak", e);
      }
    };

    fetchStreak();
  }, [user?.uid, viewDate, refreshTrigger]); 

useEffect(() => {
    const loadNavigatorStats = async () => {
      if (!user?.uid) return;
      const datesToFetch = getWeekDates(viewDate);
      const summaries: Record<string, { progress: number, color: string }> = {};

      // 1. Calculate the start and end dates for the current week
      const startDateStr = getDateString(datesToFetch[0]);
      const endDateStr = getDateString(datesToFetch[6]);

      // 2. Fetch ALL data for the entire week ONCE in the background
      const [allHealthWorkouts, ignoredWorkouts, weeklyFoods, weeklyWorkouts] = await Promise.all([
        getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]),
        getIgnoredWorkouts(user.uid).catch(() => [] as string[]),
        getWeeklyFoodLogs(user.uid, startDateStr, endDateStr).catch(() => []),       // <--- Bulk fetch
        getWeeklyWorkoutLogs(user.uid, startDateStr, endDateStr).catch(() => []) // <--- Bulk fetch
      ]);

      // 3. Process the data locally for each day instead of re-fetching
      datesToFetch.forEach((date) => {
        const dStr = getDateString(date);
        
        // Filter our bulk arrays for just this day
        const dayFoods = weeklyFoods.filter((log: any) => log.date === dStr);
        const manualWorkouts = weeklyWorkouts.filter((log: any) => log.date === dStr);

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
        
        if (manualWorkouts) {
          dailyBurned += manualWorkouts.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0);
        }

        const consumed = dayFoods.reduce((sum: number, log: any) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        
        const activeDayProfile = getActiveBudgets(userProfile, dStr);
        const budget = (activeDayProfile?.caloriesBudget || 0) + dailyBurned;
        
        let progress = 0;
        let color = '#10b981'; 
        
        if (budget > 0) {
          progress = consumed / budget;
          const remaining = Math.round(budget - consumed);
          
          if (remaining < 0) color = '#ef4444'; 
          else if (remaining === 0 && consumed > 0) color = '#2563eb'; 
        } else if (consumed > 0) {
          progress = 1;
          color = '#ef4444'; 
        }
        
        summaries[dStr] = { progress, color };
      });

      setNavigatorSummaries(summaries);
    };

    loadNavigatorStats();
  }, [user?.uid, viewDate, userProfile, refreshTrigger]);

useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) return;
      
      const dateStr = getDateString(viewDate);
      const todayStr = getDateString(new Date());

      // Instant restore if navigating back to today
      if (dateStr === todayStr && todayCache.current) {
        setFoodLogs(todayCache.current.foods);
        setWorkoutLogs(todayCache.current.workouts);
        setSyncedWorkouts(todayCache.current.syncedWorkouts);
        setTodayWeight(todayCache.current.weight);
        setTodaySteps(todayCache.current.steps || 0);
        setTodaySleep(todayCache.current.sleep || 0);
        if (!isBackgroundRefresh.current) setLoading(false);
      } else if (!isBackgroundRefresh.current) {
        setLoading(true);
      }
      
      try {
        const [foods, workouts, manualWeights, healthLogsRaw, syncedWorkoutsRaw, ignoredWorkouts, todayFoods, todayWorkouts] = await Promise.all([
          getDayFoodLogs(user.uid, dateStr).catch(() => []),
          getDayWorkoutLogs(user.uid, dateStr).catch(() => []),
          getAllWeightLogs(user.uid).catch(() => []),
          getHealthLogs(user.uid).catch(() => []), 
          getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]),
          getIgnoredWorkouts(user.uid).catch(() => [] as string[]),
          // Fetch today in the background if looking at the past
          dateStr !== todayStr ? getDayFoodLogs(user.uid, todayStr).catch(() => []) : Promise.resolve(null),
          dateStr !== todayStr ? getDayWorkoutLogs(user.uid, todayStr).catch(() => []) : Promise.resolve(null)
        ]);

        // Helper function to process data for a specific date
        const processDataForDate = (targetDateStr: string, rawFoods: any, rawWorkouts: any) => {
          const processedSynced = (syncedWorkoutsRaw || [])
            .filter((w: any) => isWorkoutOnDate(w.start || w.date || w.timestamp, targetDateStr))
            .map((w: any) => ({
              ...w,
              isIgnored: (ignoredWorkouts || []).includes(String(w.id || w.dbId))
            }));

          const manualW = (manualWeights || []).filter((w: any) => w.date === targetDateStr).map((w: any) => ({
            ...w, timestamp: w.timestamp || new Date(`${w.date}T${w.time}`).getTime()
          }));

          const healthW: any[] = [];
          let daySteps = 0; 
          let daySleep = 0; // NEW: Setup sleep variable
          const safeHealth = Array.isArray(healthLogsRaw) ? healthLogsRaw : [];
          
          safeHealth.forEach((log: any) => {
            const baseTimestampObj = parseSafeDate(log.timestamp, Date.now());
            const baseTimestamp = baseTimestampObj.getTime();

            const processMetric = (metric: any) => {
              // Extract Weight
              if (metric.name === 'weight_body_mass') {
                if (Array.isArray(metric.data)) {
                  metric.data.forEach((entry: any) => {
                    const dateObj = parseSafeDate(entry.date || log.date || log.timestamp, baseTimestamp);
                    const parsedDate = formatSyncDate(dateObj);
                    if (parsedDate && parsedDate.dateStr === targetDateStr) {
                      healthW.push({
                        date: parsedDate.dateStr, time: parsedDate.timeStr,
                        weight: Math.round(Number(entry.qty || entry.value || 0) * 10) / 10,
                        unit: parseUnit(metric.units || log.units),
                        timestamp: parsedDate.timeMs, isSynced: true
                      });
                    }
                  });
                } else {
                  const dateObj = parseSafeDate(metric.date || log.date || log.timestamp, baseTimestamp);
                  const parsedDate = formatSyncDate(dateObj);
                  if (parsedDate && parsedDate.dateStr === targetDateStr) {
                    healthW.push({
                      date: parsedDate.dateStr, time: parsedDate.timeStr,
                      weight: Math.round(Number(metric.qty || metric.value || metric.weight || 0) * 10) / 10,
                      unit: parseUnit(metric.units || log.units || metric.unit),
                      timestamp: parsedDate.timeMs, isSynced: true
                    });
                  }
                }
              }

              // NEW: Extract Steps
              if (metric.name === 'step_count') {
                if (Array.isArray(metric.data)) {
                  metric.data.forEach((entry: any) => {
                    const dateObj = parseSafeDate(entry.date || log.date || log.timestamp, baseTimestamp);
                    const parsedDate = formatSyncDate(dateObj);
                    if (parsedDate && parsedDate.dateStr === targetDateStr) {
                      // FIX: Take the highest total synced, do not add duplicates together
                      daySteps = Math.max(daySteps, Number(entry.qty || entry.value || 0));
                    }
                  });
                } else {
                  const dateObj = parseSafeDate(metric.date || log.date || log.timestamp, baseTimestamp);
                  const parsedDate = formatSyncDate(dateObj);
                  if (parsedDate && parsedDate.dateStr === targetDateStr) {
                    // FIX: Take the highest total synced, do not add duplicates together
                    daySteps = Math.max(daySteps, Number(metric.qty || metric.value || 0));
                  }
                }
              }

              // NEW: Extract Sleep
              if (metric.name === 'sleep_analysis') {
                if (Array.isArray(metric.data)) {
                  metric.data.forEach((entry: any) => {
                    const dateObj = parseSafeDate(entry.date || log.date || log.timestamp, baseTimestamp);
                    const parsedDate = formatSyncDate(dateObj);
                    if (parsedDate && parsedDate.dateStr === targetDateStr) {
                      daySleep = Math.max(daySleep, Number(entry.totalSleep || entry.qty || entry.value || 0));
                    }
                  });
                } else {
                  const dateObj = parseSafeDate(metric.date || log.date || log.timestamp, baseTimestamp);
                  const parsedDate = formatSyncDate(dateObj);
                  if (parsedDate && parsedDate.dateStr === targetDateStr) {
                    daySleep = Math.max(daySleep, Number(metric.totalSleep || metric.qty || metric.value || 0));
                  }
                }
              }
            };

            // FIX: Added 'sleep_analysis' to the allowed processing log types
            if (log.name === 'weight_body_mass' || log.name === 'step_count' || log.name === 'sleep_analysis') {
              processMetric(log);
            } else if (Array.isArray(log.metrics)) {
              log.metrics.forEach(processMetric);
            } else if (log.data && Array.isArray(log.data.metrics)) {
              log.data.metrics.forEach(processMetric);
            }
          });

          const combined = [...manualW, ...healthW].filter(w => w.weight > 0).sort((a, b) => b.timestamp - a.timestamp);
          return { foods: rawFoods || [], workouts: rawWorkouts || [], syncedWorkouts: processedSynced, weight: combined[0] || null, steps: daySteps, sleep: daySleep };
        };

        // Process the Viewed Date
        const viewData = processDataForDate(dateStr, foods, workouts);
        setFoodLogs(viewData.foods);
        setWorkoutLogs(viewData.workouts);
        setSyncedWorkouts(viewData.syncedWorkouts);
        setTodayWeight(viewData.weight);
        setTodaySteps(viewData.steps || 0);
        setTodaySleep(viewData.sleep || 0); // NEW: Save to view state

        // Process Today's Background Cache
        if (dateStr === todayStr) {
           todayCache.current = viewData;
        } else if (todayFoods && todayWorkouts) {
           todayCache.current = processDataForDate(todayStr, todayFoods, todayWorkouts);
        }

      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
        isBackgroundRefresh.current = false;
      }
    };
    
    loadData();
  }, [user?.uid, viewDate, refreshTrigger]);

  const todayStr = getDateString(new Date());
  const viewStr = getDateString(viewDate);
  const isToday = todayStr === viewStr;

  const caloriesConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
  
  const manualBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const healthBurned = syncedWorkouts.reduce((sum, w) => {
    if (w.isIgnored) return sum; // <-- Skip ignored workouts
    if (w.activeEnergyBurned && w.activeEnergyBurned.units === 'kcal') {
       return sum + Math.round(w.activeEnergyBurned.qty);
    }
    return sum;
  }, 0);
  const caloriesBurned = manualBurned + healthBurned;

  const activeProfile = getActiveBudgets(userProfile, viewStr);
  const totalBudget = (activeProfile?.caloriesBudget || 0) + caloriesBurned;
  
  const remaining = totalBudget - caloriesConsumed;
  const percentage = Math.round((caloriesConsumed / (totalBudget || 1)) * 100);

  const fatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0);
  const saturatedFatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0);
  const carbsConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0);
  const fiberConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? log.fiber ?? 0), 0);
  const sugarConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0);
  const proteinConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? log.protein ?? 0), 0);

  return (
    <>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#e2e8f0', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', backgroundColor: '#2563eb', animation: 'loadingSweep 1.5s infinite ease-in-out' }} />
          <style>{`@keyframes loadingSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
        </div>
      )}

      <div className="daily-stats" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s ease-in-out', pointerEvents: loading ? 'none' : 'auto' }}>
        
        <div ref={topRef} />
        
        <div className="date-navigator">
          <div className="date-display" onClick={handleGoToToday} style={{ cursor: 'pointer', margin: '0 auto 1.5rem auto' }}>
            <h2>{isToday ? "Today's Summary" : "Daily Summary"}</h2>
            <p className="date">
              {viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="weekly-nav-wrapper">

          <div 
            className="navigator-container weekly-view"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ margin: 0, position: 'relative' }} 
          >
            <button 
              className="nav-btn desktop-arrow prev-week" 
              onClick={handlePrevWeek} 
              aria-label="Previous week"
              style={{ position: 'absolute', left: '0', top: '0', bottom: '0', zIndex: 10, margin: 0 }}
            />
            <div className="navigator-grid">
              {getWeekDates(viewDate).map((date, index) => {
                const dStr = getDateString(date);
                const isSelected = dStr === viewStr;
                const isActualToday = dStr === todayStr;
                const summary = navigatorSummaries[dStr] || { progress: 0, color: '#10b981' };
                const progress = summary.progress;
                const barColor = summary.color;
                
                // NEW: Check if this day is Saturday
                const isSaturday = date.getDay() === 6;
                // NEW: Don't show the line if Saturday is the very last item on the far right
                const isLastItem = index === 6; 
                
                return (
                  <button 
                    key={dStr} 
                    className={`week-day-btn ${isSelected ? 'selected' : ''} ${isActualToday ? 'is-today' : ''}`}
                    onClick={() => setViewDate(date)}
                    style={{ position: 'relative' }} /* NEW: Important so the line anchors to the button */
                  >
                    <span className="day-name">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <div className="day-circle">
                       <div className="day-progress" style={{ height: `${Math.min(progress * 100, 100)}%`, backgroundColor: barColor }} />
                       <span className="day-number">{date.getDate()}</span>
                    </div>

                    {/* NEW: The Gray Divider Line */}
                    {isSaturday && !isLastItem && (
                      <div style={{
                        position: 'absolute',
                        right: '-0.5rem', /* Tweaked to sit in the gap between buttons */
                        top: '15%',
                        bottom: '15%',
                        width: '2px',
                        backgroundColor: '#e2e8f0', /* Matches your empty circle border gray */
                        borderRadius: '2px',
                        pointerEvents: 'none' /* Prevents the line from blocking clicks */
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
            <button 
              className="nav-btn desktop-arrow next-week" 
              onClick={handleNextWeek} 
              aria-label="Next week"
              style={{ position: 'absolute', right: '0', top: '0', bottom: '0', zIndex: 10, margin: 0 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', marginTop: '1rem' }}>
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
            
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${Math.min(percentage, 100)}%`, 
                  background: '#16a34a' 
                }}
              ></div>
            </div>
            
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
            {activeProfile?.trackFat && <NutrientCircle label="Fat" consumed={fatConsumed} budget={activeProfile?.fatBudget || 0} unit="g" color="#f59e0b" />}
            {activeProfile?.trackSaturatedFat && <NutrientCircle label="Sat Fat" consumed={saturatedFatConsumed} budget={activeProfile?.saturatedFatBudget || 0} unit="g" color="#dc2626" />}
            {activeProfile?.trackCarbs && <NutrientCircle label="Carbs" consumed={carbsConsumed} budget={activeProfile?.carbsBudget || 0} unit="g" color="#10b981" />}
            {activeProfile?.trackFiber && <NutrientCircle label="Fiber" consumed={fiberConsumed} budget={activeProfile?.fiberBudget || 0} unit="g" color="#8b5cf6" />}
            {activeProfile?.trackSugar && <NutrientCircle label="Sugar" consumed={sugarConsumed} budget={activeProfile?.sugarBudget || 0} unit="g" color="#ec4899" />}
            {activeProfile?.trackProtein && <NutrientCircle label="Protein" consumed={proteinConsumed} budget={activeProfile?.proteinBudget || 0} unit="g" color="#3b82f6" />}
          </div>
        </div>

        <div className="dashboard-bottom-row">
          {activeProfile?.showWeightOnDashboard !== false && (
          <div className="stats-card half-width-card">
            <div className="stat-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <img src="./weightscale.png" alt="Weight Icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                <span className="stat-label" style={{ margin: 0 }}>Weight</span>
              </div>
              {todayWeight ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div className="weight-highlight" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                    <span className="weight-number">{Number(todayWeight.weight).toFixed(1)}</span>
                    <span className="weight-unit">{todayWeight.unit}</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                      at {formatTime12Hour(todayWeight.time)}
                    </span>
                  </div>
                  {/* NEW: Distance from weight goal */}
                  {activeProfile?.weightGoal && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' }}>
                      <span style={{ color: Math.abs(Number(todayWeight.weight) - activeProfile.weightGoal) < 0.1 ? '#10b981' : '#3b82f6' }}>
                        {Math.abs(Number(todayWeight.weight) - activeProfile.weightGoal) < 0.1 
                          ? 'Goal reached! 🎉' 
                          : `${Math.abs(Number(todayWeight.weight) - activeProfile.weightGoal).toFixed(1)} ${todayWeight.unit} away`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-weight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}><span>No weight logged</span></div>
              )}
            </div>
          </div>
          )}

          {/* NEW: Calories Burned Card (Always Visible) */}
          {activeProfile?.showCaloriesBurnedOnDashboard !== false && (
          <div className="stats-card half-width-card">
            <div className="stat-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <img src="./dumbell.png" alt="Workout Icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                <span className="stat-label" style={{ margin: 0 }}>Calories Burned</span>
              </div>
              
              {caloriesBurned > 0 ? (
                <div className="weight-highlight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span className="burned" style={{ fontSize: '2rem', fontWeight: 700, color: '#f97316' }}>
                    {caloriesBurned}
                  </span>
                  <span className="weight-unit">kcal</span>
                </div>
              ) : (
                <div className="empty-weight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                  <span>No workouts logged</span>
                </div>
              )}

              {/* NEW: Individual Workout Breakdown */}
              {(syncedWorkouts.length > 0 || workoutLogs.length > 0) && (
                <div style={{ marginTop: '1rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  
                  {/* Map Apple Health Workouts */}
                  {syncedWorkouts.map((w: any) => {
                    const wId = String(w.id || w.dbId);
                    const cals = w.activeEnergyBurned?.units === 'kcal' ? Math.round(w.activeEnergyBurned.qty) : 0;
                    
                    // Prioritize standard names/titles, fallback to cleaning up the Apple Health string
                    let activityName = w.title || w.name || (w.workoutActivityType ? w.workoutActivityType.replace('HKWorkoutActivityType', '') : 'Workout');
                    // Add spaces before capital letters (e.g., "TraditionalStrengthTraining" -> "Traditional Strength Training")
                    activityName = activityName.replace(/([A-Z])/g, ' $1').trim();

                    return (
                      <div key={wId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', opacity: w.isIgnored ? 0.5 : 1 }}>
                        <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', textDecoration: w.isIgnored ? 'line-through' : 'none' }}>
                          {activityName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: w.isIgnored ? '#94a3b8' : '#f97316', textDecoration: w.isIgnored ? 'line-through' : 'none' }}>{cals}</span>
                          <button 
                            onClick={() => handleToggleIgnoreWorkout(wId, w.isIgnored)}
                            style={{ 
                              background: w.isIgnored ? '#e2e8f0' : '#fee2e2', 
                              color: w.isIgnored ? '#64748b' : '#ef4444', 
                              border: 'none', 
                              borderRadius: '4px', 
                              padding: '3px 8px', 
                              fontSize: '0.7rem', 
                              cursor: 'pointer', 
                              fontWeight: 600 
                            }}
                          >
                            {w.isIgnored ? 'Add' : 'Ignore'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Map Manual Workouts */}
                  {workoutLogs.map((w: WorkoutLog) => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#475569' }}>Manual Workout</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: '#f97316' }}>{w.caloriesBurned}</span>
                        <button 
                          onClick={() => handleDeleteManualWorkout(w.id)}
                          style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>
          </div>
          )}

          {/* NEW: Steps Card Update with Circular Progress Bar */}
          {activeProfile?.showStepsOnDashboard !== false && (
          <div className="stats-card half-width-card">
            <div className="stat-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <img src="./footstep.png" alt="Steps Icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                <span className="stat-label" style={{ margin: 0 }}>Steps</span>
              </div>
              {activeProfile?.stepGoal ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', position: 'relative' }}>
                  <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background Circle */}
                    <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    {/* Progress Circle */}
                    <circle 
                      cx="55" cy="55" r="46" 
                      fill="none" 
                      stroke="#3b82f6" 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 - (Math.min((todaySteps / activeProfile.stepGoal) * 100, 100) / 100) * (2 * Math.PI * 46)}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                    />
                  </svg>
                  
                  {/* Inner Text Overlay */}
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6', lineHeight: '1.2' }}>
                      {Math.round(todaySteps).toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      / {activeProfile.stepGoal.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="weight-highlight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span className="burned" style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>
                    {Math.round(todaySteps).toLocaleString()}
                  </span>
                  <span className="weight-unit">steps</span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* NEW: Sleep Card */}
          {activeProfile?.showSleepOnDashboard !== false && (
          <div className="stats-card half-width-card">
            <div className="stat-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <img src="./bed.png" alt="Sleep Icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                <span className="stat-label" style={{ margin: 0 }}>Sleep</span>
              </div>
              {todaySleep > 0 ? (
                <div className="weight-highlight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.2rem' }}>
                  {/* Calculate Hours */}
                  <span className="burned" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1' }}>
                    {Math.floor(todaySleep)}
                  </span>
                  <span className="weight-unit" style={{ marginRight: '0.25rem' }}>hr</span>
                  
                  {/* Calculate Minutes */}
                  <span className="burned" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1' }}>
                    {Math.round((todaySleep - Math.floor(todaySleep)) * 60)}
                  </span>
                  <span className="weight-unit">min</span>
                </div>
              ) : (
                <div className="empty-weight" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                  <span>No sleep logged</span>
                </div>
              )}
            </div>
          </div>
          )}

        </div>
      </div>
    </>
  );
}