import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { api, type AccountRole } from '../api';

type Step = 'welcome' | 'side' | 'account' | 'details' | 'permissions' | 'done';

export default function OnboardPage() {
  const { user, login, register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [side, setSide] = useState<AccountRole>(
    searchParams.get('side') === 'advertiser' ? 'advertiser' : 'watcher',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [tools, setTools] = useState('');
  const [permissions, setPermissions] = useState({
    siteAccess: false,
    adDisplay: false,
    earnings: false,
    campaigns: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const referralCode = searchParams.get('ref') || undefined;

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate(user.role === 'advertiser' ? '/advertiser' : '/', { replace: true });
      return;
    }
    if (user && !user.onboardingComplete) {
      setSide(user.role === 'advertiser' ? 'advertiser' : 'watcher');
      if (user.company) setCompany(user.company);
      setStep(user.role === 'advertiser' && !user.company ? 'details' : 'permissions');
    }
  }, [user, navigate]);

  async function handleAccount(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(email, password, name, referralCode, side, side === 'advertiser' ? company : undefined);
        setStep(side === 'advertiser' ? 'details' : 'permissions');
      } else {
        await login(email, password);
        setStep('permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleDetails(event: FormEvent) {
    event.preventDefault();
    if (side === 'advertiser' && !company.trim()) {
      setError('Company name is required.');
      return;
    }
    setError('');
    setStep('permissions');
  }

  async function handlePermissions() {
    if (side === 'watcher') {
      if (!permissions.siteAccess || !permissions.adDisplay || !permissions.earnings) {
        setError('Please accept all permissions to continue.');
        return;
      }
    } else if (!permissions.campaigns) {
      setError('Please accept campaign permissions to continue.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.completeOnboarding({
        permissionsAccepted: true,
        role: side,
        company: side === 'advertiser' ? company.trim() : undefined,
      });
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
      <section className="onboard-card waitlist-card">
        <div className="eyebrow">join whyl</div>
        <div className="brand">whyl<span className="accent">(</span>ai.thinks<span className="accent">)</span></div>

        {step === 'welcome' && (
          <>
            <h1 className="page-title">Pick a side.<br />Get set up in under a minute.</h1>
            <p className="muted">Earn during AI waits, or bid to reach people in those waits.</p>
            <button className="btn btn-primary btn-block" onClick={() => setStep('side')}>Get Started</button>
          </>
        )}

        {step === 'side' && (
          <>
            <div className="mono muted label">I want to…</div>
            <div className="side-picker">
              <button
                type="button"
                className={`side-option ${side === 'watcher' ? 'active' : ''}`}
                onClick={() => setSide('watcher')}
              >
                <div className="side-title">Earn tokens</div>
                <div className="side-sub">I’m building with AI</div>
              </button>
              <button
                type="button"
                className={`side-option ${side === 'advertiser' ? 'active' : ''}`}
                onClick={() => setSide('advertiser')}
              >
                <div className="side-title">Advertise</div>
                <div className="side-sub">I have a company</div>
              </button>
            </div>
            <p className="note">
              Starting as an earner? You can still open the advertiser marketplace later from your profile and bid on campaigns anytime.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setStep('account')}>Continue</button>
          </>
        )}

        {step === 'account' && (
          <form onSubmit={handleAccount}>
            <h1>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
            {error && <p className="error">{error}</p>}
            {mode === 'register' && (
              <>
                <label className="mono muted label">name</label>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
                {side === 'advertiser' && (
                  <>
                    <label className="mono muted label">company name</label>
                    <input
                      className="input"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Acme Inc."
                      required
                    />
                  </>
                )}
              </>
            )}
            <label className="mono muted label">email</label>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label className="mono muted label">password</label>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Working...' : mode === 'register' ? 'Create Account' : 'Log In'}
            </button>
            <button type="button" className="ghost" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Already have an account?' : 'Need an account?'}
            </button>
            <button type="button" className="ghost" onClick={() => setStep('side')}>Back</button>
          </form>
        )}

        {step === 'details' && (
          <form onSubmit={handleDetails}>
            <h1>{side === 'advertiser' ? 'Your company' : 'Your tools'}</h1>
            {error && <p className="error">{error}</p>}
            {side === 'advertiser' ? (
              <>
                <label className="mono muted label">company name</label>
                <input
                  className="input"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Acme Inc."
                  required
                />
                <p className="muted">You’ll place bids in the live order book to reach people during AI waits.</p>
              </>
            ) : (
              <>
                <label className="mono muted label">which tools? (optional)</label>
                <input
                  className="input"
                  value={tools}
                  onChange={(event) => setTools(event.target.value)}
                  placeholder="Claude, Cursor, ChatGPT…"
                />
              </>
            )}
            <button className="btn btn-primary btn-block">Continue</button>
          </form>
        )}

        {step === 'permissions' && (
          <>
            <h1>Accept permissions</h1>
            <p className="muted">
              {side === 'advertiser'
                ? 'Allow WHYL to create bids and manage campaigns that show during AI waits.'
                : 'Setup takes less than 60 seconds.'}
            </p>
            {error && <p className="error">{error}</p>}
            {(side === 'watcher'
              ? [
                  ['siteAccess', 'Detect supported AI websites'],
                  ['adDisplay', 'Display sponsored content during long waits'],
                  ['earnings', 'Track credits and balances'],
                ]
              : [
                  ['campaigns', 'Create bids and manage ad campaigns'],
                ]
            ).map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={permissions[key as keyof typeof permissions]}
                  onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
            <button className="btn btn-primary btn-block" onClick={handlePermissions} disabled={loading}>
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1>You are ready.</h1>
            <p className="muted">
              {side === 'advertiser'
                ? 'Place a bid in the live order book. Higher bids get the top serving slots.'
                : 'Open ChatGPT, Claude, or Gemini. WHYL activates during longer AI waits. You can still advertise later from your profile.'}
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => navigate(side === 'advertiser' ? '/advertiser' : '/')}
            >
              {side === 'advertiser' ? 'Open marketplace →' : 'Open Dashboard'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
