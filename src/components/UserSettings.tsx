// src/components/UserSettings.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserSettings.css';

interface UserSettingsProps {
  onBack: () => void;
}

export default function UserSettings({ onBack }: UserSettingsProps) {
  const { user, userProfile, updateUserProfile, deleteUserAccount } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    caloriesBudget: '' as number | string,
    fatBudget: '' as number | string,
    saturatedFatBudget: '' as number | string,
    carbsBudget: '' as number | string,
    fiberBudget: '' as number | string,
    sugarBudget: '' as number | string,
    proteinBudget: '' as number | string,
    
    trackFat: false,
    trackSaturatedFat: false,
    trackCarbs: false,
    trackFiber: false,
    trackSugar: false,
    trackProtein: false,
    trackVitamins: false,
  });
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        caloriesBudget: userProfile.caloriesBudget || '',
        fatBudget: userProfile.fatBudget || '',
        saturatedFatBudget: userProfile.saturatedFatBudget || '',
        carbsBudget: userProfile.carbsBudget || '',
        fiberBudget: userProfile.fiberBudget || '',
        sugarBudget: userProfile.sugarBudget || '',
        proteinBudget: userProfile.proteinBudget || '',
        
        trackFat: userProfile.trackFat || false,
        trackSaturatedFat: userProfile.trackSaturatedFat || false,
        trackCarbs: userProfile.trackCarbs || false,
        trackFiber: userProfile.trackFiber || false,
        trackSugar: userProfile.trackSugar || false,
        trackProtein: userProfile.trackProtein || false,
        trackVitamins: userProfile.trackVitamins || false,
      });
    }
  }, [userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : Number(value)) : value),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    
    if (password && password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const dataToSave = {
        ...formData,
        caloriesBudget: Number(formData.caloriesBudget) || 0,
        fatBudget: Number(formData.fatBudget) || 0,
        saturatedFatBudget: Number(formData.saturatedFatBudget) || 0,
        carbsBudget: Number(formData.carbsBudget) || 0,
        fiberBudget: Number(formData.fiberBudget) || 0,
        sugarBudget: Number(formData.sugarBudget) || 0,
        proteinBudget: Number(formData.proteinBudget) || 0,
      };

      await updateUserProfile(dataToSave);
      setMessage('✓ Settings saved successfully!');
      setTimeout(() => {
        setPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (error) {
      setMessage('✗ Failed to save settings');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? All your data will be permanently erased. This cannot be undone.')) {
      return;
    }
    const userPassword = window.prompt("Security Check: Please enter your password to confirm account deletion.");
    if (!userPassword) {
      setMessage('✗ Account deletion cancelled.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserAccount(userPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setMessage('✗ Incorrect password. Account deletion cancelled.');
      } else {
        setMessage('✗ ' + (error.message || 'Failed to delete account'));
      }
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text);
    setMessage(`✓ ${successMessage}`);
    setTimeout(() => setMessage(''), 3000);
  };

  if (!userProfile) {
    return <div className="loading">Loading settings...</div>;
  }

  const isBusy = isSaving || isDeleting;
  const userId = user?.uid || userProfile?.uid || '';

  return (
    <div className="settings-container">
      <div className="settings-card">
        <header className="settings-header">
          <button className="back-btn" onClick={onBack} disabled={isBusy}>← Back</button>
          <h1>Settings</h1>
        </header>

        <div className="settings-content">
          {message && (
            <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>

            <section className="settings-section">
              <h2>Profile</h2>
              <div className="form-group">
                <label>Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required disabled={isBusy} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} disabled />
              </div>
            </section>

            <section className="settings-section">
              <h2>Change Password</h2>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" disabled={isBusy} />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" disabled={isBusy} />
              </div>
            </section>

            <section className="settings-section">
              <h2>Tracking Preferences</h2>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackFat" checked={formData.trackFat} onChange={handleChange} disabled={isBusy} /> Fat</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackSaturatedFat" checked={formData.trackSaturatedFat} onChange={handleChange} disabled={isBusy} /> Saturated Fat</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackCarbs" checked={formData.trackCarbs} onChange={handleChange} disabled={isBusy} /> Carbs</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackFiber" checked={formData.trackFiber} onChange={handleChange} disabled={isBusy} /> Fiber</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackSugar" checked={formData.trackSugar} onChange={handleChange} disabled={isBusy} /> Sugar</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackProtein" checked={formData.trackProtein} onChange={handleChange} disabled={isBusy} /> Protein</label>
              </div>
              <div className="checkbox-group">
                <label><input type="checkbox" name="trackVitamins" checked={formData.trackVitamins} onChange={handleChange} disabled={isBusy} /> Vitamins</label>
              </div>
            </section>

            {/* ADDED style={{ marginTop: '2.5rem' }} HERE FOR EXTRA SEPARATION */}
            <section className="settings-section" style={{ marginTop: '2.5rem' }}>
              <h2>Budget Settings</h2>
              <div className="form-group">
                <label>Daily Calories Budget *</label>
                <input type="number" name="caloriesBudget" value={formData.caloriesBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="500" required disabled={isBusy} />
              </div>
              
              {formData.trackFat && (
                <div className="form-group">
                  <label>Daily Fat Budget (g) *</label>
                  <input type="number" name="fatBudget" value={formData.fatBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
              {formData.trackSaturatedFat && (
                <div className="form-group">
                  <label>Daily Saturated Fat Budget (g) *</label>
                  <input type="number" name="saturatedFatBudget" value={formData.saturatedFatBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
              {formData.trackCarbs && (
                <div className="form-group">
                  <label>Daily Carbs Budget (g) *</label>
                  <input type="number" name="carbsBudget" value={formData.carbsBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
              {formData.trackFiber && (
                <div className="form-group">
                  <label>Daily Fiber Budget (g) *</label>
                  <input type="number" name="fiberBudget" value={formData.fiberBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
              {formData.trackSugar && (
                <div className="form-group">
                  <label>Daily Sugar Budget (g) *</label>
                  <input type="number" name="sugarBudget" value={formData.sugarBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
              {formData.trackProtein && (
                <div className="form-group">
                  <label>Daily Protein Budget (g) *</label>
                  <input type="number" name="proteinBudget" value={formData.proteinBudget} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" required disabled={isBusy} />
                </div>
              )}
            </section>

            <section className="settings-section" style={{ marginTop: '1rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem' }}>
              <h2>Apple Health Sync Setup</h2>
              <div className="form-group">
                <small style={{ color: '#666', marginTop: '4px', marginBottom: '12px', display: 'block' }}>
                  Paste these values into the Health Auto Export app's REST API automation.
                </small>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => copyToClipboard('https://synchealthdata-iyfojguipa-uc.a.run.app/', 'Sync URL copied!')}
                    >
                      Copy Sync URL
                    </button>
                  </div>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => copyToClipboard('x-user-id', 'Header Key copied!')}
                    >
                      Copy Key (x-user-id)
                    </button>
                  </div>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => copyToClipboard(userId, 'User ID copied!')}
                    >
                      Copy Value (User ID)
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="settings-actions">
              <button type="submit" className="btn btn-primary" disabled={isBusy}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button type="button" className="btn btn-danger" onClick={handleDeleteAccount} disabled={isBusy}>
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}