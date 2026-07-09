import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../api';

type Step = 'welcome' | 'account' | 'permissions' | 'done';

export default function OnboardPage() {
  const { user, login, register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState({ siteAccess: false, adDisplay: false, earnings: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const referralCode = searchParams.get('ref') || undefined;

  useEffect(() => {
    if (user?.onboardingComplete) navigate('/', { replace: true });
    if (user && !user.onboardingComplete) setStep('permissions');
  }, [user, navigate]);

  async function handleAccount(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') await register(email, password, name, referralCode);
      else await login(email, password);
      setStep('permissions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handlePermissions() {
    if (!permissions.siteAccess || !permissions.adDisplay || !permissions.earnings) {
      setError('Please accept all permissions to continue.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.completeOnboarding(true);
      await refreshUser();
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboard">
      <section className="onboard-card">
        <div className="brand">WHYL</div>
        {step === 'welcome' && (
          <>
            <h1>Earn while AI thinks.</h1>
            <p>WHYL runs quietly on supported AI sites and only appears when the wait is long enough to matter.</p>
            <button onClick={() => setStep('account')}>Get Started</button>
          </>
        )}

        {step === 'account' && (
          <form onSubmit={handleAccount}>
            <h1>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
            {error && <p className="error">{error}</p>}
            {mode === 'register' && (
              <>
                <label>Name</label>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </>
            )}
            <label>Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button disabled={loading}>{loading ? 'Working...' : mode === 'register' ? 'Create Account' : 'Log In'}</button>
            <button type="button" className="ghost" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Already have an account?' : 'Need an account?'}
            </button>
          </form>
        )}

        {step === 'permissions' && (
          <>
            <h1>Accept permissions</h1>
            <p>Setup takes less than 60 seconds. WHYL never sends your chat content to the server.</p>
            {error && <p className="error">{error}</p>}
            {[
              ['siteAccess', 'Detect supported AI websites'],
              ['adDisplay', 'Display sponsored content during long waits'],
              ['earnings', 'Track credits and balances'],
            ].map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={permissions[key as keyof typeof permissions]}
                  onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
            <button onClick={handlePermissions} disabled={loading}>{loading ? 'Saving...' : 'Complete Setup'}</button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1>You are ready.</h1>
            <p>Open ChatGPT, Claude, or Gemini. WHYL will activate automatically during longer AI waits.</p>
            <button onClick={() => navigate('/')}>Open Dashboard</button>
          </>
        )}
      </section>
    </div>
  );
}
