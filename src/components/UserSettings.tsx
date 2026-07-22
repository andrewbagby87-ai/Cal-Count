// src/components/UserSettings.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sendEmailVerification, verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import './UserSettings.css';

interface UserSettingsProps {
  onBack: () => void;
  mode?: 'account' | 'preferences';
}

// --- ADDED DATE HELPER FOR GOAL HISTORY ---
const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function UserSettings({ onBack, mode = 'account' }: UserSettingsProps) {
  const { user, userProfile, updateUserProfile, deleteUserAccount, resetPassword } = useAuth();
  
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
    showWeightOnDashboard: true,
    showSleepOnDashboard: true,
    showCaloriesBurnedOnDashboard: true,
    showStepsOnDashboard: true,
    weightGoal: '' as number | string,
    stepGoal: '' as number | string,
  });
  
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
        showWeightOnDashboard: userProfile.showWeightOnDashboard ?? true,
        showSleepOnDashboard: userProfile.showSleepOnDashboard ?? true,
        showCaloriesBurnedOnDashboard: userProfile.showCaloriesBurnedOnDashboard ?? true,
        showStepsOnDashboard: userProfile.showStepsOnDashboard ?? true,
        weightGoal: userProfile.weightGoal || '',
        stepGoal: userProfile.stepGoal || '',
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

  const handleSendVerification = async () => {
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('✓ Verification email sent! Please check your inbox.');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/too-many-requests') {
        setMessage('✗ Too many requests. Please wait a bit and try again.');
      } else {
        setMessage('✗ Failed to send verification email.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setMessage('✗ No email address associated with this account.');
      return;
    }
    
    setIsSaving(true);
    try {
      await resetPassword(user.email);
      setMessage('✓ Password reset email sent! Check your inbox.');
    } catch (error: any) {
      console.error(error);
      setMessage('✗ Failed to send password reset email.');
    } finally {
      setIsSaving(false);
    }
  }; // <--- Make sure handlePasswordReset completely closes here!

