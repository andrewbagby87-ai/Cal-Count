import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayFoodLogs, getDayWorkoutLogs, getAllWeightLogs } from '../services/database';
import { FoodLog, WorkoutLog, WeightLog } from '../types';
import './DailyStatsTab.css';

// Formats the 24-hour time from the database into a readable AM/PM format
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

export default function DailyStatsTab() {
  const { user, userProfile } = useAuth();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [todayWeight, setTodayWeight] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);

  // Bulletproof Local Date Builder (Guarantees YYYY-MM-DD matches your database)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const todayStr = getLocalDateString();
        
        const [foods, workouts, weights] = await Promise.all([
          getDayFoodLogs(user.uid, todayStr),
          getDayWorkoutLogs(user.uid, todayStr),
          getAllWeightLogs(user.uid),
        ]);
        
        setFoodLogs(foods || []);
        setWorkoutLogs(workouts || []);
        
        // Find ALL weights logged specifically today
        const todaysWeights = (weights || []).filter(w => w.date === todayStr);
        
        if (todaysWeights.length > 0) {
          // Sort them STRICTLY by the 24-hour time string ("15:30" comes before "07:14")
          // This avoids the Firebase Timestamp math error!
          todaysWeights.sort((a, b) => {
            const timeA = a.time || "00:00";
            const timeB = b.time || "00:00";
            return timeB.localeCompare(timeA);
          });
          
          setTodayWeight(todaysWeights[0]);
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
  }, [user]);

  if (loading) return <div className="loading">Loading stats...</div>;

  const todayDisplay = getLocalDateString();
  
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
      <h2>Today's Summary</h2>
      <p className="date">{new Date(todayDisplay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

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
        
        {/* Today's Weight Tile */}
        <div className="stats-card half-width-card">
          <div className="stat-item">
            <span className="stat-label">Today's Weight</span>
            {todayWeight ? (
              <div className="weight-highlight">
                <span className="weight-number">{todayWeight.weight}</span>
                <span className="weight-unit">{todayWeight.unit}</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem', alignSelf: 'center' }}>
                  at {formatTime12Hour(todayWeight.time)}
                </span>
              </div>
            ) : (
              <div className="empty-weight">
                <span>No weight logged today</span>
              </div>
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
    </div>
  );
}