import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface CampaignStat {
  id: string;
  title: string;
  advertiserName: string;
  budget: number;
  viewsTarget: number;
  viewsDelivered: number;
  bidPer1k?: number;
  viewPacks?: number;
  status?: string;
  active: boolean;
  createdAt: string;
}

function normalizeStatus(campaign: CampaignStat) {
  const delivered = Number(campaign.viewsDelivered) || 0;
  const target = Math.max(1, Number(campaign.viewsTarget) || 1);
  if (delivered >= target) return 'completed';
  const raw = (campaign.status || (campaign.active ? 'serving' : 'paused')).toLowerCase();
  if (raw === 'live') return 'serving';
  return raw;
}

function isCurrent(status: string) {
  return status === 'serving' || status === 'queued' || status === 'live';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CampaignTable({
  campaigns,
  empty,
}: {
  campaigns: CampaignStat[];
  empty: string;
}) {
  if (!campaigns.length) {
    return <p className="muted campaigns-empty">{empty}</p>;
  }

  return (
    <div className="campaigns-table">
      <div className="campaigns-cols mono muted small uppercase">
        <div>campaign</div>
        <div>status</div>
        <div className="right">bid / 1K</div>
        <div className="right">views</div>
        <div className="right">spent</div>
        <div className="right">started</div>
      </div>
      {campaigns.map((campaign) => {
        const delivered = Number(campaign.viewsDelivered) || 0;
        const target = Math.max(1, Number(campaign.viewsTarget) || 1);
        const spent = Math.round((delivered / target) * Number(campaign.budget || 0));
        const status = normalizeStatus(campaign);
        return (
          <div className="campaigns-row" key={campaign.id}>
            <div>
              <strong>{campaign.title}</strong>
              <span className="mono muted small">{campaign.advertiserName}</span>
            </div>
            <div className={`campaign-status ${status}`}>{status}</div>
            <div className="right mono">${Number(campaign.bidPer1k || 0).toFixed(2)}</div>
            <div className="right mono">
              {delivered.toLocaleString()}/{Number(campaign.viewsTarget || 0).toLocaleString()}
            </div>
            <div className="right mono">${spent.toLocaleString()}</div>
            <div className="right mono muted small">{formatDate(campaign.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.campaigns()
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  const { current, previous, totals } = useMemo(() => {
    const currentList: CampaignStat[] = [];
    const previousList: CampaignStat[] = [];
    let spent = 0;
    let views = 0;

    for (const campaign of campaigns) {
      const status = normalizeStatus(campaign);
      const delivered = Number(campaign.viewsDelivered) || 0;
      const target = Math.max(1, Number(campaign.viewsTarget) || 1);
      spent += Math.round((delivered / target) * Number(campaign.budget || 0));
      views += delivered;
      if (isCurrent(status)) currentList.push(campaign);
      else previousList.push(campaign);
    }

    return {
      current: currentList,
      previous: previousList,
      totals: { spent, views, count: campaigns.length },
    };
  }, [campaigns]);

  return (
    <div className="campaigns-page">
      <div className="campaigns-page-head">
        <div>
          <div className="eyebrow">advertiser</div>
          <h1 className="page-title">Campaigns</h1>
          <p className="muted">
            Current bids in the order book, plus previous campaign history for this account.
          </p>
        </div>
        <Link className="btn btn-primary" to="/advertiser">
          Open marketplace →
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid-3 campaigns-summary">
        <div className="card card-sm">
          <span className="mono muted small uppercase">total</span>
          <strong className="stat">{loading ? '—' : totals.count}</strong>
          <p className="muted small">campaigns on this account</p>
        </div>
        <div className="card card-sm">
          <span className="mono muted small uppercase">live now</span>
          <strong className="stat">{loading ? '—' : current.length}</strong>
          <p className="muted small">serving or queued</p>
        </div>
        <div className="card card-sm">
          <span className="mono muted small uppercase">views delivered</span>
          <strong className="stat">{loading ? '—' : totals.views.toLocaleString()}</strong>
          <p className="muted small">${totals.spent.toLocaleString()} spent</p>
        </div>
      </div>

      <section className="campaigns-section">
        <div className="campaigns-head">
          <h2>Current</h2>
          <span className="mono muted small">{current.length} active</span>
        </div>
        {loading ? (
          <p className="muted campaigns-empty">Loading campaigns…</p>
        ) : (
          <CampaignTable
            campaigns={current}
            empty="No live campaigns. Fund a bid in the marketplace to start serving."
          />
        )}
      </section>

      <section className="campaigns-section">
        <div className="campaigns-head">
          <h2>Previous</h2>
          <span className="mono muted small">{previous.length} past</span>
        </div>
        {loading ? (
          <p className="muted campaigns-empty">Loading history…</p>
        ) : (
          <CampaignTable
            campaigns={previous}
            empty="Completed and paused campaigns will show up here."
          />
        )}
      </section>
    </div>
  );
}
