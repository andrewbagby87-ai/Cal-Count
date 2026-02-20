import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDayWorkoutLogs, createWorkoutLog, deleteWorkoutLog } from '../services/database';
import { WorkoutLog } from '../types';
import './WorkoutTab.css';

export default function WorkoutTab() {
  const { user } = useAuth();
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [duration, setDuration] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWorkoutLogs = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const logs = await getDayWorkoutLogs(user.uid, today);
      setWorkoutLogs(logs);
    } catch (err) {
      console.error('Failed to load workout logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkoutLogs();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user || !duration || !caloriesBurned) {
      setError('Please enter duration and calories burned');
      return;
    }

    try {
      setSubmitting(true);
      const durationNum = parseFloat(duration);
      const caloriesNum = parseFloat(caloriesBurned);

      if (isNaN(durationNum) || durationNum <= 0) {
        throw new Error('Please enter a valid duration (in minutes)');
      }
      if (isNaN(caloriesNum) || caloriesNum <= 0) {
        throw new Error('Please enter a valid calorie amount');
      }

      const today = new Date().toISOString().split('T')[0];
      await createWorkoutLog(user.uid, {
        date: today,
        duration: durationNum,
        caloriesBurned: caloriesNum,
      });

      setDuration('');
      setCaloriesBurned('');
      setShowForm(false);
      await loadWorkoutLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('Delete this workout entry?')) return;
    
    try {
      await deleteWorkoutLog(logId);
      await loadWorkoutLogs();
    } catch (err) {
      console.error('Failed to delete workout:', err);
    }
  };

  if (loading) return <div className="loading">Loading workouts...</div>;

  const totalCaloriesBurned = workoutLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const totalDuration = workoutLogs.reduce((sum, log) => sum + log.duration, 0);

  return (
    <div className="workout-tab">
      <div className="tab-header">
        <h2>Workouts</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Workout'}
        </button>
      </div>

      {workoutLogs.length > 0 && (
        <div className="workout-summary">
          <div className="summary-item">
            <span className="label">Total Time</span>
            <span className="value">{totalDuration} min</span>
          </div>
          <div className="summary-item">
            <span className="label">Calories Burned</span>
            <span className="value">{totalCaloriesBurned}</span>
          </div>
        </div>
      )}

      {showForm && (
        <form className="workout-form" onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="duration">Duration (minutes) *</label>
              <input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                required
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="calories">Calories Burned *</label>
              <input
                id="calories"
                type="number"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
                placeholder="250"
                required
                min="1"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Log Workout'}
          </button>
        </form>
      )}

      {workoutLogs.length === 0 ? (
        <div className="empty-state">
          <p>No workouts logged today</p>
          <p className="text-sm">Add a workout to increase your calorie budget</p>
        </div>
      ) : (
        <div className="workout-logs">
          {workoutLogs.map((log) => (
            <div key={log.id} className="workout-log-item">
              <div className="workout-info">
                <span className="duration">⏱️ {log.duration} min</span>
                <span className="calories">🔥 {log.caloriesBurned} cal</span>
              </div>
              <button
                className="action-btn delete"
                onClick={() => handleDelete(log.id)}
                title="Delete this workout"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
