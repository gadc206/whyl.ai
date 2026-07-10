import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { api, clearToken, setToken, type AccountRole, type User } from './api';
import Layout from './components/Layout';
import AdvertiserPage from './pages/AdvertiserPage';
import DashboardPage from './pages/DashboardPage';
import EarningsPage from './pages/EarningsPage';
import HistoryPage from './pages/HistoryPage';
import OnboardPage from './pages/OnboardPage';
import ReferralsPage from './pages/ReferralsPage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    referralCode?: string,
    role?: AccountRole,
    company?: string,
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      setUser(await api.me());
    } catch {
      clearToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('whyl_token');
    if (!token) {
      setLoading(false);
      return;
    }

    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login({ email, password });
    setToken(result.token);
    setUser(result.user);
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    referralCode?: string,
    role?: AccountRole,
    company?: string,
  ) => {
    const result = await api.register({ email, password, name, referralCode, role, company });
    setToken(result.token);
    setUser(result.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-card">Loading WHYL...</div>;
  if (!user) return <Navigate to="/onboard" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboard" replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-card">Loading WHYL...</div>;
  if (!user) return <Navigate to="/onboard" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboard" replace />;
  if (user.role === 'advertiser') return <Navigate to="/advertiser" replace />;
  return <DashboardPage />;
}

function RedirectHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(user?.role === 'advertiser' ? '/advertiser' : '/', { replace: true });
  }, [navigate, user?.role]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/onboard" element={<OnboardPage />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/advertiser" element={<AdvertiserPage />} />
          </Route>
        </Route>
        <Route path="*" element={<RedirectHome />} />
      </Routes>
    </AuthProvider>
  );
}
