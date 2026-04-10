// src/components/WeightTab.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllWeightLogs, createWeightLog, deleteWeightLog, getHealthLogs } from '../services/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

  // Time Range State for Chart
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'all'>('month');

  const topRef = useRef<HTMLDivElement>(null);

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

  if (loading) {
    return (
      <div className="weight-tab">
        <div ref={topRef} />
        <div className="loading" style={{ marginTop: '2rem' }}>Loading weight history...</div>
      </div>
    );
  }

  // --- CHART PREPARATION & TIME FILTERING ---
  const getRangeMs = () => {
    switch(timeRange) {
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      case 'year': return 365 * 24 * 60 * 60 * 1000;
      default: return Infinity;
    }
  };

  const rangeMs = getRangeMs();
  const nowMs = Date.now();
  
  const chartData = [...weightLogs]
    .filter(log => (nowMs - log.timestamp) <= rangeMs)
    .reverse() // Reverse so oldest is on the left
    .map(log => ({
      dateLabel: new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: Number(log.weight),
      unit: log.unit
    }));

  // Calculate statistics for the current selected period
  let lowest = 0, highest = 0, average = 0;
  const displayUnit = chartData.length > 0 ? chartData[0].unit : 'lbs';
  
  if (chartData.length > 0) {
    const weights = chartData.map(d => d.weight);
    lowest = Math.min(...weights);
    highest = Math.max(...weights);
    average = weights.reduce((sum, val) => sum + val, 0) / weights.length;
  }

  return (
    <div className="weight-tab">
      <div ref={topRef} />
      
      {/* 1. TITLE AT THE TOP */}
      <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Weight Tracker</h2>
      </div>

      {/* 2. CHART SECTION BELOW TITLE */}
      {weightLogs.length > 0 && (
        <div className="weight-chart-section" style={{ backgroundColor: '#fff', padding: '1.25rem 1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            {(['week', 'month', 'year', 'all'] as const).map(range => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '2rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: timeRange === range ? '#2563eb' : '#f1f5f9',
                  color: timeRange === range ? '#fff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize'
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {chartData.length < 2 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              Not enough data logged this {timeRange === 'all' ? 'period' : timeRange}.
            </div>
          ) : (
            <>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="dateLabel" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      minTickGap={20}
                      padding={{ left: 15, right: 15 }} 
                    />
                    <YAxis 
                      domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 3)), (dataMax: number) => Math.ceil(dataMax + 3)]}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickMargin={10} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '0.875rem' }}
                      itemStyle={{ color: '#2563eb', fontWeight: 600 }}
                      formatter={(value: any, name: any, props: any) => [`${value} ${props.payload.unit}`, 'Weight']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 6, fill: '#2563eb', strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* STATS ROW */}
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Lowest</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                    {lowest.toFixed(1)} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{displayUnit}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Average</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                    {average.toFixed(1)} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{displayUnit}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Highest</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                    {highest.toFixed(1)} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{displayUnit}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. BUTTON BELOW THE CHART */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => setShowForm(!showForm)}
        >
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