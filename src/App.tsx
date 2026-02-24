import { Router } from 'wouter';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import SetupPage from './pages/SetupPage';

function App() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!userProfile) {
    return <SetupPage />;
  }

  return (
  <Router base="/Cal-Count">
    <Dashboard />
  </Router>
  );
}

export default App;
