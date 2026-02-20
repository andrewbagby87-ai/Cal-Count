import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createWeightLog } from '../services/database';
import './WeightPrompt.css';

interface Props {
  onClose: (action: 'yes' | 'no' | 'later') => void;
}

export default function WeightPrompt({ onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'prompt' | 'form'>('prompt');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      await createWeightLog(user.uid, {
        date: today,
        time,
        weight: weightNum,
        unit,
      });

      localStorage.setItem('lastWeightPromptDate', today);
      onClose('yes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="weight-prompt-overlay" onClick={() => onClose('later')}>
      <div className="weight-prompt-content" onClick={(e) => e.stopPropagation()}>
        {step === 'prompt' ? (
          <div className="prompt-message">
            <h3>🏋️ Log Your Weight Today?</h3>
            <p>Start your day by logging your weight to track progress over time.</p>

            <div className="prompt-buttons">
              <button className="btn btn-primary" onClick={() => setStep('form')}>
                Yes
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  localStorage.setItem('lastWeightPromptDate', today);
                  onClose('no');
                }}
              >
                No
              </button>
              <button className="btn btn-outline" onClick={() => onClose('later')}>
                Maybe Later
              </button>
            </div>
          </div>
        ) : (
          <div className="weight-form-prompt">
            <h3>Enter Your Weight</h3>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="prompt-weight">Weight *</label>
                  <input
                    id="prompt-weight"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="175"
                    required
                    min="0"
                    step="0.1"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prompt-unit">Unit</label>
                  <select id="prompt-unit" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save & Continue'}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                localStorage.setItem('lastWeightPromptDate', today);
                onClose('no');
              }}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
