// src/components/FoodLogTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFoods, getDayFoodLogs, createFoodLog, deleteFoodLog, updateFoodLog, getDayWorkoutLogs, getSyncedHealthWorkouts, getIgnoredWorkouts, updateFood, getDoneLoggingDates, toggleDoneLoggingDate } from '../services/database';
import { Food, FoodLog } from '../types';
import AddFoodModal from './AddFoodModal';
import EditFoodLogModal from './EditFoodLogModal';
import CreateRecipeModal from './CreateRecipeModal';
import './FoodLogTab.css';

// --- Helper Functions for Navigator ---
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

// --- Main Component ---
export default function FoodLogTab() {
  const { user, userProfile } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [burnedCalories, setBurnedCalories] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // 1. Create the reference point for scrolling to the top
  const topRef = useRef<HTMLDivElement>(null);

  // 2. Scroll to the reference point instantly when the tab loads
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [isVitaminMode, setIsVitaminMode] = useState(false);
  const [activeAddMealType, setActiveAddMealType] = useState<string>(''); 
  
  // Separate Edit States for normal foods vs recipes
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [editingRecipeLog, setEditingRecipeLog] = useState<FoodLog | null>(null);
  const [editingRecipeFood, setEditingRecipeFood] = useState<Food | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);

  // Navigator State
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, number>>({});

  // Popup Modal State
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);

  // --- Independent Summary Toggle States ---
  const [summaryToggles, setSummaryToggles] = useState<Record<string, boolean>>({});

  const isShowingRemaining = (key: string) => {
    return summaryToggles[key] ?? true; 
  };

  const toggleSummaryMode = (key: string) => {
    setSummaryToggles(prev => ({
      ...prev,
      [key]: !(prev[key] ?? true) 
    }));
  };

  // Double Tap / Drag and Drop State
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedLog, setDraggedLog] = useState<FoodLog | null>(null);
  const [dragOverLogId, setDragOverLogId] = useState<string | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const viewStr = getDateString(viewDate);
  const todayStr = getDateString(new Date());
  const isToday = todayStr === viewStr;

  // --- Firebase Synced Done Logging State ---
  const [doneLoggingDates, setDoneLoggingDates] = useState<Record<string, boolean>>({});

  const isDoneLogging = doneLoggingDates[viewStr] || false;
  
  const toggleDoneLogging = async () => {
    if (!user) return;
    const nextState = !isDoneLogging;

    // Optimistic update for instant UI feedback
    setDoneLoggingDates(prev => ({
      ...prev,
      [viewStr]: nextState
    }));

    // Save to Firebase
    try {
      await toggleDoneLoggingDate(user.uid, viewStr, nextState);
    } catch (error) {
      console.error("Failed to sync done state to Firebase", error);
      // Optional: revert state if it fails
      setDoneLoggingDates(prev => ({
        ...prev,
        [viewStr]: !nextState
      }));
    }
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

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dateStr = getDateString(viewDate);
      
      // Fetch foods, workouts, and the done dates from Firebase simultaneously
      const [userFoods, logs, syncedWorkouts, manualWorkouts, ignoredWorkouts, firebaseDoneDates] = await Promise.all([
        getUserFoods(user.uid),
        getDayFoodLogs(user.uid, dateStr),
        getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]),
        getDayWorkoutLogs(user.uid, dateStr).catch(() => []),
        getIgnoredWorkouts(user.uid).catch(() => [] as string[]),
        getDoneLoggingDates(user.uid).catch(() => ({}))
      ]);
      
      setFoods(userFoods);
      setFoodLogs(logs);
      setDoneLoggingDates(firebaseDoneDates);

      const todaysSyncedWorkouts = syncedWorkouts.filter((w: any) => {
        const isToday = isWorkoutOnDate(w.start || w.date || w.timestamp, dateStr);
        const isIgnored = ignoredWorkouts.includes(String(w.id || w.dbId)); 
        return isToday && !isIgnored; 
      });

      let totalBurned = todaysSyncedWorkouts.reduce((sum, w) => {
        if (w.activeEnergyBurned && w.activeEnergyBurned.units === 'kcal') {
          return sum + Math.round(w.activeEnergyBurned.qty);
        }
        return sum;
      }, 0);

      if (manualWorkouts) {
        totalBurned += manualWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
      }

      setBurnedCalories(totalBurned);

    } catch (error) {
      console.error('Failed to load food data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
        const [dayFoods, manualWorkouts] = await Promise.all([
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

        if (manualWorkouts) {
          dailyBurned += manualWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
        }

        const consumed = dayFoods.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        const budget = (userProfile?.caloriesBudget || 0) + dailyBurned;
        
        summaries[dStr] = budget > 0 ? (consumed / budget) : 0;
      }));

      setNavigatorSummaries(summaries);
    };

    loadNavigatorStats();
  }, [user, viewDate, viewMode, userProfile?.caloriesBudget]);

  const handleAddFood = async (foodData: any) => {
    if (!user) return;
    try {
      const targetDate = getDateString(viewDate);
      await createFoodLog(user.uid, {
        date: targetDate,
        ...foodData,
      });
      setShowAddModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to add food:', error);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!user) return;
    try {
      await deleteFoodLog(user.uid, logId);
      await loadData();
      setSelectedLog(null);
    } catch (error) {
      console.error('Failed to delete food log:', error);
    }
  };

  const handleEditLog = async (updates: any) => {
    if (!editingLog || !user) return;
    try {
      // 1. Update the daily diary entry
      await updateFoodLog(user.uid, editingLog.id, updates);

      // 2. Update the Master Food Database so your edits save for future use!
      if (updates.food && updates.food.id) {
        const baseFoodUpdates = {
          name: updates.food.name,
          brand: updates.food.brand,
          icon: updates.food.icon, 
          calories: updates.food.calories,
          fat: updates.food.fat,
          saturatedFat: updates.food.saturatedFat,
          transFat: updates.food.transFat,
          cholesterol: updates.food.cholesterol,
          sodium: updates.food.sodium,
          carbs: updates.food.carbs,
          fiber: updates.food.fiber,
          sugar: updates.food.sugar,
          protein: updates.food.protein,
          volume: updates.food.volume,
          volumeUnit: updates.food.volumeUnit
        };
        
        // FIX: Strip out 'undefined' values before sending to Firebase
        const cleanBaseFoodUpdates = Object.fromEntries(
          Object.entries(baseFoodUpdates).filter(([_, v]) => v !== undefined)
        );
        
        await updateFood(updates.food.id, cleanBaseFoodUpdates);
      }

      setShowEditModal(false);
      setEditingLog(null);
      await loadData();
    } catch (error) {
      console.error('Failed to update food log:', error);
    }
  };

  // Double Tap / Interaction Handler
  const handleItemInteraction = (e: React.MouseEvent | React.TouchEvent, log: FoodLog) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    if ((e.target as HTMLElement).classList.contains('drag-handle')) return;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      if (window.confirm(`Are you sure you want to delete ${log.food.name}?`)) {
        handleDeleteLog(log.id);
      }
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setSelectedLog(log); 
      }, 250); 
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, log: FoodLog) => {
    setDraggedLog(log);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', log.id);
  };

  const handleDragOverItem = (e: React.DragEvent, logId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLogId !== logId) {
      setDragOverLogId(logId);
    }
  };

  const handleDropItem = (e: React.DragEvent, targetMealType: string, targetLogId: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleDrop(e, targetMealType, targetLogId);
  };

  const handleDragOverMeal = (e: React.DragEvent, mealName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLogId !== `meal-${mealName}`) {
      setDragOverLogId(`meal-${mealName}`);
    }
  };

  const handleDragLeaveMeal = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverLogId(null);
  };

  const handleDragEnd = () => {
    setDraggedLog(null);
    setDragOverLogId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetMealType: string, targetLogId?: string) => {
    e.preventDefault();
    setDragOverLogId(null);
    
    if (!draggedLog || !user) return;
    if (draggedLog.id === targetLogId) {
      setDraggedLog(null);
      return; 
    }

    const finalMealType = targetMealType === 'Uncategorized' ? '' : targetMealType;
    const isDraggedVitamin = draggedLog.mealType === 'Vitamins';
    const isTargetVitamin = targetMealType === 'Vitamins';
    
    if (isDraggedVitamin && !isTargetVitamin) { setDraggedLog(null); return; }
    if (!isDraggedVitamin && isTargetVitamin) { setDraggedLog(null); return; }

    const targetLogs = foodLogs
      .filter(log => {
        if (targetMealType === 'Uncategorized') {
           return !log.mealType || !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Vitamins'].includes(log.mealType);
        }
        return log.mealType === targetMealType;
      })
      .filter(log => log.id !== draggedLog.id)
      .sort((a, b) => a.timestamp - b.timestamp); 

    let newTimestamp = draggedLog.timestamp;

    if (targetLogId) {
      const targetIndex = targetLogs.findIndex(l => l.id === targetLogId);
      if (targetIndex !== -1) {
        if (targetIndex === 0) {
          newTimestamp = targetLogs[0].timestamp - 1000; 
        } else {
          newTimestamp = (targetLogs[targetIndex - 1].timestamp + targetLogs[targetIndex].timestamp) / 2;
        }
      }
    } else {
      if (targetLogs.length > 0) {
        newTimestamp = targetLogs[targetLogs.length - 1].timestamp + 1000;
      } else {
        newTimestamp = Date.now(); 
      }
    }

    const updatedLog = { ...draggedLog, mealType: finalMealType, timestamp: newTimestamp };
    
    setFoodLogs(prev => {
      const filtered = prev.filter(l => l.id !== draggedLog.id);
      return [...filtered, updatedLog].sort((a, b) => a.timestamp - b.timestamp);
    });
    setDraggedLog(null);

    try {
      await updateFoodLog(user.uid, draggedLog.id, { 
        mealType: finalMealType, 
        timestamp: newTimestamp 
      });
    } catch (error) {
      console.error("Failed to update log position:", error);
      loadData(); 
    }
  };

  if (loading && foodLogs.length === 0) {
    return (
      <div className="food-log-tab">
        <div ref={topRef} />
        <div className="loading" style={{ marginTop: '2rem' }}>Loading foods...</div>
      </div>
    );
  }

  const adjustedBudget = (userProfile?.caloriesBudget || 0) + burnedCalories;
  const totalCalories = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0));
  const calDiff = adjustedBudget - totalCalories;
  
  const fatConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0));
  const saturatedFatConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0));
  const carbsConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0));
  const fiberConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? (log as any).fiber ?? 0), 0));
  const sugarConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0));
  const proteinConsumed = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? (log as any).protein ?? 0), 0));

  const trackedMacros = [];
  if (userProfile?.trackFat) trackedMacros.push({ label: 'Fat', total: fatConsumed, budget: userProfile.fatBudget, unit: 'g', color: '#f59e0b' });
  if (userProfile?.trackSaturatedFat) trackedMacros.push({ label: 'Sat Fat', total: saturatedFatConsumed, budget: userProfile.saturatedFatBudget, unit: 'g', color: '#dc2626' });
  if (userProfile?.trackCarbs) trackedMacros.push({ label: 'Carbs', total: carbsConsumed, budget: userProfile.carbsBudget, unit: 'g', color: '#10b981' });
  if (userProfile?.trackFiber) trackedMacros.push({ label: 'Fiber', total: fiberConsumed, budget: userProfile.fiberBudget, unit: 'g', color: '#8b5cf6' });
  if (userProfile?.trackSugar) trackedMacros.push({ label: 'Sugar', total: sugarConsumed, budget: userProfile.sugarBudget, unit: 'g', color: '#ec4899' });
  if (userProfile?.trackProtein) trackedMacros.push({ label: 'Protein', total: proteinConsumed, budget: userProfile.proteinBudget, unit: 'g', color: '#3b82f6' });

  const hasVitaminsLogs = foodLogs.some(log => log.mealType === 'Vitamins');
  const mealCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Uncategorized'];
  
  if (userProfile?.trackVitamins || hasVitaminsLogs) {
    mealCategories.unshift('Vitamins');
  }

  return (
    <div className="food-log-tab">
      
      {/* Invisible anchor point for auto-scrolling to the top */}
      <div ref={topRef} />
      
      <div className="date-navigator">
        <button className="nav-btn" onClick={handlePrevDay}>←</button>
        <div className="date-display" onClick={handleGoToToday} style={{ cursor: 'pointer' }}>
          <h2>{isToday ? "Today's Food" : "Food Log"}</h2>
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

      <div className="tab-header">
        <h2>{isToday ? "Today's Foods" : "Logged Foods"}</h2>
      </div>

      <div className="food-summary">
        {/* CALORIES TOGGLE ROW */}
        <div 
          onClick={() => toggleSummaryMode('Calories')} 
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}
          title="Click to toggle between consumed and remaining"
        >
          <span style={{ fontSize: '1.2rem', color: '#000', fontWeight: 700 }}>Calories</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: calDiff < 0 && isShowingRemaining('Calories') ? '#ef4444' : '#2563eb', display: 'flex', alignItems: 'center' }}>
            {userProfile?.caloriesBudget ? (
              isShowingRemaining('Calories') ? (
                `${Math.abs(calDiff)} cal ${calDiff >= 0 ? 'left' : 'over'}`
              ) : (
                <>
                  {totalCalories} / {adjustedBudget} cal
                  {burnedCalories > 0 && (
                    <span style={{ fontSize: '0.9rem', color: '#ef4444', marginLeft: '0.5rem' }}>(+{burnedCalories} 🔥)</span>
                  )}
                </>
              )
            ) : (
              `${totalCalories} cal`
            )}
          </span>
        </div>
        
        {userProfile?.caloriesBudget && (
          <div className="progress-bg" style={{ marginBottom: trackedMacros.length > 0 ? '1.5rem' : '0', height: '10px' }}>
            <div 
              className="progress-fill" 
              style={{ 
                width: `${Math.min((totalCalories / adjustedBudget) * 100, 100)}%`, 
                background: totalCalories > adjustedBudget ? '#ef4444' : '#10b981' 
              }} 
            />
          </div>
        )}

        {/* INDIVIDUAL MACRO TOGGLES */}
        {trackedMacros.length > 0 && (
          <div className="macros-grid">
            {trackedMacros.map(macro => {
              const mDiff = Math.round((macro.budget || 0) - macro.total);
              
              return (
                <div 
                  key={macro.label} 
                  className="macro-item" 
                  onClick={() => toggleSummaryMode(macro.label)} 
                  style={{ cursor: 'pointer' }}
                  title={`Click to toggle ${macro.label} text`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ color: '#000', fontWeight: 700, fontSize: '0.85rem' }}>{macro.label}</span>
                    
                    <span style={{ 
                      color: mDiff < 0 && isShowingRemaining(macro.label) 
                        ? (macro.label === 'Protein' || macro.label === 'Fiber' ? '#10b981' : '#ef4444') 
                        : '#64748b', 
                      fontWeight: 600, 
                      fontSize: '0.85rem' 
                    }}>
                      {macro.budget ? (
                        isShowingRemaining(macro.label) ? (
                          `${Math.abs(mDiff)}${macro.unit} ${mDiff >= 0 ? 'left' : 'over'}`
                        ) : (
                          `${macro.total}${macro.unit} / ${macro.budget}${macro.unit}`
                        )
                      ) : (
                        `${macro.total}${macro.unit}`
                      )}
                    </span>
                  </div>
                  <div className="progress-bg">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        background: macro.color, 
                        width: macro.budget ? `${Math.min((macro.total / macro.budget) * 100, 100)}%` : (macro.total > 0 ? '100%' : '0%')
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DONE LOGGING TOGGLE */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => {
            const hasPlannedFoods = foodLogs.some(log => log.isPlanned);
            if (!isDoneLogging && hasPlannedFoods) {
              alert("You cannot mark the day as done while you still have planned foods. Please edit them to mark them as eaten, or delete them.");
              return;
            }
            toggleDoneLogging();
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.25rem', borderRadius: '2rem', border: 'none',
            backgroundColor: isDoneLogging ? '#10b981' : (foodLogs.some(log => log.isPlanned) ? '#e2e8f0' : '#f1f5f9'),
            color: isDoneLogging ? '#fff' : (foodLogs.some(log => log.isPlanned) ? '#94a3b8' : '#64748b'),
            fontWeight: 700, fontSize: '0.95rem', 
            cursor: (!isDoneLogging && foodLogs.some(log => log.isPlanned)) ? 'not-allowed' : 'pointer',
            boxShadow: isDoneLogging ? '0 4px 6px -1px rgba(16, 185, 129, 0.3)' : 'none',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {isDoneLogging ? (
            <>🔥 Done Logging</>
          ) : (
            <><span style={{ filter: 'grayscale(100%)', opacity: 0.6 }}>🔥</span> Mark Day as Done</>
          )}
        </button>
        {!isDoneLogging && foodLogs.some(log => log.isPlanned) && (
          <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
            * Unmark planned foods to finish day
          </span>
        )}
      </div>

      <div className="daily-diary">
        {mealCategories.map(mealName => {
          const logsForMeal = foodLogs.filter((log: any) => {
            if (mealName === 'Uncategorized') {
              return !log.mealType || !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Vitamins'].includes(log.mealType);
            }
            return log.mealType === mealName;
          }).sort((a, b) => a.timestamp - b.timestamp);

          if (mealName === 'Uncategorized' && logsForMeal.length === 0) return null;

          const mealCalories = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0));
          const mealFat = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0));
          const mealSatFat = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0));
          const mealCarbs = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0));
          const mealFiber = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? (log as any).fiber ?? 0), 0));
          const mealSugar = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0));
          const mealProtein = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? (log as any).protein ?? 0), 0));

          const mealMacros = [];
          if (userProfile?.trackProtein) mealMacros.push({ label: 'Protein', value: mealProtein, color: '#1d4ed8', bg: '#dbeafe' });
          if (userProfile?.trackCarbs) mealMacros.push({ label: 'Carbs', value: mealCarbs, color: '#047857', bg: '#d1fae5' });
          if (userProfile?.trackFat) mealMacros.push({ label: 'Fat', value: mealFat, color: '#b45309', bg: '#fef3c7' });
          if (userProfile?.trackSaturatedFat) mealMacros.push({ label: 'Sat Fat', value: mealSatFat, color: '#991b1b', bg: '#fee2e2' });
          if (userProfile?.trackFiber) mealMacros.push({ label: 'Fiber', value: mealFiber, color: '#5b21b6', bg: '#ede9fe' });
          if (userProfile?.trackSugar) mealMacros.push({ label: 'Sugar', value: mealSugar, color: '#be185d', bg: '#fce7f3' });

          return (
            <div 
              key={mealName} 
              className={`meal-section ${dragOverLogId === `meal-${mealName}` ? 'drag-over-meal' : ''}`}
              onDragOver={(e) => handleDragOverMeal(e, mealName)}
              onDragLeave={handleDragLeaveMeal}
              onDrop={(e) => handleDrop(e, mealName)}
            >
              <div className="meal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{mealName}</h3>

                  {mealMacros.length > 0 && logsForMeal.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {mealMacros.map((macro, idx) => (
                        <span key={idx} style={{ 
                          fontSize: '0.7rem', color: macro.color, backgroundColor: macro.bg,
                          padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600
                        }}>
                          {macro.label}: {macro.value}g
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <span className="meal-calories" style={{ margin: 0 }}>{mealCalories} cal</span>
              </div>
              
              {logsForMeal.length === 0 ? (
                <div className="meal-empty">No {mealName === 'Vitamins' ? 'vitamins' : 'foods'} logged. Drop {mealName === 'Vitamins' ? 'vitamins' : 'foods'} here.</div>
              ) : (
                <div className="food-logs-list">
                  {logsForMeal.map((log) => {
                    const isDragging = draggedLog?.id === log.id;
                    const isDragOver = dragOverLogId === log.id;

                    return (
                      <div 
                        key={log.id} 
                        className={`food-log-item ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${log.isPlanned ? 'is-planned' : ''}`}
                        onClick={(e) => handleItemInteraction(e, log)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, log)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOverItem(e, log.id)}
                        onDrop={(e) => handleDropItem(e, mealName, log.id)}
                      >
                        <div className="food-log-summary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="drag-handle" title="Drag to reorder">⠿</div>
                            <div className="food-info">
                              <h4 style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                {log.food.icon && <span style={{ marginRight: '0.3rem' }}>{log.food.icon}</span>}
                                <span>{log.food.name}</span>
                              </h4>
                              {log.food.brand && <span className="brand" style={{ textTransform: 'capitalize' }}>{log.food.brand}</span>}
                              <span className="amount">
                                {log.amount} {log.unit}
                                {log.isPlanned && <span style={{ marginLeft: '0.5rem', color: '#8b5cf6', fontWeight: 700, fontSize: '0.7rem', backgroundColor: '#f3e8ff', padding: '0.15rem 0.35rem', borderRadius: '0.25rem', border: '1px solid #e9d5ff' }}>PLANNED</span>}
                              </span>
                            </div>
                          </div>
                          <div className="food-calories">
                            <span className="calories">{Math.round(log.editedNutrition?.calories ?? log.calories)} cal</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ONLY SHOW ADD BUTTON IF NOT DONE LOGGING */}
              {!isDoneLogging && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      width: '25%', 
                      padding: '0.6rem 0', 
                      fontSize: '1rem',
                      ...(mealName === 'Vitamins' ? { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' } : {})
                    }}
                    onClick={() => {
                      setActiveAddMealType(mealName === 'Uncategorized' ? '' : mealName);
                      setIsVitaminMode(mealName === 'Vitamins');
                      setShowAddModal(true);
                    }}
                  >
                    + Add
                  </button>
                </div>
              )}

            </div>
          );
        })}
        
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem', fontStyle: 'italic' }}>
          * Double-tap an item to delete it.
        </p>
      </div>

      {selectedLog && (
        <div className="selected-log-overlay" onClick={() => setSelectedLog(null)}>
          <div className="selected-log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="selected-log-header">
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', textTransform: 'capitalize' }}>
                  {selectedLog.food.icon && <span style={{ marginRight: '0.4rem' }}>{selectedLog.food.icon}</span>}
                  {selectedLog.food.name}
                </h3>
                {selectedLog.food.brand && <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>{selectedLog.food.brand}</span>}
              </div>
              <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                {selectedLog.amount} {selectedLog.unit}
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                Nutrition Logged
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {[
                  { label: 'Calories', value: `${selectedLog.editedNutrition?.calories ?? selectedLog.calories} cal`, isHighlight: true, indent: false },
                  { label: 'Total Fat', value: `${selectedLog.editedNutrition?.fat ?? selectedLog.fat ?? 0}g`, isHighlight: false, indent: false },
                  { label: 'Saturated Fat', value: `${selectedLog.editedNutrition?.saturatedFat ?? selectedLog.saturatedFat ?? 0}g`, isHighlight: false, indent: true },
                  { label: 'Trans Fat', value: `${(selectedLog as any).editedNutrition?.transFat ?? (selectedLog as any).transFat ?? (selectedLog.food as any).transFat ?? 0}g`, isHighlight: false, indent: true },
                  { label: 'Cholesterol', value: `${(selectedLog as any).editedNutrition?.cholesterol ?? (selectedLog as any).cholesterol ?? (selectedLog.food as any).cholesterol ?? 0}mg`, isHighlight: false, indent: false },
                  { label: 'Sodium', value: `${(selectedLog as any).editedNutrition?.sodium ?? (selectedLog as any).sodium ?? (selectedLog.food as any).sodium ?? 0}mg`, isHighlight: false, indent: false },
                  { label: 'Total Carbohydrate', value: `${selectedLog.editedNutrition?.carbs ?? selectedLog.carbs ?? 0}g`, isHighlight: false, indent: false },
                  { label: 'Dietary Fiber', value: `${selectedLog.editedNutrition?.fiber ?? selectedLog.fiber ?? 0}g`, isHighlight: false, indent: true },
                  { label: 'Total Sugars', value: `${selectedLog.editedNutrition?.sugar ?? selectedLog.sugar ?? 0}g`, isHighlight: false, indent: true },
                  { label: 'Protein', value: `${selectedLog.editedNutrition?.protein ?? selectedLog.protein ?? 0}g`, isHighlight: false, indent: false },
                ].map((nutrient, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderBottom: idx !== 9 ? '1px solid #e2e8f0' : 'none', 
                    paddingBottom: idx !== 9 ? '0.2rem' : '0'
                  }}>
                    <span style={{ 
                      fontSize: nutrient.isHighlight ? '0.75rem' : '0.65rem', 
                      textTransform: 'uppercase', 
                      color: nutrient.isHighlight ? '#475569' : '#94a3b8',
                      fontWeight: nutrient.isHighlight ? 700 : 400,
                      paddingLeft: nutrient.indent ? '0.75rem' : '0'
                    }}>
                      {nutrient.label}
                    </span>
                    <span style={{ 
                      fontWeight: 700, 
                      color: nutrient.isHighlight ? '#2563eb' : '#1e293b', 
                      fontSize: nutrient.isHighlight ? '1rem' : '0.8rem' 
                    }}>
                      {nutrient.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

<div className="selected-log-actions" style={{ display: 'flex', gap: '0.75rem', width: '100%', flexDirection: 'column' }}>
              
              {/* QUICK PLAN / CONFIRM BUTTON */}
              {selectedLog.isPlanned ? (
                <button 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', width: '100%', padding: '0.75rem', fontSize: '1rem', margin: '0 0 0.5rem 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 'bold' }}
                  onClick={async () => {
                    if (!user) return;
                    await updateFoodLog(user.uid, selectedLog.id, { isPlanned: false });
                    setSelectedLog(null);
                    loadData();
                  }}
                >
                  ✅ Confirm as Eaten
                </button>
              ) : (
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', margin: '0 0 0.5rem 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}
                  onClick={async () => {
                    if (!user) return;
                    await updateFoodLog(user.uid, selectedLog.id, { isPlanned: true });
                    setSelectedLog(null);
                    loadData();
                  }}
                >
                  🗓️ Mark as Planned
                </button>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ 
                    flex: '1 1 0', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    fontSize: '1rem', 
                    padding: '0.75rem',
                    margin: 0,
                    boxSizing: 'border-box'
                  }}
                  onClick={() => {
                    if ((selectedLog.food as any).isRecipe) {
                      setEditingRecipeLog(selectedLog);
                      setShowRecipeModal(true);
                    } else {
                      setEditingLog(selectedLog);
                      setShowEditModal(true);
                    }
                    setSelectedLog(null);
                  }}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ 
                    flex: '1 1 0', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    fontSize: '1rem', 
                    padding: '0.75rem',
                    margin: 0,
                    boxSizing: 'border-box'
                  }}
                  onClick={() => setSelectedLog(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddFoodModal 
          foods={foods} 
          onAdd={handleAddFood} 
          onClose={() => {
            setShowAddModal(false);
            loadData(); 
          }} 
          onFoodDeleted={() => {
            loadData(); 
          }}
          selectedDate={getDateString(viewDate)} 
          isVitaminMode={isVitaminMode}
          initialMealType={activeAddMealType}
          
          onOpenRecipe={(foodToEdit?: Food) => {
            setShowAddModal(false);
            if (foodToEdit) {
              setEditingRecipeFood(foodToEdit);
            } else {
              setEditingRecipeFood(null);
            }
            setEditingRecipeLog(null); 
            setShowRecipeModal(true);
          }}
        />
      )}
      
      {showRecipeModal && (
        <CreateRecipeModal 
          foods={foods}
          editLog={editingRecipeLog} 
          editFood={editingRecipeFood}
          initialMealType={activeAddMealType}
          onClose={() => {
            setShowRecipeModal(false);
            setEditingRecipeLog(null);
            setEditingRecipeFood(null);
          }}
          onCreated={() => {
            setShowRecipeModal(false);
            setEditingRecipeLog(null);
            setEditingRecipeFood(null);
            loadData();
          }}
          selectedDate={getDateString(viewDate)}
        />
      )}

      {showEditModal && editingLog && (
        <EditFoodLogModal log={editingLog} onSave={handleEditLog} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}