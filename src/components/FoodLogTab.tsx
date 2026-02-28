// src/components/FoodLogTab.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFoods, getDayFoodLogs, createFoodLog, deleteFoodLog, updateFoodLog, getDayWorkoutLogs } from '../services/database';
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
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Navigator State
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [navigatorSummaries, setNavigatorSummaries] = useState<Record<string, number>>({});

  // Expansion and Swipe State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [swipedLogId, setSwipedLogId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

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
      const [userFoods, logs] = await Promise.all([
        getUserFoods(user.uid),
        getDayFoodLogs(user.uid, dateStr),
      ]);
      setFoods(userFoods);
      setFoodLogs(logs);
    } catch (error) {
      console.error('Failed to load food data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Close any opened items when changing dates
    setExpandedLogId(null);
    setSwipedLogId(null);
  }, [user, viewDate]);

  useEffect(() => {
    const loadNavigatorStats = async () => {
      if (!user || viewMode === 'none') return;
      const datesToFetch = viewMode === 'monthly' ? getMonthDates(viewDate) : getWeekDates(viewDate);
      const summaries: Record<string, number> = {};

      await Promise.all(datesToFetch.map(async (date) => {
        const dStr = getDateString(date);
        const [dayFoods, workouts] = await Promise.all([
          getDayFoodLogs(user.uid, dStr),
          getDayWorkoutLogs(user.uid, dStr)
        ]);
        
        const consumed = dayFoods.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
        const burned = workouts.reduce((sum, log) => sum + log.caloriesBurned, 0);
        const budget = (userProfile?.caloriesBudget || 0) + burned;
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
      setSwipedLogId(null);
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

  // --- Touch Event Handlers for Swipe to Delete ---
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setSwipingId(id);
    setSwipeOffset(swipedLogId === id ? 80 : 0);
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (!touchStartX || !touchStartY || swipingId !== id) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;
    
    // Ignore swipe if they are primarily scrolling vertically
    if (Math.abs(diffY) > Math.abs(diffX) + 5) return;
    
    let newOffset = (swipedLogId === id ? 80 : 0) + diffX;
    if (newOffset < 0) newOffset = 0; // Prevent swiping left
    if (newOffset > 100) newOffset = 100; // Cap swipe right
    
    setSwipeOffset(newOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    if (swipingId !== id) return;
    
    // Snap open if swiped past threshold
    if (swipeOffset > 40) {
      setSwipedLogId(id);
    } else {
      setSwipedLogId(null);
    }
    
    setSwipingId(null);
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleItemClick = (e: React.MouseEvent, id: string) => {
    // If they click an inner button like "Edit", ignore expanding/collapsing logic
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;

    if (swipedLogId === id) {
      setSwipedLogId(null); // Close swipe if clicking it
    } else if (swipedLogId) {
      setSwipedLogId(null); // Close other swipes before expanding this one
    } else {
      // Toggle Expansion
      setExpandedLogId(prev => prev === id ? null : id);
    }
  };

  if (loading && foodLogs.length === 0) return <div className="loading">Loading foods...</div>;

  const totalCalories = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0);

  // Group foods by meal type for the diary layout
  const mealCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Uncategorized'];

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
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            + Add Food
          </button>
        </div>
      </div>

      <div className="food-summary">
        <span>Total: {totalCalories} cal</span>
      </div>

      {/* --- MEAL DIARY SECTIONS --- */}
      <div className="daily-diary">
        {mealCategories.map(mealName => {
          const logsForMeal = foodLogs.filter((log: any) => {
            if (mealName === 'Uncategorized') {
              return !log.mealType || !['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(log.mealType);
            }
            return log.mealType === mealName;
          });

          if (mealName === 'Uncategorized' && logsForMeal.length === 0) return null;

          const mealCalories = logsForMeal.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0);

          return (
            <div key={mealName} className="meal-section">
              <div className="meal-header">
                <h3>{mealName}</h3>
                <span className="meal-calories">{mealCalories} cal</span>
              </div>
              
              {logsForMeal.length === 0 ? (
                <div className="meal-empty">No foods logged</div>
              ) : (
                <div className="food-logs-list">
                  {logsForMeal.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const isSwiped = swipedLogId === log.id;
                    const isSwiping = swipingId === log.id;
                    
                    let transformValue = 'translateX(0px)';
                    if (isSwiping) transformValue = `translateX(${swipeOffset}px)`;
                    else if (isSwiped) transformValue = `translateX(80px)`;

                    return (
                      <div key={log.id} className="swipe-container">
                        <div className="swipe-actions-left" onClick={() => handleDeleteLog(log.id)}>
                          <span>🗑️ Delete</span>
                        </div>
                        
                        <div 
                          className={`food-log-item ${isSwiping ? 'is-swiping' : ''} ${isExpanded ? 'expanded' : ''}`}
                          style={{ transform: transformValue }}
                          onTouchStart={(e) => handleTouchStart(e, log.id)}
                          onTouchMove={(e) => handleTouchMove(e, log.id)}
                          onTouchEnd={(e) => handleTouchEnd(e, log.id)}
                          onClick={(e) => handleItemClick(e, log.id)}
                        >
                          <div className="food-log-summary">
                            <div className="food-info">
                              <h4>{log.food.name}</h4>
                              {log.food.brand && <span className="brand">{log.food.brand}</span>}
                              <span className="amount">
                                {log.amount} {log.unit}
                              </span>
                            </div>
                            <div className="food-calories">
                              <span className="calories">{log.editedNutrition?.calories ?? log.calories} cal</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="nutrition-details">
                              <div className="macro-row">
                                <div className="macro"><span>Protein</span> {log.editedNutrition?.protein ?? log.protein ?? 0}g</div>
                                <div className="macro"><span>Carbs</span> {log.editedNutrition?.carbs ?? log.carbs ?? 0}g</div>
                                <div className="macro"><span>Fat</span> {log.editedNutrition?.fat ?? log.fat ?? 0}g</div>
                                <div className="macro"><span>Sat Fat</span> {log.editedNutrition?.saturatedFat ?? log.saturatedFat ?? 0}g</div>
                                <div className="macro"><span>Trans Fat</span> {(log as any).transFat ?? (log.food as any).transFat ?? 0}g</div>
                                <div className="macro"><span>Cholesterol</span> {(log as any).cholesterol ?? (log.food as any).cholesterol ?? 0}mg</div>
                                <div className="macro"><span>Sodium</span> {(log as any).sodium ?? (log.food as any).sodium ?? 0}mg</div>
                                <div className="macro"><span>Fiber</span> {log.editedNutrition?.fiber ?? log.fiber ?? 0}g</div>
                                <div className="macro"><span>Sugar</span> {log.editedNutrition?.sugar ?? log.sugar ?? 0}g</div>
                              </div>
                              <button
                                className="btn-edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLog(log);
                                  setShowEditModal(true);
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddFoodModal 
          foods={foods} 
          onAdd={handleAddFood} 
          onClose={() => {
            setShowAddModal(false);
            loadData(); 
          }} 
          selectedDate={getDateString(viewDate)} 
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
            alert(`Successfully scanned barcode: ${code}`);
            console.log("Barcode:", code);
          }}
        />
      )}
    </div>
  );
}