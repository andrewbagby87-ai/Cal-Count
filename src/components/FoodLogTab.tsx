// src/components/FoodLogTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFoods, getDayFoodLogs, createFoodLog, deleteFoodLog, updateFoodLog, getDayWorkoutLogs, getSyncedHealthWorkouts, getIgnoredWorkouts } from '../services/database';
import { Food, FoodLog } from '../types';
import AddFoodModal from './AddFoodModal';
import EditFoodLogModal from './EditFoodLogModal';
import BarcodeScanner from './BarcodeScanner';
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

// --- Main Component ---
export default function FoodLogTab() {
  const { user, userProfile } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [burnedCalories, setBurnedCalories] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isVitaminMode, setIsVitaminMode] = useState(false);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Navigator State
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, number>>({});

  // Popup Modal State
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);

  // --- Double Tap / Drag and Drop State ---
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedLog, setDraggedLog] = useState<FoodLog | null>(null);
  const [dragOverLogId, setDragOverLogId] = useState<string | null>(null);

  // --- Scanned Item State ---
  const [scannedFood, setScannedFood] = useState<Food | null>(null);
  const [scannedUpc, setScannedUpc] = useState<string | null>(null);

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
      const [userFoods, logs, syncedWorkouts, manualWorkouts, ignoredWorkouts] = await Promise.all([
        getUserFoods(user.uid),
        getDayFoodLogs(user.uid, dateStr),
        getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]), // TS Fix
        getDayWorkoutLogs(user.uid, dateStr).catch(() => []),
        getIgnoredWorkouts(user.uid).catch(() => [] as string[]) // TS Fix
      ]);
      
      setFoods(userFoods);
      setFoodLogs(logs);

      // Filter Apple Health workouts for the current viewing day AND exclude ignored workouts
      const todaysSyncedWorkouts = syncedWorkouts.filter((w: any) => {
        const wDate = new Date(w.start || w.date || w.timestamp);
        const isToday = getDateString(wDate) === dateStr;
        const isIgnored = ignoredWorkouts.includes(String(w.id || w.dbId)); // TS Fix
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
        getSyncedHealthWorkouts(user.uid).catch(() => [] as any[]), // TS Fix
        getIgnoredWorkouts(user.uid).catch(() => [] as string[]) // TS Fix
      ]);

      await Promise.all(datesToFetch.map(async (date) => {
        const dStr = getDateString(date);
        const [dayFoods, manualWorkouts] = await Promise.all([
          getDayFoodLogs(user.uid, dStr).catch(() => []),
          getDayWorkoutLogs(user.uid, dStr).catch(() => [])
        ]);
        
        const todaysSynced = allHealthWorkouts.filter((w: any) => {
          const wDate = new Date(w.start || w.date || w.timestamp);
          const isToday = getDateString(wDate) === dStr;
          const isIgnored = ignoredWorkouts.includes(String(w.id || w.dbId)); // TS Fix
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
      await updateFoodLog(user.uid, editingLog.id, updates);
      setShowEditModal(false);
      setEditingLog(null);
      await loadData();
    } catch (error) {
      console.error('Failed to update food log:', error);
    }
  };

  // --- Double Tap / Interaction Handler ---
  const handleItemInteraction = (e: React.MouseEvent | React.TouchEvent, log: FoodLog) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    if ((e.target as HTMLElement).classList.contains('drag-handle')) return;

    if (tapTimerRef.current) {
      // Second tap detected - Clear timer and trigger double tap action
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      
      if (window.confirm(`Are you sure you want to delete ${log.food.name}?`)) {
        handleDeleteLog(log.id);
      }
    } else {
      // First tap detected - start timer
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setSelectedLog(log); // Trigger single tap action
      }, 250); 
    }
  };

  // --- Drag and Drop Handlers ---
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

    // --- Vitamin Contamination Restriction Check ---
    const isDraggedVitamin = draggedLog.mealType === 'Vitamins';
    const isTargetVitamin = targetMealType === 'Vitamins';
    
    if (isDraggedVitamin && !isTargetVitamin) {
      setDraggedLog(null);
      return; // Cannot drop a vitamin into a normal category
    }
    
    if (!isDraggedVitamin && isTargetVitamin) {
      setDraggedLog(null);
      return; // Cannot drop a normal food into the vitamins category
    }

    // Get logs of the target category sorted ASCENDING (Oldest first)
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

  if (loading && foodLogs.length === 0) return <div className="loading">Loading foods...</div>;

  // --- Nutrient Calculations ---
  const adjustedBudget = (userProfile?.caloriesBudget || 0) + burnedCalories;
  const totalCalories = Math.round(foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0));
  
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
      
      {/* --- DATE NAVIGATOR --- */}
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
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setIsScannerOpen(true)}>
            📷 Scan
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { 
            setIsVitaminMode(false); 
            setScannedFood(null); 
            setScannedUpc(null); 
            setShowAddModal(true); 
          }}>
            + Add Food
          </button>
          {userProfile?.trackVitamins && (
            <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={() => { 
              setIsVitaminMode(true); 
              setScannedFood(null); 
              setScannedUpc(null); 
              setShowAddModal(true); 
            }}>
              + Add Vitamins
            </button>
          )}
        </div>
      </div>

      {/* --- NUTRIENT PROGRESS BAR SUMMARY --- */}
      <div className="food-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem', color: '#000', fontWeight: 700 }}>Calories</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center' }}>
            {totalCalories} {userProfile?.caloriesBudget ? `/ ${adjustedBudget} cal` : 'cal'}
            {burnedCalories > 0 && (
              <span style={{ fontSize: '0.9rem', color: '#ef4444', marginLeft: '0.5rem' }}>(+{burnedCalories} 🔥)</span>
            )}
          </span>
        </div>
        
        {userProfile?.caloriesBudget && (
          <div className="progress-bg" style={{ marginBottom: trackedMacros.length > 0 ? '1.5rem' : '0', height: '10px' }}>
            <div 
              className="progress-fill" 
              style={{ 
                width: `${Math.min((totalCalories / adjustedBudget) * 100, 100)}%`, 
                background: totalCalories > adjustedBudget ? '#ef4444' : 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)' 
              }} 
            />
          </div>
        )}

        {trackedMacros.length > 0 && (
          <div className="macros-grid">
            {trackedMacros.map(macro => (
              <div key={macro.label} className="macro-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#000', fontWeight: 700, fontSize: '0.85rem' }}>{macro.label}</span>
                  <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                    {macro.total}{macro.unit} {macro.budget ? `/ ${macro.budget}${macro.unit}` : ''}
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
            ))}
          </div>
        )}
      </div>

      {/* --- MEAL DIARY SECTIONS --- */}
      <div className="daily-diary">
        {mealCategories.map(mealName => {
          const logsForMeal = foodLogs.filter((log: any) => {
            if (mealName === 'Uncategorized') {
              return !log.mealType || !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Vitamins'].includes(log.mealType);
            }
            return log.mealType === mealName;
          }).sort((a, b) => a.timestamp - b.timestamp);

          if (mealName === 'Uncategorized' && logsForMeal.length === 0) return null;

          // Calculate Meal-Specific Nutrients
          const mealCalories = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0));
          const mealFat = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0));
          const mealSatFat = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0));
          const mealCarbs = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0));
          const mealFiber = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? (log as any).fiber ?? 0), 0));
          const mealSugar = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0));
          const mealProtein = Math.round(logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? (log as any).protein ?? 0), 0));

          // Construct tracked badges for this meal
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
                  
                  {/* --- NEW: Meal Specific Macros --- */}
                  {mealMacros.length > 0 && logsForMeal.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {mealMacros.map((macro, idx) => (
                        <span key={idx} style={{ 
                          fontSize: '0.7rem', 
                          color: macro.color, 
                          backgroundColor: macro.bg,
                          padding: '0.15rem 0.4rem', 
                          borderRadius: '0.25rem',
                          fontWeight: 600
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
                        className={`food-log-item ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                        onClick={(e) => handleItemInteraction(e, log)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, log)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOverItem(e, log.id)}
                        onDrop={(e) => handleDropItem(e, mealName, log.id)}
                      >
                        <div className="food-log-summary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="drag-handle" title="Drag to reorder">
                              ⠿
                            </div>
                            <div className="food-info">
                              <h4>{log.food.name}</h4>
                              {log.food.brand && <span className="brand">{log.food.brand}</span>}
                              <span className="amount">
                                {log.amount} {log.unit}
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
            </div>
          );
        })}
        
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem', fontStyle: 'italic' }}>
          * Double-tap an item to delete it.
        </p>
      </div>

      {/* --- Selected Log Detail Popup --- */}
      {selectedLog && (
        <div className="selected-log-overlay" onClick={() => setSelectedLog(null)}>
          <div className="selected-log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="selected-log-header">
              <div>
                <h3 style={{ margin: 0, color: '#1e293b' }}>{selectedLog.food.name}</h3>
                {selectedLog.food.brand && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedLog.food.brand}</span>}
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
                  { label: 'Calories', value: `${selectedLog.editedNutrition?.calories ?? selectedLog.calories} cal`, isHighlight: true },
                  { label: 'Protein', value: `${selectedLog.editedNutrition?.protein ?? selectedLog.protein ?? 0}g`, isHighlight: false },
                  { label: 'Carbs', value: `${selectedLog.editedNutrition?.carbs ?? selectedLog.carbs ?? 0}g`, isHighlight: false },
                  { label: 'Fat', value: `${selectedLog.editedNutrition?.fat ?? selectedLog.fat ?? 0}g`, isHighlight: false },
                  { label: 'Sat Fat', value: `${selectedLog.editedNutrition?.saturatedFat ?? selectedLog.saturatedFat ?? 0}g`, isHighlight: false },
                  { label: 'Trans Fat', value: `${(selectedLog as any).editedNutrition?.transFat ?? (selectedLog as any).transFat ?? (selectedLog.food as any).transFat ?? 0}g`, isHighlight: false },
                  { label: 'Cholesterol', value: `${(selectedLog as any).editedNutrition?.cholesterol ?? (selectedLog as any).cholesterol ?? (selectedLog.food as any).cholesterol ?? 0}mg`, isHighlight: false },
                  { label: 'Sodium', value: `${(selectedLog as any).editedNutrition?.sodium ?? (selectedLog as any).sodium ?? (selectedLog.food as any).sodium ?? 0}mg`, isHighlight: false },
                  { label: 'Fiber', value: `${selectedLog.editedNutrition?.fiber ?? selectedLog.fiber ?? 0}g`, isHighlight: false },
                  { label: 'Sugar', value: `${selectedLog.editedNutrition?.sugar ?? selectedLog.sugar ?? 0}g`, isHighlight: false },
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
                      fontWeight: nutrient.isHighlight ? 700 : 400
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

            <div className="selected-log-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setEditingLog(selectedLog);
                  setShowEditModal(true);
                  setSelectedLog(null);
                }}
              >
                ✏️ Edit
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDeleteLog(selectedLog.id)}
              >
                🗑️ Delete
              </button>
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
            setScannedFood(null);
            setScannedUpc(null);
            loadData(); 
          }} 
          onFoodDeleted={() => {
            loadData(); 
          }}
          selectedDate={getDateString(viewDate)} 
          isVitaminMode={isVitaminMode}
          initialFood={scannedFood}
          initialUpc={scannedUpc}
        />
      )}

      {showEditModal && editingLog && (
        <EditFoodLogModal log={editingLog} onSave={handleEditLog} onClose={() => setShowEditModal(false)} />
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={(code) => {
            setIsScannerOpen(false);
            // Check if UPC matches ANY logged item
            const matchedFood = foods.find(f => f.upc === code);
            
            if (matchedFood) {
              setScannedFood(matchedFood);
              setScannedUpc(null);
              setIsVitaminMode(!!matchedFood.isVitamin);
              setShowAddModal(true);
            } else {
              // Not found! We'll pass just the UPC and let AddFoodModal prompt the user.
              setScannedFood(null);
              setScannedUpc(code);
              setShowAddModal(true);
            }
          }}
        />
      )}
    </div>
  );
}