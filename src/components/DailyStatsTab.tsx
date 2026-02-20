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
  const caloriesConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0);
  const caloriesBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const totalBudget = (userProfile?.caloriesBudget || 0) + caloriesBurned;
  const remaining = totalBudget - caloriesConsumed;
  const percentage = Math.round((caloriesConsumed / totalBudget) * 100);

  const proteinConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.protein ?? log.protein ?? 0), 0);
  const fiberConsumed = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.fiber ?? log.fiber ?? 0), 0);

  return (
    <div className="daily-stats">
      <h2>Today's Summary</h2>
      <p className="date">{new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      <div className="stats-card">
        <div className="stat-item">
          <span className="stat-label">Calories</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
          </div>
          <div className="stat-value">
            <span className="consumed">{caloriesConsumed}</span>
            <span className="separator">/</span>
            <span className="budget">{totalBudget}</span>
          </div>
          <span className={`remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
            {remaining >= 0 ? '+' : ''}{remaining} remaining
          </span>
        </div>

        {userProfile?.trackProtein && (
          <div className="stat-item">
            <div className="stat-label">Protein</div>
            <span className="budget">{userProfile.proteinBudget}g</span>
          </div>
        )}

        {userProfile?.trackFiber && (
          <div className="stat-item">
            <div className="stat-label">Fiber</div>
            <span className="budget">{userProfile.fiberBudget}g</span>
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
