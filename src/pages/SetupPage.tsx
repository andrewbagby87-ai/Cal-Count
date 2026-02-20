import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createUserProfile } from '../services/database';
import type { UserProfile } from '../types/index';
import './SetupPage.css';

export default function SetupPage() {
  const { user, refreshUserProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [dailyCalorieBudget, setDailyCalorieBudget] = useState('2000');
  const [dailyProteinBudget, setDailyProteinBudget] = useState('150');
  const [dailyFiberBudget, setDailyFiberBudget] = useState('25');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!fullName.trim()) {
        setError('Please enter your name');
        setLoading(false);
        return;
      }

      const caloriesBudget = parseInt(dailyCalorieBudget) || 2000;
      const proteinBudget = parseInt(dailyProteinBudget) || 150;
      const fiberBudget = parseInt(dailyFiberBudget) || 25;

      const profile: Omit<UserProfile, 'uid' | 'createdAt'> = {
        name: fullName,
        email: user.email || '',
        caloriesBudget,
        proteinBudget,
        fiberBudget,
        trackProtein: true,
        trackFiber: true,
        updatedAt: new Date(),
      };

      await createUserProfile(user.uid, profile);
      await refreshUserProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h1>Welcome to Cal-Count</h1>
        <p>Let's set up your profile</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="setup-section">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>

          <div className="setup-section">
            <h2>Your Daily Goals</h2>
            <div className="form-group">
              <label htmlFor="caloriesBudget">Daily Calorie Budget</label>
              <input
                id="caloriesBudget"
                type="number"
                value={dailyCalorieBudget}
                onChange={(e) => setDailyCalorieBudget(e.target.value)}
                min="500"
                max="10000"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="proteinBudget">Daily Protein Budget (g)</label>
              <input
                id="proteinBudget"
                type="number"
                value={dailyProteinBudget}
                onChange={(e) => setDailyProteinBudget(e.target.value)}
                min="0"
                max="500"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fiberBudget">Daily Fiber Budget (g)</label>
              <input
                id="fiberBudget"
                type="number"
                value={dailyFiberBudget}
                onChange={(e) => setDailyFiberBudget(e.target.value)}
                min="0"
                max="100"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}