import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
// Added deleteWeightLog to the import
import { getAllWeightLogs, createWeightLog, deleteWeightLog } from '../services/database';
import { WeightLog } from '../types';
import './WeightTab.css';

// 100% Native Browser Time Converter
const formatTime12Hour = (timeValue: string) => {
  if (!timeValue) return '';
  
  try {
    const timeStr = String(timeValue);
    const [hours, minutes] = timeStr.split(':');
    
    const tempDate = new Date();
    tempDate.setHours(parseInt(hours, 10));
    tempDate.setMinutes(parseInt(minutes, 10));
    tempDate.setSeconds(0);
    
    return tempDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } catch (error) {
    return String(timeValue); 
  }
};

export default function WeightTab() {
  const { user } = useAuth();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
  
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWeightLogs = async () => {
    if (!user) return;
    try {
      const logs = await getAllWeightLogs(user.uid);
      setWeightLogs(logs);
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
      const weightNum = parseFloat(weight);
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

  // NEW: Function to handle the double-click deletion
  const handleDeleteLog = async (logId: string) => {
    if (window.confirm('Are you sure you want to delete this weight log?')) {
      try {
        await deleteWeightLog(logId);
        await loadWeightLogs(); // Refresh the list after deletion
      } catch (err) {
        console.error('Failed to delete log:', err);
        alert('Failed to delete the weight log. Please try again.');
      }
    }
  };

  if (loading) return <div className="loading">Loading weight history...</div>;

  return (
    <div className="weight-tab">
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
                placeholder="175"
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
              className="weight-log-item"
              onDoubleClick={() => handleDeleteLog(log.id)}
              title="Double-click to delete this entry"
              style={{ cursor: 'pointer' }}
            >
              <div className="log-date">
                <span className="date">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span className="time">{formatTime12Hour(log.time)}</span>
              </div>
              <div className="log-weight">
                <span className="value">{log.weight}</span>
                <span className="unit">{log.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}