// src/components/WeightTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getWeightLogsForDate, createWeightLog, deleteWeightLog, getHealthMetricsForDate } from '../services/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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
  
  return { dateStr: `${year}-${month}-${day}`, timeStr: `${hours}:${minutes}`, timeMs: dateObj.getTime() };
};

const parseUnit = (u: string) => u.toLowerCase().includes('kg') ? 'kg' : 'lbs';

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function WeightTab() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 👉 NEW: Pagination Engine State
  const [visibleDays, setVisibleDays] = useState(0); 
  const [manualWeights, setManualWeights] = useState<any[]>([]);
  const [healthWeights, setHealthWeights] = useState<any[]>([]);

  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'all'>('week');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  const fetchMoreDays = async (daysToAdd: number) => {
    if (!user) return;
    setIsLoadingMore(true);

    try {
      const datesToFetch = [];
      for (let i = 0; i < daysToAdd; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (visibleDays + i));
        datesToFetch.push(getDateString(d));
      }

      const [newManualArray, newHealthArray] = await Promise.all([
        Promise.all(datesToFetch.map(d => getWeightLogsForDate(user.uid, d))),
        Promise.all(datesToFetch.map(d => getHealthMetricsForDate(user.uid, d)))
      ]);

      const newManualLogs = newManualArray.flat();
      const newHealthMetrics = newHealthArray.flat();

      const parsedHealth: any[] = [];
      newHealthMetrics.forEach((m: any) => {
        if (m.name === 'weight_body_mass' || m.name === 'body_mass') {
           const timeMs = m.timestamp || new Date(m.date).getTime();
           const d = new Date(timeMs);
           parsedHealth.push({
             id: m.id, date: m.date, 
             time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
             weight: Math.round(Number(m.qty || m.value || m.weight || 0) * 10) / 10, 
             unit: m.units?.toLowerCase().includes('kg') ? 'kg' : 'lbs',
             timestamp: timeMs, isSynced: true
           });
        }
      });

      setManualWeights(prev => Array.from(new Map([...prev, ...newManualLogs].map(item => [item.id, item])).values()));
      setHealthWeights(prev => Array.from(new Map([...prev, ...parsedHealth].map(item => [item.id, item])).values()));
      
      setVisibleDays(prev => prev + daysToAdd);
    } catch (err) {
      console.error('Failed to load weight chunks:', err);
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

// Filter strictly by date strings
  const endDateStr = getDateString(new Date());
  const startObj = new Date();
  startObj.setDate(startObj.getDate() - (visibleDays - 1));
  const startDateStr = getDateString(startObj);

  const validHealthLogs = healthWeights.filter(log => log.date >= startDateStr && log.date <= endDateStr);
  
  const displayedLogs = [...manualWeights, ...validHealthLogs]
    .map(log => ({ ...log, timestamp: log.timestamp || new Date(`${log.date}T12:00:00`).getTime() }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((log, index, self) => index === self.findIndex(t => t.date === log.date && t.time === log.time && t.weight === log.weight));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user || !weight) { setError('Please enter a weight'); return; }

    try {
      setSubmitting(true);
      const weightNum = Math.round(parseFloat(weight) * 10) / 10;
      if (isNaN(weightNum) || weightNum <= 0) throw new Error('Please enter a valid weight');

      await createWeightLog(user.uid, { date, time, weight: weightNum, unit });
      setWeight('');
      setShowForm(false);
      
      // Refresh the currently visible chunk
      setVisibleDays(0);
      setManualWeights([]);
      await fetchMoreDays(visibleDays || 7); 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (log: any) => {
    if (log.isSynced) { alert('This entry is synced from Apple Health and cannot be deleted here.'); return; }
    if (window.confirm('Are you sure you want to delete this weight log?')) {
      try {
        await deleteWeightLog(log.id);
        setManualWeights(prev => prev.filter(w => w.id !== log.id));
      } catch (err) {
        console.error('Failed to delete log:', err);
        alert('Failed to delete the weight log. Please try again.');
      }
    }
  };

  const handleTimeRangeChange = async (range: 'week' | 'month' | 'year' | 'all') => {
    setTimeRange(range);
    let requiredDays = 7;
    if (range === 'month') requiredDays = 30;
    if (range === 'year') requiredDays = 365;
    if (range === 'all') requiredDays = 730; // Max out at 2 years

    // Smart Fetch: If the chart requires more data than we've downloaded, download the difference!
    if (visibleDays < requiredDays) {
       await fetchMoreDays(requiredDays - visibleDays);
    }
  };

  if (loading && visibleDays === 0) {
    return <div className="weight-tab"><div className="loading" style={{ marginTop: '2rem' }}>Loading weight history...</div></div>;
  }

  return (
    <div className="weight-tab">
      <div ref={topRef} />
      
      <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Weight Tracker</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
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
              <input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="175.0" required min="0" step="0.1" />
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
              <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="time">Time *</label>
              <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Weight'}</button>
        </form>
      )}

      {displayedLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 1rem 0' }}>⚖️</p>
          <p style={{ color: '#64748b', margin: '0 0 1rem 0' }}>No data for the last {visibleDays} days.</p>
          <button 
            onClick={() => fetchMoreDays(7)}
            style={{ padding: '0.6rem 1.2rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {isLoadingMore ? 'Loading...' : 'View previous 7 days'}
          </button>
        </div>
      ) : (
        <div className="weight-logs">
          {displayedLogs.map((log) => (
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
                {log.isSynced && <span style={{ fontSize: '0.75rem', color: '#2563eb', display: 'block', marginTop: '4px', fontWeight: 600 }}>Health Sync</span>}
              </div>
              <div className="log-weight">
                <span className="value">{Number(log.weight).toFixed(1)}</span>
                <span className="unit">{log.unit}</span>
              </div>
            </div>
          ))}
          
          <button 
            onClick={() => fetchMoreDays(7)}
            disabled={isLoadingMore}
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', cursor: isLoadingMore ? 'not-allowed' : 'pointer' }}
          >
            {isLoadingMore ? 'Loading...' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}