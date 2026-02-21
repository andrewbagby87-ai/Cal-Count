import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayFoodLogs, getDayWorkoutLogs } from '../services/database';
import { FoodLog, WorkoutLog } from '../types';
import './DailyStatsTab.css';

export default function DailyStatsTab() {
  const { user, userProfile } = useAuth();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const [foods, workouts] = await Promise.all([
          getDayFoodLogs(user.uid, today),
          getDayWorkoutLogs(user.uid, today),
        ]);
        setFoodLogs(foods);
        setWorkoutLogs(workouts);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) return <div className="loading">Loading stats...</div>;

  const today = new Date().toISOString().split('T')[0];
  
  // Calorie Calculations
  const caloriesConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories ?? 0), 0);
  const caloriesBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const totalBudget = (userProfile?.caloriesBudget || 0) + caloriesBurned;
  const remaining = totalBudget - caloriesConsumed;
  const percentage = Math.round((caloriesConsumed / (totalBudget || 1)) * 100);

  // Nutrient Calculations
  const fatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fat ?? (log as any).fat ?? 0), 0);
  const saturatedFatConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.saturatedFat ?? (log as any).saturatedFat ?? 0), 0);
  const carbsConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.carbs ?? (log as any).carbs ?? 0), 0);
  const fiberConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? log.fiber ?? 0), 0);
  const sugarConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.sugar ?? (log as any).sugar ?? 0), 0);
  const proteinConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? log.protein ?? 0), 0);

  return (
    <div className="daily-stats">
      <h2>Today's Summary</h2>
      <p className="date">{new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      <div className="stats-card">
        {/* Main Calorie Tracker */}
        <div className="stat-item">
          <span className="stat-label">Calories</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
          </div>
          <div className="stat-value">
            <span className="consumed">{Math.round(caloriesConsumed)}</span>
            <span className="separator">/</span>
            <span className="budget">{totalBudget}</span>
          </div>
          <span className={`remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
            {remaining >= 0 ? '+' : ''}{Math.round(remaining)} remaining
          </span>
        </div>

        {/* Dynamic Nutrient Trackers */}
        {userProfile?.trackFat && (
          <div className="stat-item">
            <div className="stat-label">Fat</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(fatConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.fatBudget}g</span>
            </div>
          </div>
        )}

        {userProfile?.trackSaturatedFat && (
          <div className="stat-item">
            <div className="stat-label">Saturated Fat</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(saturatedFatConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.saturatedFatBudget}g</span>
            </div>
          </div>
        )}

        {userProfile?.trackCarbs && (
          <div className="stat-item">
            <div className="stat-label">Carbs</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(carbsConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.carbsBudget}g</span>
            </div>
          </div>
        )}

        {userProfile?.trackFiber && (
          <div className="stat-item">
            <div className="stat-label">Fiber</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(fiberConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.fiberBudget}g</span>
            </div>
          </div>
        )}

        {userProfile?.trackSugar && (
          <div className="stat-item">
            <div className="stat-label">Sugar</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(sugarConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.sugarBudget}g</span>
            </div>
          </div>
        )}

        {userProfile?.trackProtein && (
          <div className="stat-item">
            <div className="stat-label">Protein</div>
            <div className="stat-value">
              <span className="consumed">{Math.round(proteinConsumed)}g</span>
              <span className="separator">/</span>
              <span className="budget">{userProfile.proteinBudget}g</span>
            </div>
          </div>
        )}
      </div>

      {caloriesBurned > 0 && (
        <div className="stats-card">
          <div className="stat-item">
            <span className="stat-label">Calories Burned (Workouts)</span>
            <div className="stat-value">
              <span className="burned">{caloriesBurned}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}