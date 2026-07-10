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
      setError('Company / startup name is required.');
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
      <section className="onboard-card">
        <div className="brand">WHYL</div>

        {step === 'welcome' && (
          <>
            <h1>While AI thinks, you earn.</h1>
            <p>Pick a side to get started — same split as whyl.ai.</p>
            <button onClick={() => setStep('side')}>Get Started</button>
          </>
        )}

        {step === 'side' && (
          <>
            <h1>I want to…</h1>
            <p className="muted">Choose how you’ll use WHYL.</p>
            <div className="side-picker">
              <button
                type="button"
                className={`side-option ${side === 'watcher' ? 'active' : ''}`}
                onClick={() => setSide('watcher')}
              >
                <strong>Earn tokens</strong>
                <span>I’m building with AI</span>
              </button>
              <button
                type="button"
                className={`side-option ${side === 'advertiser' ? 'active' : ''}`}
                onClick={() => setSide('advertiser')}
              >
                <strong>Advertise</strong>
                <span>I have a startup</span>
              </button>
            </div>
            <button onClick={() => setStep('account')}>Continue</button>
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
                {side === 'advertiser' && (
                  <>
                    <label>Company / startup name</label>
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Acme Inc."
                      required
                    />
                  </>
                )}
              </>
            )}
            <label>Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button disabled={loading}>
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
            <h1>{side === 'advertiser' ? 'Your startup' : 'Your tools'}</h1>
            {error && <p className="error">{error}</p>}
            {side === 'advertiser' ? (
              <>
                <label>Company / startup name</label>
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Acme Inc."
                  required
                />
                <p className="muted">You’ll fund campaigns that show during AI wait time.</p>
              </>
            ) : (
              <>
                <label>Which tools? (optional)</label>
                <input
                  value={tools}
                  onChange={(event) => setTools(event.target.value)}
                  placeholder="Claude, Cursor, ChatGPT…"
                />
              </>
            )}
            <button>Continue</button>
          </form>
        )}

        {step === 'permissions' && (
          <>
            <h1>Accept permissions</h1>
            <p>
              {side === 'advertiser'
                ? 'Advertisers can create and fund campaigns that reach people during AI waits.'
                : 'Setup takes less than 60 seconds. WHYL never sends your chat content to the server.'}
            </p>
            {error && <p className="error">{error}</p>}
            {(side === 'watcher'
              ? [
                  ['siteAccess', 'Detect supported AI websites'],
                  ['adDisplay', 'Display sponsored content during long waits'],
                  ['earnings', 'Track credits and balances'],
                ]
              : [
                  ['campaigns', 'Create and manage ad campaigns'],
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
            <button onClick={handlePermissions} disabled={loading}>
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1>You are ready.</h1>
            <p>
              {side === 'advertiser'
                ? 'Create your first campaign and WHYL will deliver it during AI waiting periods.'
                : 'Open ChatGPT, Claude, or Gemini. WHYL will activate automatically during longer AI waits.'}
            </p>
            <button onClick={() => navigate(side === 'advertiser' ? '/advertiser' : '/')}>
              {side === 'advertiser' ? 'Open Campaigns' : 'Open Dashboard'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
