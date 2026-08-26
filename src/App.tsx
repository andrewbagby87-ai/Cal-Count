import { Router, Route, Switch } from 'wouter';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import SetupPage from './pages/SetupPage';
import AdminDashboard from './components/AdminDashboard';

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
        <Switch>
          <Route path="/admin">
            <AdminDashboard />
          </Route>
          
          <Route>
            <Dashboard />
          </Route>
        </Switch>
      </Router>
  );
}

export default App;
