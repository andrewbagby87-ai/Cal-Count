// src/pages/AuthPage.tsx
import { useState, useEffect } from 'react';
import { 
  signUp, 
  signIn, 
  resetPassword, 
  sendCrossDeviceMagicLink, // <--- This matches the new auth.ts
  completePasswordlessLogin,
  listenForRemoteApproval   // <--- This listens for the phone!
} from '../services/auth'; 
import './AuthPage.css';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(true);

  // Forgot Password States
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Magic Link States
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showMagicModal, setShowMagicModal] = useState(false);

  // Simple real-time format validation
  useEffect(() => {
    if (!email) {
      setIsEmailValid(true);
      return;
    }
    setIsEmailValid(email.includes('@') && email.includes('.'));
  }, [email]);

  // Check for returning Magic Link users
  useEffect(() => {
    const checkEmailLink = async () => {
      if (window.location.href.includes('apiKey=') && window.location.href.includes('oobCode=')) {
        setLoading(true);
        const result = await completePasswordlessLogin();
        if (!result.success && result.error) {
          setError(result.error);
        }
        setLoading(false);
      }
    };
    checkEmailLink();
  }, []);

  // Handle Standard Login/Signup
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
    } catch (signInErr: any) {
      try {
        await signUp(email, password, '');
      } catch (signUpErr: any) {
        if (
          signUpErr.code === 'auth/email-already-in-use' || 
          (signUpErr.message && signUpErr.message.includes('email-already-in-use'))
        ) {
          setError('Invalid password for this account.');
        } else {
          setError(signUpErr instanceof Error ? signUpErr.message : 'An error occurred.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || !email) {
      setResetMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setResetLoading(true);
    setResetMessage(null);

    try {
      const result = await resetPassword(email);
      if (result.success) {
        setResetMessage({ type: 'success', text: 'Password reset email sent! Check your inbox.' });
      } else {
        setResetMessage({ type: 'error', text: result.error || 'An error occurred.' });
      }
    } catch (err: any) {
      setResetMessage({ type: 'error', text: 'An error occurred while sending the email.' });
    } finally {
      setResetLoading(false);
    }
  };

  // Process the cross-device magic link sending
  const processMagicLink = async (targetEmail: string) => {
    setLoading(true);
    setError('');
    
    // Using the NEW cross-device function
    const result = await sendCrossDeviceMagicLink(targetEmail);
    
    if (result.success && result.sessionId) {
      setMagicLinkSent(true);
      setShowMagicModal(false);

      // Start listening for the phone to approve it
      const unsubscribe = listenForRemoteApproval(result.sessionId, () => {
        console.log("Remote login successful!");
        unsubscribe(); 
      });
    } else {
      setError(result.error || 'An error occurred.');
    }
    setLoading(false);
  };

  // Triggered when clicking the main Magic Link button
  const handleMagicLinkClick = () => {
    if (isEmailValid && email) {
      processMagicLink(email);
    } else {
      setError('');
      setShowMagicModal(true);
    }
  };

  // Triggered when submitting the form inside the Magic Link modal
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || !email) {
      setError('Please enter a valid email address.');
      return;
    }
    processMagicLink(email);
  };

  // RENDER: Forgot Password View
  if (isResettingPassword) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="brand-header">
            <img src="./logo.png" alt="Cal-Count Logo" className="auth-logo" />
          </div>
          <p className="subtitle" style={{ marginBottom: '1.5rem', color: '#1e293b', fontWeight: 600 }}>
            Reset Password
          </p>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            Enter your email and we'll send you a secure link to create a new password.
          </p>

          {resetMessage && (
            <div style={{ 
              padding: '0.75rem', 
              borderRadius: '0.5rem', 
              marginBottom: '1rem',
              backgroundColor: resetMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: resetMessage.type === 'success' ? '#065f46' : '#991b1b',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {resetMessage.text}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={resetLoading}
                style={{ borderColor: !isEmailValid && email ? '#ef4444' : undefined }}
              />
              {!isEmailValid && email && (
                <span className="email-status status-invalid" style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginTop: '0.35rem' }}>
                  Invalid email format
                </span>
              )}
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={resetLoading || (!isEmailValid && email.length > 0)}>
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button 
              type="button"
              onClick={() => {
                setIsResettingPassword(false);
                setResetMessage(null);
                setError('');
              }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Standard Login View
  return (
    <>
      <div className="auth-container">
        <div className="auth-card">
          <div className="brand-header">
            <img src="./logo.png" alt="Cal-Count Logo" className="auth-logo" />
          </div>
          <p className="subtitle">
            Enter your email to sign in or create a new account
          </p>

          {error && <div className="error">{error}</div>}

          {magicLinkSent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Check your email!</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                We sent a magic link to <strong>{email}</strong>. Click the link in the email to instantly sign in.
              </p>
              <button 
                type="button"
                onClick={() => setMagicLinkSent(false)}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                ← Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{ borderColor: !isEmailValid && email ? '#ef4444' : undefined }}
                />
                {!isEmailValid && email && (
                  <span className="email-status status-invalid" style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginTop: '0.35rem' }}>
                    Invalid email format
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.3rem' }}>
                  <label htmlFor="password" style={{ margin: 0 }}>Password</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(true);
                      setError('');
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading || (!isEmailValid && email.length > 0)}>
                {loading ? 'Loading...' : 'Continue'}
              </button>

              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <hr style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
                  <span style={{ padding: '0 10px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
                  <hr style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
                </div>
                
                <button
                  type="button"
                  onClick={handleMagicLinkClick}
                  disabled={loading}
                  style={{ 
                    width: '100%', padding: '0.75rem', backgroundColor: '#f8fafc', 
                    border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, 
                    borderRadius: '0.5rem', display: 'flex', justifyContent: 'center', 
                    alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  Password-less Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* RENDER: Magic Link Modal Overlay */}
      {showMagicModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem',
          backdropFilter: 'blur(2px)'
        }}>
          <div className="auth-card" style={{ width: '100%', maxWidth: '400px', margin: 0, padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.25rem' }}>Password-less Sign In</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Enter your email address and we'll send you a secure link to sign in instantly.
            </p>

            {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleModalSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="magic-email">Email</label>
                <input
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  style={{ borderColor: !isEmailValid && email ? '#ef4444' : undefined }}
                />
                {!isEmailValid && email && (
                  <span className="email-status status-invalid" style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginTop: '0.35rem' }}>
                    Invalid email format
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <button
                  type="button"
                  style={{ 
                    flex: '1 1 0', 
                    padding: '0.85rem', 
                    backgroundColor: '#f1f5f9', 
                    color: '#475569', 
                    border: 'none', 
                    borderRadius: '0.5rem', 
                    fontWeight: 600, 
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                  onClick={() => {
                    setShowMagicModal(false);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ 
                    flex: '1 1 0', 
                    padding: '0.85rem', 
                    backgroundColor: (loading || !email || !isEmailValid) ? '#93c5fd' : '#2563eb',
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: '0.5rem', 
                    fontWeight: 600, 
                    fontSize: '1rem',
                    cursor: (loading || !email || !isEmailValid) ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box'
                  }}
                  disabled={loading || !email || !isEmailValid}
                >
                  {loading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}