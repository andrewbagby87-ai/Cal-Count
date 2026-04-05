// src/components/WeightTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllWeightLogs, createWeightLog, deleteWeightLog, getHealthLogs } from '../services/database';
import './WeightTab.css';

const formatTime12Hour = (timeValue: string) => {
  if (!timeValue) return '';
  try {
    const timeStr = String(timeValue);
    const [hours, minutes] = timeStr.split(':');
    const tempDate = new Date();
    tempDate.setHours(parseInt(hours, 10));
    tempDate.setMinutes(parseInt(minutes, 10));
    tempDate.setSeconds(0);
    return tempDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch (error) {
    return String(timeValue); 
  }
};

const parseSafeDate = (dateVal: any, fallbackTimestamp: number) => {
  if (!dateVal) return new Date(fallbackTimestamp);
  if (typeof dateVal === 'number') return new Date(dateVal);
  
  let dStr = String(dateVal);
  
  let d = new Date(dStr);
  if (!isNaN(d.getTime())) return d;

  dStr = dStr.replace(' ', 'T').replace(' -', '-').replace(' +', '+');
  d = new Date(dStr);
  if (!isNaN(d.getTime())) return d;

  return new Date(fallbackTimestamp);
};

const formatSyncDate = (dateObj: Date) => {
  if (isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}`,
    timeMs: dateObj.getTime()
  };
};

const parseUnit = (u: string) => {
  if (!u) return 'lbs';
  return u.toLowerCase().includes('kg') ? 'kg' : 'lbs';
};

export default function WeightTab() {
  const { user } = useAuth();
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
  
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Create the reference point for scrolling to the top
  const topRef = useRef<HTMLDivElement>(null);

  // 2. Scroll to the reference point instantly when the tab loads
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);

  const loadWeightLogs = async () => {
    if (!user) return;
    try {
      const [dbLogs, healthLogsRaw] = await Promise.all([
        getAllWeightLogs(user.uid),
        getHealthLogs(user.uid)
      ]);

      const healthWeightLogs: any[] = [];
      
      healthLogsRaw.forEach((log: any, index: number) => {
        const baseTimestamp = new Date(log.timestamp || Date.now()).getTime();
        const payloadId = log.id || `sync-${index}`;

        const processMetric = (metric: any) => {
          if (metric.name === 'weight_body_mass' && Array.isArray(metric.data)) {
            metric.data.forEach((entry: any, i: number) => {
              const dateObj = parseSafeDate(entry.date, baseTimestamp);
              const parsedDate = formatSyncDate(dateObj);
              
              if (parsedDate) {
                healthWeightLogs.push({
                  id: `health-sync-${payloadId}-${i}`,
                  date: parsedDate.dateStr,
                  time: parsedDate.timeStr,
                  // We also round the imported sync data just in case
                  weight: Math.round(Number(entry.qty || entry.value || 0) * 10) / 10,
                  unit: parseUnit(metric.units || log.units),
                  timestamp: parsedDate.timeMs,
                  isSynced: true
                });
              }
            });
          }
        };

        if (log.name === 'weight_body_mass') {
          if (Array.isArray(log.data)) {
            processMetric(log);
          } else {
            const dateObj = parseSafeDate(log.date, baseTimestamp);
            const parsedDate = formatSyncDate(dateObj);
            if (parsedDate) {
              healthWeightLogs.push({
                id: `health-sync-flat-${payloadId}`,
                date: parsedDate.dateStr,
                time: parsedDate.timeStr,
                weight: Math.round(Number(log.qty || log.value || log.weight || 0) * 10) / 10,
                unit: parseUnit(log.units || log.unit),
                timestamp: parsedDate.timeMs,
                isSynced: true
              });
            }
          }
        } else if (Array.isArray(log.metrics)) {
          log.metrics.forEach(processMetric);
        } else if (log.data && Array.isArray(log.data.metrics)) {
          log.data.metrics.forEach(processMetric);
        }
      });

      const validHealthLogs = healthWeightLogs.filter(log => log.weight > 0);
      const combinedLogs = [...dbLogs, ...validHealthLogs].sort((a, b) => b.timestamp - a.timestamp);
      
      // Deduplicate the combined logs
      const seen = new Set();
      const uniqueLogs = combinedLogs.filter(log => {
        const uniqueKey = `${log.date}_${log.time}_${log.weight}`;
        if (seen.has(uniqueKey)) {
          return false; 
        }
        seen.add(uniqueKey); 
        return true; 
      });

      setWeightLogs(uniqueLogs);
    } catch (err) {
      console.error('Failed to load weight logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeightLogs();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user || !weight) {
      setError('Please enter a weight');
      return;
    }

    try {
      setSubmitting(true);
      // Round to the nearest tenth place before saving to Firebase
      const weightNum = Math.round(parseFloat(weight) * 10) / 10;
      if (isNaN(weightNum) || weightNum <= 0) {
        throw new Error('Please enter a valid weight');
      }

      await createWeightLog(user.uid, {
        date,
        time,
        weight: weightNum,
        unit,
      });

      setWeight('');
      setShowForm(false);
      await loadWeightLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (log: any) => {
    if (log.isSynced) {
      alert('This entry is synced from Apple Health and cannot be deleted here.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this weight log?')) {
      try {
        await deleteWeightLog(log.id);
        await loadWeightLogs(); 
      } catch (err) {
        console.error('Failed to delete log:', err);
        alert('Failed to delete the weight log. Please try again.');
      }
    }
  };

  // Render the anchor even while loading so the scroll effect works instantly
  if (loading) {
    return (
      <div className="weight-tab">
        <div ref={topRef} />
        <div className="loading" style={{ marginTop: '2rem' }}>Loading weight history...</div>
      </div>
    );
  }

  return (
    <div className="weight-tab">
      {/* Invisible anchor point for auto-scrolling to the top */}
      <div ref={topRef} />
      
      <div className="tab-header">
        <h2>Weight Tracker</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Log Weight'}
        </button>
      </div>

      {showForm && (
        <form className="weight-form" onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="weight">Weight *</label>
              <input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="175.0"
                required
                min="0"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="unit">Unit</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                <option value="lbs">Pounds (lbs)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="time">Time *</label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Weight'}
          </button>
        </form>
      )}

      {weightLogs.length === 0 ? (
        <div className="empty-state">
          <p>No weight entries yet</p>
          <p className="text-sm">Start tracking your weight to monitor progress</p>
        </div>
      ) : (
        <div className="weight-logs">
          {weightLogs.map((log) => (
            <div 
              key={log.id} 
              className={`weight-log-item ${log.isSynced ? 'synced-item' : ''}`}
              onDoubleClick={() => handleDeleteLog(log)}
              title={log.isSynced ? "Synced from Apple Health" : "Double-click to delete this entry"}
              style={{ cursor: log.isSynced ? 'default' : 'pointer' }}
            >
              <div className="log-date">
                <span className="date">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span className="time">{formatTime12Hour(log.time)}</span>
                {log.isSynced && (
                  <span style={{ fontSize: '0.75rem', color: '#2563eb', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                    Health Sync
                  </span>
                )}
              </div>
              <div className="log-weight">
                {/* Use .toFixed(1) to guarantee exactly 1 decimal place is shown in the UI */}
                <span className="value">{Number(log.weight).toFixed(1)}</span>
                <span className="unit">{log.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}