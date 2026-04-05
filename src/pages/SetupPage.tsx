// src/pages/SetupPage.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createUserProfile } from '../services/database';
import type { UserProfile } from '../types/index';
import './SetupPage.css';

export default function SetupPage() {
  const { user, refreshUserProfile, logout } = useAuth();
  
  const [fullName, setFullName] = useState('');
  
  // Toggles (Defaulting to false so they are automatically unchecked)
  const [trackFat, setTrackFat] = useState(false);
  const [trackSaturatedFat, setTrackSaturatedFat] = useState(false);
  const [trackCarbs, setTrackCarbs] = useState(false);
  const [trackFiber, setTrackFiber] = useState(false);
  const [trackSugar, setTrackSugar] = useState(false);
  const [trackProtein, setTrackProtein] = useState(false);

  // Budgets (Start as empty strings so the fields are blank)
  const [caloriesBudget, setCaloriesBudget] = useState<string | number>('');
  const [fatBudget, setFatBudget] = useState<string | number>('');
  const [saturatedFatBudget, setSaturatedFatBudget] = useState<string | number>('');
  const [carbsBudget, setCarbsBudget] = useState<string | number>('');
  const [fiberBudget, setFiberBudget] = useState<string | number>('');
  const [sugarBudget, setSugarBudget] = useState<string | number>('');
  const [proteinBudget, setProteinBudget] = useState<string | number>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    try {
      setLoading(true);
      await logout();
    } catch (err) {
      setError('Failed to cancel and log out.');
      setLoading(false);
    }
  };

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
      if (!caloriesBudget) {
        setError('Please enter a daily calorie budget');
        setLoading(false);
        return;
      }

      // Build the raw profile, using undefined for empty budget strings
      const rawProfile = {
        name: fullName,
        email: user.email || '',
        caloriesBudget: Number(caloriesBudget),
        
        fatBudget: fatBudget !== '' ? Number(fatBudget) : undefined,
        saturatedFatBudget: saturatedFatBudget !== '' ? Number(saturatedFatBudget) : undefined,
        carbsBudget: carbsBudget !== '' ? Number(carbsBudget) : undefined,
        fiberBudget: fiberBudget !== '' ? Number(fiberBudget) : undefined,
        sugarBudget: sugarBudget !== '' ? Number(sugarBudget) : undefined,
        proteinBudget: proteinBudget !== '' ? Number(proteinBudget) : undefined,
        
        trackFat,
        trackSaturatedFat,
        trackCarbs,
        trackFiber,
        trackSugar,
        trackProtein,
        
        updatedAt: new Date(),
      };

      // Strip out the undefined values so Firebase doesn't crash or save 0s
      const profile = Object.fromEntries(
        Object.entries(rawProfile).filter(([_, v]) => v !== undefined)
      ) as any;

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
        <p>Let's personalize your tracking goals</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="setup-section">
            <div className="form-group">
              <label htmlFor="fullName">Full Name *</label>
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
            <h2>What would you like to track?</h2>
            
            <div className="checkbox-group">
              <input type="checkbox" id="t-fat" checked={trackFat} onChange={(e) => setTrackFat(e.target.checked)} />
              <label htmlFor="t-fat">Fat</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="t-sfat" checked={trackSaturatedFat} onChange={(e) => setTrackSaturatedFat(e.target.checked)} />
              <label htmlFor="t-sfat">Saturated Fat</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="t-carbs" checked={trackCarbs} onChange={(e) => setTrackCarbs(e.target.checked)} />
              <label htmlFor="t-carbs">Carbs</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="t-fiber" checked={trackFiber} onChange={(e) => setTrackFiber(e.target.checked)} />
              <label htmlFor="t-fiber">Fiber</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="t-sugar" checked={trackSugar} onChange={(e) => setTrackSugar(e.target.checked)} />
              <label htmlFor="t-sugar">Sugar</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="t-protein" checked={trackProtein} onChange={(e) => setTrackProtein(e.target.checked)} />
              <label htmlFor="t-protein">Protein</label>
            </div>
          </div>

          <div className="setup-section">
            <h2>Your Daily Budgets</h2>
            
            <div className="form-group">
              <label htmlFor="caloriesBudget">Daily Calories *</label>
              <input
                id="caloriesBudget"
                type="number"
                value={caloriesBudget}
                onChange={(e) => setCaloriesBudget(e.target.value)}
                min="500"
                required
                placeholder="e.g. 2000"
              />
            </div>

            {trackFat && (
              <div className="form-group">
                <label>Daily Fat (g) *</label>
                <input type="number" value={fatBudget} onChange={(e) => setFatBudget(e.target.value)} min="0" required placeholder="e.g. 65" />
              </div>
            )}
            
            {trackSaturatedFat && (
              <div className="form-group">
                <label>Daily Saturated Fat (g) *</label>
                <input type="number" value={saturatedFatBudget} onChange={(e) => setSaturatedFatBudget(e.target.value)} min="0" required placeholder="e.g. 20" />
              </div>
            )}

            {trackCarbs && (
              <div className="form-group">
                <label>Daily Carbs (g) *</label>
                <input type="number" value={carbsBudget} onChange={(e) => setCarbsBudget(e.target.value)} min="0" required placeholder="e.g. 250" />
              </div>
            )}

            {trackFiber && (
              <div className="form-group">
                <label>Daily Fiber (g) *</label>
                <input type="number" value={fiberBudget} onChange={(e) => setFiberBudget(e.target.value)} min="0" required placeholder="e.g. 25" />
              </div>
            )}

            {trackSugar && (
              <div className="form-group">
                <label>Daily Sugar (g) *</label>
                <input type="number" value={sugarBudget} onChange={(e) => setSugarBudget(e.target.value)} min="0" required placeholder="e.g. 30" />
              </div>
            )}

            {trackProtein && (
              <div className="form-group">
                <label>Daily Protein (g) *</label>
                <input type="number" value={proteinBudget} onChange={(e) => setProteinBudget(e.target.value)} min="0" required placeholder="e.g. 150" />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ margin: 0, flex: 1 }}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
            <button type="button" disabled={loading} className="btn btn-secondary" onClick={handleCancel} style={{ margin: 0, flex: 1, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}