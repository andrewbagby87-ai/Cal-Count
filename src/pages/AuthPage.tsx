// src/pages/AuthPage.tsx
import { useState, useEffect } from 'react';
import { signUp, signIn } from '../services/auth';
import './AuthPage.css';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(true);

  // Simple real-time format validation (no database calls that Firebase blocks)
  useEffect(() => {
    if (!email) {
      setIsEmailValid(true);
      return;
    }
    setIsEmailValid(email.includes('@') && email.includes('.'));
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // 1. Always attempt to sign in first
      await signIn(email, password);
    } catch (signInErr: any) {
      // 2. If sign in fails, it's either a wrong password OR a brand new user.
      // We safely attempt to create an account to find out.
      try {
        await signUp(email, password, '');
      } catch (signUpErr: any) {
        // 3. If sign up ALSO fails because the email is in use, 
        // that means it WAS an existing account, they just typed the wrong password.
        if (
          signUpErr.code === 'auth/email-already-in-use' || 
          (signUpErr.message && signUpErr.message.includes('email-already-in-use'))
        ) {
          setError('Invalid password for this account.');
        } else {
          // Catch other errors (e.g., password too weak)
          setError(signUpErr instanceof Error ? signUpErr.message : 'An error occurred.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-header">
          <img src="./logo.png" alt="Cal-Count Logo" className="auth-logo" />
        </div>
        <p className="subtitle">
          Enter your email to sign in or create a new account
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Added inline margin-bottom to tightly control the gap */}
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
            {/* Removed the minHeight container so it takes up zero space when hidden */}
            {!isEmailValid && email && (
              <span className="email-status status-invalid" style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginTop: '0.35rem' }}>
                Invalid email format
              </span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password">Password</label>
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
        </form>
      </div>
    </div>
  );
}