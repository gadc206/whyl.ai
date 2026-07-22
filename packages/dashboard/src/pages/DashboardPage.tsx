import { useEffect, useState } from 'react';
import { api, type Summary } from '../api';
import { useAuth } from '../App';

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [improveWaitTiming, setImproveWaitTiming] = useState(user?.improveWaitTiming !== false);
  const [savingPref, setSavingPref] = useState(false);
  const [prefError, setPrefError] = useState('');

  useEffect(() => {
    api.summary().then(setSummary);
    refreshUser();
  }, []);

  useEffect(() => {
    setImproveWaitTiming(user?.improveWaitTiming !== false);
  }, [user?.improveWaitTiming]);

  async function onToggleImproveWaitTiming(next: boolean) {
    setPrefError('');
    setImproveWaitTiming(next);
    setSavingPref(true);
    try {
      await api.setPreferences({ improveWaitTiming: next });
      await refreshUser();
    } catch (err) {
      setImproveWaitTiming(!next);
      setPrefError(err instanceof Error ? err.message : 'Could not save preference');
    } finally {
      setSavingPref(false);
    }
  }

  return (
    <>
      <h1>Account Summary</h1>
      <p className="muted">Welcome back, {user?.name}. WHYL is active and waits for meaningful AI thinking time.</p>

      <label className="pref-toggle">
        <span>
          <strong>Improve wait timing</strong>
          <small>Uses chat context so ads fit how long AI takes. On by default — turn off anytime.</small>
        </span>
        <input
          type="checkbox"
          checked={improveWaitTiming}
          disabled={savingPref}
          onChange={(event) => onToggleImproveWaitTiming(event.target.checked)}
        />
      </label>
      {prefError && <p className="error">{prefError}</p>}
      <p className="note">
        <a href="https://gadc206.github.io/whyl.ai/privacy/" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </p>

      <div className="grid">
        <Stat label="Credits Balance" value={summary?.balance ?? 0} accent />
        <Stat label="Lifetime Earnings" value={summary?.lifetimeEarnings ?? 0} />
        <Stat label="Referral Earnings" value={summary?.referralEarnings ?? 0} />
        <Stat label="Pending Earnings" value={summary?.pendingEarnings ?? 0} />
        <Stat label="Withdrawal Balance" value={summary?.withdrawalBalance ?? 0} />
        <Stat label="Ads Watched" value={summary?.adsWatched ?? 0} />
      </div>
    </>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card">
      <strong className={accent ? 'accent' : ''}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
