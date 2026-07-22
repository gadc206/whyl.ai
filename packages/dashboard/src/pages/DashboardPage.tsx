import { useEffect, useState } from 'react';
import { api, type Summary } from '../api';
import { useAuth } from '../App';

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.summary().then(setSummary);
    refreshUser();
  }, []);

  return (
    <>
      <h1>Account Summary</h1>
      <p className="muted">Welcome back, {user?.name}. WHYL is active and waits for meaningful AI thinking time.</p>
      <p className="note">
        Improve wait timing is controlled in the Chrome extension popup (on by default).{' '}
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
