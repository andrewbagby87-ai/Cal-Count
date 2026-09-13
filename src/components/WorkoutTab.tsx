// src/components/WorkoutsTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getIgnoredWorkouts, toggleIgnoredWorkout, getDayWorkoutLogs, getHealthWorkoutsForDate } from '../services/database';

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWorkoutDate = (workout: any) => {
  const rawDate = workout.start || workout.date || workout.timestamp;
  let safeDateStr = rawDate;
  if (typeof rawDate === 'string') {
    const parts = rawDate.split(' ');
    if (parts.length >= 2) safeDateStr = `${parts[0]}T${parts[1]}${parts[2] ? parts[2] : ''}`;
  }
  return new Date(safeDateStr);
};

export default function WorkoutsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 👉 NEW: Pagination Engine State
  const [visibleDays, setVisibleDays] = useState(0);
  const [manualWorkouts, setManualWorkouts] = useState<any[]>([]);
  const [healthWorkouts, setHealthWorkouts] = useState<any[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('workoutDataChanged', handleUpdate);
    return () => window.removeEventListener('workoutDataChanged', handleUpdate);
  }, []);

const fetchMoreDays = async (daysToAdd: number) => {
    if (!user) return;
    setIsLoadingMore(true);

    try {
      const ignoredData = await getIgnoredWorkouts(user.uid);
      setIgnoredIds(ignoredData);

      const datesToFetch = [];
      for (let i = 0; i < daysToAdd; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (visibleDays + i));
        datesToFetch.push(getDateString(d));
      }

      const [newManualArray, newHealthArray] = await Promise.all([
        Promise.all(datesToFetch.map(d => getDayWorkoutLogs(user.uid, d))),
        Promise.all(datesToFetch.map(d => getHealthWorkoutsForDate(user.uid, d)))
      ]);

      const newManualWorkouts = newManualArray.flat();
      const newHealthWorkouts = newHealthArray.flat();

      setManualWorkouts(prev => Array.from(new Map([...prev, ...newManualWorkouts].map(item => [item.id, item])).values()));
      setHealthWorkouts(prev => Array.from(new Map([...prev, ...newHealthWorkouts].map(item => [item.id, item])).values()));
      
      setVisibleDays(prev => prev + daysToAdd);
    } catch (err) {
      console.error('Failed to load workout chunks:', err);
    } finally {
      setIsLoadingMore(false);
      setLoading(false);
    }
  };

  // Boot up: Grab exactly the last 7 days (with Strict Mode guard!)
  const initialFetch = useRef(false);

  useEffect(() => {
    if (user && visibleDays === 0 && !initialFetch.current) {
      initialFetch.current = true;
      fetchMoreDays(7);
    }
  }, [user, visibleDays]);

  const handleToggle = async (workoutId: string, currentlyIgnored: boolean) => {
    if (!user) return;
    const willIgnore = !currentlyIgnored;
    
    setIgnoredIds(prev => willIgnore ? [...prev, workoutId] : prev.filter(id => id !== workoutId));
    await toggleIgnoredWorkout(user.uid, workoutId, willIgnore);
    window.dispatchEvent(new Event('workoutDataChanged'));
  };

  if (loading && visibleDays === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading Workouts...</div>;
  }

  // Filter strictly by date strings
  const endDateStr = getDateString(new Date());
  const startObj = new Date();
  startObj.setDate(startObj.getDate() - (visibleDays - 1));
  const startDateStr = getDateString(startObj);

  const validHealthWorkouts = healthWorkouts.filter(w => {
    const d = getWorkoutDate(w);
    if (isNaN(d.getTime())) return false;
    const dStr = getDateString(d);
    return dStr >= startDateStr && dStr <= endDateStr;
  });

  const displayedWorkouts = [...manualWorkouts, ...validHealthWorkouts].sort((a, b) => {
    const timeA = getWorkoutDate(a).getTime();
    const timeB = getWorkoutDate(b).getTime();
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>Synced Workouts</h2>
      </div>

      <div>
        {displayedWorkouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 1rem 0' }}>⌚️</p>
            <p style={{ color: '#64748b', margin: '0 0 1rem 0' }}>No data for the last {visibleDays} days.</p>
            <button 
              onClick={() => fetchMoreDays(7)}
              style={{ padding: '0.6rem 1.2rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {isLoadingMore ? 'Loading...' : 'View previous 7 days'}
            </button>
          </div>
        ) : (
          <>
            {displayedWorkouts.map((workout, index) => {
              const title = workout.name || 'Unknown Workout';
              const durationMins = workout.duration ? Math.round(workout.duration / 60) : 0;
              
              let calories = workout.caloriesBurned || 0; // Check manual logs first
              if (workout.activeEnergyBurned && workout.activeEnergyBurned.units === 'kcal') {
                calories = Math.round(workout.activeEnergyBurned.qty); // Check health logs
              }

              const workoutDate = getWorkoutDate(workout);
              const dateString = isNaN(workoutDate.getTime()) 
                ? 'Unknown Date' 
                : workoutDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

              const uniqueKey = String(workout.id || workout.dbId || index);
              const isHealthSync = !!workout.activeEnergyBurned;
              const isIgnored = isHealthSync && ignoredIds.includes(uniqueKey);

              return (
                <div key={uniqueKey} style={{
                  backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem',
                  marginBottom: '1rem', border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  opacity: isIgnored ? 0.6 : 1, transition: 'opacity 0.3s ease'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem 0', color: '#1e293b', fontSize: '1.1rem', textDecoration: isIgnored ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {title}
                      {!isHealthSync && <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none' }}>MANUAL</span>}
                    </h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                      {dateString}
                    </p>
                    
                    {isHealthSync && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                          <input type="checkbox" checked={!isIgnored} onChange={() => handleToggle(uniqueKey, isIgnored)} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isIgnored ? '#cbd5e1' : '#10b981', transition: '.3s', borderRadius: '34px' }}>
                            <span style={{ position: 'absolute', content: '""', height: '16px', width: '16px', left: isIgnored ? '3px' : '21px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }} />
                          </span>
                        </label>
                        <span style={{ fontSize: '0.8rem', color: isIgnored ? '#94a3b8' : '#10b981', fontWeight: 600 }}>
                          {isIgnored ? 'Ignored' : 'Counted'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ color: isIgnored ? '#94a3b8' : '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      🔥 {calories} cal
                    </div>
                    {durationMins > 0 && (
                      <div style={{ color: isIgnored ? '#94a3b8' : '#3b82f6', fontWeight: '600', fontSize: '0.9rem' }}>
                        ⏱️ {durationMins} min
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            <button 
              onClick={() => fetchMoreDays(7)}
              disabled={isLoadingMore}
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', cursor: isLoadingMore ? 'not-allowed' : 'pointer' }}
            >
              {isLoadingMore ? 'Loading...' : 'Show more'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}