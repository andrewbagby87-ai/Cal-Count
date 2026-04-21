// src/components/WorkoutsTab.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSyncedHealthWorkouts, getIgnoredWorkouts, toggleIgnoredWorkout } from '../services/database';

export default function WorkoutsTab() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([
        getSyncedHealthWorkouts(user.uid),
        getIgnoredWorkouts(user.uid)
      ])
      .then(([healthData, ignoredData]) => {
        setWorkouts(healthData);
        setIgnoredIds(ignoredData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load workouts', err);
        setLoading(false);
      });
    }
  }, [user]);

  const handleToggle = async (workoutId: string, currentlyIgnored: boolean) => {
    if (!user) return;
    const willIgnore = !currentlyIgnored;
    
    setIgnoredIds(prev => willIgnore ? [...prev, workoutId] : prev.filter(id => id !== workoutId));
    await toggleIgnoredWorkout(user.uid, workoutId, willIgnore);
    window.dispatchEvent(new Event('workoutDataChanged'));
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading Workouts...</div>;
  }

  // --- THE ULTIMATE SAFARI DATE FIX (Extracted for sorting) ---
  const getWorkoutDate = (workout: any) => {
    const rawDate = workout.start || workout.date || workout.timestamp;
    let safeDateStr = rawDate;
    if (typeof rawDate === 'string') {
      // Splits "2026-03-03 16:44:36 -0500" into ["2026-03-03", "16:44:36", "-0500"]
      const parts = rawDate.split(' ');
      if (parts.length >= 2) {
        // Glues it back together as "2026-03-03T16:44:36-0500"
        safeDateStr = `${parts[0]}T${parts[1]}${parts[2] ? parts[2] : ''}`;
      }
    }
    return new Date(safeDateStr);
  };

  // Sort workouts from newest to oldest
  const sortedWorkouts = [...workouts].sort((a, b) => {
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
        {sortedWorkouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 1rem 0' }}>⌚️</p>
            <p style={{ color: '#64748b', margin: 0 }}>No Apple Health workouts synced yet.</p>
          </div>
        ) : (
          sortedWorkouts.map((workout, index) => {
            const title = workout.name || 'Unknown Workout';
            const durationMins = workout.duration ? Math.round(workout.duration / 60) : 0;
            
            let calories = 0;
            if (workout.activeEnergyBurned && workout.activeEnergyBurned.units === 'kcal') {
              calories = Math.round(workout.activeEnergyBurned.qty);
            }

            const workoutDate = getWorkoutDate(workout);
            
            const dateString = isNaN(workoutDate.getTime()) 
              ? 'Unknown Date' 
              : workoutDate.toLocaleDateString('en-US', { 
                  weekday: 'short', month: 'short', day: 'numeric', 
                  hour: 'numeric', minute: '2-digit' 
                });

            const uniqueKey = String(workout.id || workout.dbId || index);
            const isIgnored = ignoredIds.includes(uniqueKey);

            return (
              <div key={uniqueKey} style={{
                backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem',
                marginBottom: '1rem', border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                opacity: isIgnored ? 0.6 : 1, transition: 'opacity 0.3s ease'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', color: '#1e293b', fontSize: '1.1rem', textDecoration: isIgnored ? 'line-through' : 'none' }}>
                    {title}
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                    {dateString}
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                      <input 
                        type="checkbox" checked={!isIgnored} 
                        onChange={() => handleToggle(uniqueKey, isIgnored)} 
                        style={{ opacity: 0, width: 0, height: 0 }} 
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: isIgnored ? '#cbd5e1' : '#10b981', transition: '.3s', borderRadius: '34px'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '16px', width: '16px',
                          left: isIgnored ? '3px' : '21px', bottom: '3px',
                          backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: '0.8rem', color: isIgnored ? '#94a3b8' : '#10b981', fontWeight: 600 }}>
                      {isIgnored ? 'Ignored' : 'Counted'}
                    </span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: isIgnored ? '#94a3b8' : '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    🔥 {calories} cal
                  </div>
                  <div style={{ color: isIgnored ? '#94a3b8' : '#3b82f6', fontWeight: '600', fontSize: '0.9rem' }}>
                    ⏱️ {durationMins} min
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}