import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserSettings.css';

interface UserSettingsProps {
  onBack: () => void;
}

export default function UserSettings({ onBack }: UserSettingsProps) {
  const { userProfile, updateUserProfile, deleteUserAccount } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    caloriesBudget: 2000,
    proteinBudget: 150,
    fiberBudget: 25,
    trackProtein: true,
    trackFiber: true,
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        caloriesBudget: userProfile.caloriesBudget || 2000,
        proteinBudget: userProfile.proteinBudget || 150,
        fiberBudget: userProfile.fiberBudget || 25,
        trackProtein: userProfile.trackProtein !== false,
        trackFiber: userProfile.trackFiber !== false,
      });
    }
  }, [userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value),
    }));
  };

  const handleSave = async () => {
    if (password && password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await updateUserProfile(formData);
      setMessage('✓ Settings saved successfully!');
      setTimeout(() => {
        setPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (error) {
      setMessage('✗ Failed to save settings');
      console.error(error);
    } finally {
      setLoading(false);
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

    setLoading(true);
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
      setLoading(false);
    }
  };

  if (!userProfile) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-card">
        <header className="settings-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Settings</h1>
        </header>

        <div className="settings-content">
          {message && (
            <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <section className="settings-section">
            <h2>Profile</h2>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Your email"
                disabled
              />
            </div>
          </section>

          <section className="settings-section">
            <h2>Change Password</h2>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </section>

          <section className="settings-section">
            <h2>Budget Settings</h2>
            <div className="form-group">
              <label>Daily Calories Budget</label>
              <input
                type="number"
                name="caloriesBudget"
                value={formData.caloriesBudget}
                onChange={handleChange}
                min="500"
              />
            </div>
            <div className="form-group">
              <label>Daily Protein Budget (g)</label>
              <input
                type="number"
                name="proteinBudget"
                value={formData.proteinBudget}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Daily Fiber Budget (g)</label>
              <input
                type="number"
                name="fiberBudget"
                value={formData.fiberBudget}
                onChange={handleChange}
                min="0"
              />
            </div>
          </section>

          <section className="settings-section">
            <h2>Tracking Preferences</h2>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="trackProtein"
                  checked={formData.trackProtein}
                  onChange={handleChange}
                />
                Track Protein
              </label>
            </div>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="trackFiber"
                  checked={formData.trackFiber}
                  onChange={handleChange}
                />
                Track Fiber
              </label>
            </div>
          </section>

          <div className="settings-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}