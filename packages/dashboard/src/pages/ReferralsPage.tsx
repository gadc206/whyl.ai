import { useEffect, useState } from 'react';
import { api } from '../api';

interface ReferralData {
  referralCode: string;
  inviteLink: string;
  totalReferrals: number;
  totalRewards: number;
  referrals: Array<{ name: string; email: string; rewardCredits: number; joinedAt: string }>;
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);

  useEffect(() => {
    api.referrals().then(setData);
  }, []);

  return (
    <>
      <h1>Referrals</h1>
      <p className="muted">Share your invite link and earn referral rewards when someone joins.</p>
      <div className="grid">
        <div className="card"><strong>{data?.totalReferrals ?? 0}</strong><span>Total Referrals</span></div>
        <div className="card"><strong className="accent">{data?.totalRewards ?? 0}</strong><span>Referral Rewards</span></div>
      </div>
      <div className="copy-box">
        <span>{data?.inviteLink || 'Loading invite link...'}</span>
        <button onClick={() => data?.inviteLink && navigator.clipboard.writeText(data.inviteLink)}>Copy</button>
      </div>
      <div className="list">
        {data?.referrals.map((referral) => (
          <div className="row" key={`${referral.email}-${referral.joinedAt}`}>
            <span>{referral.name} joined</span>
            <strong>+{referral.rewardCredits}</strong>
          </div>
        ))}
        {data && !data.referrals.length && <p className="muted">No referrals yet.</p>}
      </div>
    </>
  );
}
