import { useEffect, useState } from 'react';
import { api, type Summary } from '../api';

export default function EarningsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [withdrawals, setWithdrawals] = useState<Array<{ id: string; amount: number; status: string; createdAt: string }>>([]);
  const [message, setMessage] = useState('');

  async function load() {
    setSummary(await api.summary());
    setWithdrawals(await api.withdrawals());
  }

  useEffect(() => {
    load();
  }, []);

  async function withdraw() {
    if (!summary || summary.withdrawalBalance < 100) {
      setMessage('Minimum withdrawal is 100 credits.');
      return;
    }

    await api.withdraw(summary.withdrawalBalance);
    setMessage('Withdrawal request submitted.');
    await load();
  }

  return (
    <>
      <h1>Earnings</h1>
      <p className="muted">Track current balance, lifetime earnings, and withdrawal balance.</p>
      {message && <p className="notice">{message}</p>}
      <div className="grid">
        <div className="card"><strong className="accent">{summary?.balance ?? 0}</strong><span>Current Balance</span></div>
        <div className="card"><strong>{summary?.lifetimeEarnings ?? 0}</strong><span>Lifetime Earnings</span></div>
        <div className="card"><strong>{summary?.withdrawalBalance ?? 0}</strong><span>Withdrawal Balance</span></div>
      </div>
      <button className="primary" onClick={withdraw}>Withdraw Available Credits</button>
      <h2>Withdrawals</h2>
      <div className="list">
        {withdrawals.map((withdrawal) => (
          <div className="row" key={withdrawal.id}>
            <span>{withdrawal.amount} credits</span>
            <strong>{withdrawal.status}</strong>
          </div>
        ))}
        {!withdrawals.length && <p className="muted">No withdrawals yet.</p>}
      </div>
    </>
  );
}
