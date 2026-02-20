import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserSettings.css';

interface UserSettingsProps {
  onBack: () => void;
}

export default function UserSettings({ onBack }: UserSettingsProps) {
  const { userProfile, updateUserProfile, deleteUserAccount } = useAuth();
  
  // Added "as number | string" so TypeScript allows us to temporarily 
  // hold an empty string in the input field when you backspace it.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    caloriesBudget: 2000 as number | string,
    proteinBudget: 150 as number | string,
    fiberBudget: 25 as number | string,
    trackProtein: true,
    trackFiber: true,
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
      // FIX: If the field is empty, leave it empty (''). Don't force it to 0.
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : Number(value)) : value),
    }));
  };

  const handleSave = async () => {
    if (password && password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      // Ensure we convert any accidentally left empty strings back to valid numbers before saving
      const dataToSave = {
        ...formData,
        caloriesBudget: Number(formData.caloriesBudget) || 0,
        proteinBudget: Number(formData.proteinBudget) || 0,
        fiberBudget: Number(formData.fiberBudget) || 0,
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

  if (!userProfile) {
    return <div className="loading">Loading settings...</div>;
  }

  const isBusy = isSaving || isDeleting;

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
                disabled={isBusy}
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
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isBusy}
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
                onFocus={(e) => e.target.select()} // Highlights entire number on click
                min="500"
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Daily Protein Budget (g)</label>
              <input
                type="number"
                name="proteinBudget"
                value={formData.proteinBudget}
                onChange={handleChange}
                onFocus={(e) => e.target.select()} // Highlights entire number on click
                min="0"
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Daily Fiber Budget (g)</label>
              <input
                type="number"
                name="fiberBudget"
                value={formData.fiberBudget}
                onChange={handleChange}
                onFocus={(e) => e.target.select()} // Highlights entire number on click
                min="0"
                disabled={isBusy}
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
                  disabled={isBusy}
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
                  disabled={isBusy}
                />
                Track Fiber
              </label>
            </div>
          </section>

          <div className="settings-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={isBusy}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={isBusy}>
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}