const handleChangeEmail = async () => {
    if (!auth.currentUser) return;

    const newEmail = window.prompt("Enter your new email address:");
    
    // Cancel if they hit cancel, left it blank, or entered their current email
    if (!newEmail || newEmail.trim() === '' || newEmail === user?.email) {
      return;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setMessage('✗ Please enter a valid email address.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    
    try {
      // Firebase's secure flow: Sends verification to the NEW email, 
      // and automatically sends a security/revert notice to the OLD email.
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      
      // Note: We DO NOT update Firestore or local state here anymore, 
      // because the email doesn't actually change until they click the link!
      
      setMessage(`✓ Verification sent! Please check ${newEmail} to confirm the change.`);
    } catch (error: any) {
      console.error(error);
      // Handle Firebase's strict security requirement
      if (error.code === 'auth/requires-recent-login') {
        setMessage('✗ Security Check: Please log out and log back in before changing your email.');
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage('✗ That email is already in use by another account.');
      } else {
        setMessage('✗ ' + (error.message || 'Failed to update email.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 

    setIsSaving(true);
    setMessage('');
    try {
      // --- GOAL HISTORY SYSTEM ---
      const todayStr = getLocalTodayString();
      let updatedHistory = (userProfile as any).goalHistory ? [...(userProfile as any).goalHistory] : [];
      
      // --- CRITICAL FIX: FORCE A PAST BASELINE ---
      // If the baseline is missing, we must unshift it so future goals don't leak backwards
      if (updatedHistory.length === 0 || updatedHistory[0].date !== '2000-01-01') {
        updatedHistory.unshift({
          date: '2000-01-01', 
          caloriesBudget: userProfile?.caloriesBudget || 0,
          fatBudget: userProfile?.fatBudget || 0,
          saturatedFatBudget: userProfile?.saturatedFatBudget || 0,
          carbsBudget: userProfile?.carbsBudget || 0,
          fiberBudget: userProfile?.fiberBudget || 0,
          sugarBudget: userProfile?.sugarBudget || 0,
          proteinBudget: userProfile?.proteinBudget || 0,
        });
      }

      // Create the new entry for today and the future
        const newGoalHistoryEntry = {
        date: todayStr,
        caloriesBudget: Number(formData.caloriesBudget) || 0,
        fatBudget: Number(formData.fatBudget) || 0,
        saturatedFatBudget: Number(formData.saturatedFatBudget) || 0,
        carbsBudget: Number(formData.carbsBudget) || 0,
        fiberBudget: Number(formData.fiberBudget) || 0,
        sugarBudget: Number(formData.sugarBudget) || 0,
        proteinBudget: Number(formData.proteinBudget) || 0,
        weightGoal: formData.weightGoal ? Number(formData.weightGoal) : null,
        stepGoal: formData.stepGoal ? Number(formData.stepGoal) : null,
      };

      // Remove any existing entry for TODAY to prevent duplicates if user saves twice in one day
      updatedHistory = updatedHistory.filter((entry: any) => entry.date !== todayStr);
      updatedHistory.push(newGoalHistoryEntry);

      // Ensure it's sorted perfectly chronologically
      updatedHistory.sort((a: any, b: any) => a.date.localeCompare(b.date));

      const dataToSave = {
        ...formData,
        caloriesBudget: Number(formData.caloriesBudget) || 0,
        fatBudget: Number(formData.fatBudget) || 0,
        saturatedFatBudget: Number(formData.saturatedFatBudget) || 0,
        carbsBudget: Number(formData.carbsBudget) || 0,
        fiberBudget: Number(formData.fiberBudget) || 0,
        sugarBudget: Number(formData.sugarBudget) || 0,
        proteinBudget: Number(formData.proteinBudget) || 0,
        weightGoal: formData.weightGoal ? Number(formData.weightGoal) : null,
        stepGoal: formData.stepGoal ? Number(formData.stepGoal) : null,
        goalHistory: updatedHistory // <--- Save the history array!
      };

      await updateUserProfile(dataToSave);
      setMessage('✓ Settings saved successfully!');
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
          <h1>{mode === 'preferences' ? 'Preferences' : 'Account Settings'}</h1>
        </header>

        <div className="settings-content">
          {message && (
            <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
            {mode === 'account' && (
              <>
                <section className="settings-section">
                  <h2>Profile</h2>
                  <div className="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required disabled={isBusy} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    {/* Wrapper to handle the absolute positioning of the icon/button */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="email" 
                        name="email" 
                        value={formData.email} 
                        onChange={handleChange} 
                        disabled 
                        style={{ width: '100%', paddingRight: '70px', boxSizing: 'border-box' }} 
                      />
                      
                      <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center' }}>
                        {user?.emailVerified ? (
                          <img 
                            src="./check.png" 
                            alt="Email Verified" 
                            title="Email Verified"
                            style={{ width: '20px', height: '20px' }} 
                          />
                        ) : (
                          <button 
                            type="button"
                            onClick={handleSendVerification}
                            disabled={isBusy}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: '#0ea5e9', 
                              fontWeight: '600', 
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              padding: '0',
                              fontSize: '0.9rem'
                            }}
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Restored small Change Email link */}
                    <div style={{ marginTop: '8px', textAlign: 'right' }}>
                      <button 
                        type="button"
                        onClick={handleChangeEmail}
                        disabled={isBusy}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#64748b', 
                          textDecoration: 'underline',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          padding: '0',
                          fontSize: '0.85rem'
                        }}
                      >
                        Change Email Address
                      </button>
                    </div>

                  </div>
                </section>

                <section className="settings-section">
                  <h2>Change Password</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem', marginTop: '0' }}>
                    Click the button below to receive an email with a secure link to reset your password.
                  </p>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handlePasswordReset}
                    disabled={isBusy}
                  >
                    Send Password Reset Email
                  </button>
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
              </>
            )}

            {mode === 'preferences' && (
              <>
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

                {/* NEW: Dashboard Display Settings */}
                <section className="settings-section" style={{ marginTop: '2.5rem' }}>
                  <h2>Dashboard Display</h2>
                  <div className="checkbox-group">
                    <label><input type="checkbox" name="showWeightOnDashboard" checked={formData.showWeightOnDashboard} onChange={handleChange} disabled={isBusy} /> Show Weight</label>
                  </div>
                  <div className="checkbox-group">
                    <label><input type="checkbox" name="showCaloriesBurnedOnDashboard" checked={formData.showCaloriesBurnedOnDashboard} onChange={handleChange} disabled={isBusy} /> Show Calories Burned</label>
                  </div>
                  <div className="checkbox-group">
                    <label><input type="checkbox" name="showStepsOnDashboard" checked={formData.showStepsOnDashboard} onChange={handleChange} disabled={isBusy} /> Show Steps</label>
                  </div>
                  <div className="checkbox-group">
                    <label><input type="checkbox" name="showSleepOnDashboard" checked={formData.showSleepOnDashboard} onChange={handleChange} disabled={isBusy} /> Show Sleep</label>
                  </div>
                </section>

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

                <section className="settings-section" style={{ marginTop: '2.5rem' }}>
                  <h2>Goals (Optional)</h2>
                  <div className="form-group">
                    <label>Target Weight Goal</label>
                    <input type="number" name="weightGoal" value={formData.weightGoal} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" step="0.1" disabled={isBusy} placeholder="No Goal Set" />
                  </div>
                  <div className="form-group">
                    <label>Daily Step Goal</label>
                    <input type="number" name="stepGoal" value={formData.stepGoal} onChange={handleChange} onFocus={(e) => e.target.select()} min="0" disabled={isBusy} placeholder="No Goal Set" />
                  </div>
                </section>
              </>
            )}

            <div className="settings-actions">
              <button type="submit" className="btn btn-primary" disabled={isBusy}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              
              {mode === 'account' && (
                <button type="button" className="btn btn-danger" onClick={handleDeleteAccount} disabled={isBusy}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}