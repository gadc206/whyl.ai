import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const DEMO_BOOK = [
  { name: 'Ramp', initial: 'R', bid: 4.2, impr: '128k' },
  { name: 'Vercel', initial: 'V', bid: 3.85, impr: '96k' },
  { name: 'Linear', initial: 'L', bid: 2.1, impr: '54k' },
  { name: 'Neon', initial: 'N', bid: 1.6, impr: '40k' },
  { name: 'Resend', initial: 'S', bid: 1.15, impr: '22k' },
];

interface OrderRow {
  id?: string;
  advertiserName: string;
  bidPer1k: number;
  initial: string;
  impressionsLeft: string;
  serving: boolean;
  isYou: boolean;
  rank: number;
  status: string;
}

export default function AdvertiserPage() {
  const { user, refreshUser } = useAuth();
  const [orderbook, setOrderbook] = useState<OrderRow[]>([]);
  const [liveBidders, setLiveBidders] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [bid, setBid] = useState(2.75);
  const [packs, setPacks] = useState(20);
  const [campaignName, setCampaignName] = useState('');
  const [landingUrl, setLandingUrl] = useState('https://');

  const preview = useMemo(() => {
    const you = {
      advertiserName: campaignName.trim() || 'Your campaign',
      bidPer1k: bid,
      initial: '★',
      impressionsLeft: `${packs}k`,
      serving: false,
      isYou: true,
      rank: 0,
      status: 'you',
    };
    const merged = [...orderbook.filter((row) => !row.isYou), you]
      .sort((a, b) => b.bidPer1k - a.bidPer1k)
      .map((row, index) => ({ ...row, rank: index + 1, serving: index < 2 }));
    const rank = merged.findIndex((row) => row.isYou) + 1;
    const total = bid * packs;
    return {
      rows: merged,
      rank,
      total,
      reach: packs * 1000,
      payout: total * 0.5,
      phrase: rank === 1 ? '#1 — top slot' : `#${rank} in queue`,
    };
  }, [orderbook, bid, packs, campaignName]);

  async function load() {
    try {
      const data = await api.marketplace();
      if (data.orderbook.length) {
        setOrderbook(data.orderbook.map((row) => ({
          id: row.id,
          advertiserName: row.advertiserName,
          bidPer1k: row.bidPer1k,
          initial: row.initial,
          impressionsLeft: row.impressionsLeft,
          serving: row.serving,
          isYou: row.isYou,
          rank: row.rank,
          status: row.status,
        })));
        setLiveBidders(data.liveBidders);
      } else {
        setOrderbook(DEMO_BOOK.map((row, index) => ({
          advertiserName: row.name,
          bidPer1k: row.bid,
          initial: row.initial,
          impressionsLeft: row.impr,
          serving: index < 2,
          isYou: false,
          rank: index + 1,
          status: index < 2 ? 'serving' : 'queued',
        })));
        setLiveBidders(DEMO_BOOK.length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load marketplace');
      setOrderbook(DEMO_BOOK.map((row, index) => ({
        advertiserName: row.name,
        bidPer1k: row.bid,
        initial: row.initial,
        impressionsLeft: row.impr,
        serving: index < 2,
        isYou: false,
        rank: index + 1,
        status: index < 2 ? 'serving' : 'queued',
      })));
      setLiveBidders(DEMO_BOOK.length);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function fundCampaign(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api.createCampaign({
        advertiserName: user?.company || user?.name || campaignName || 'Your campaign',
        advertiserUrl: landingUrl,
        title: campaignName || `${user?.company || 'Campaign'} bid`,
        bidPer1k: bid,
        viewPacks: packs,
      });
      setMessage(`Campaign funded · ${result.status} · rank #${result.rank}`);
      await refreshUser();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fund campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="marketplace-page">
      <div className="eyebrow center-text">the ad marketplace</div>
      <h1 className="page-title center-text">Bid for AI wait inventory</h1>
      <p className="muted center-text marketplace-lead">
        Same structure as whyl.ai — live order book, bid per 1K views, fund packs, re-bid anytime.
      </p>

      {user?.role !== 'advertiser' && (
        <p className="note center-text">
          You’re on an earner account. Funding a campaign opens advertiser access. You can also{' '}
          <Link to="/onboard?side=advertiser">switch onboarding to advertise</Link>.
        </p>
      )}

      {error && <p className="error center-text">{error}</p>}
      {message && <p className="notice center-text">{message}</p>}

      <div className="marketplace">
        <div className="orderbook">
          <div className="orderbook-head">
            <div className="orderbook-title">Live order book</div>
            <div className="mono accent live-indicator">
              <span className="dot" />
              <span>{Math.max(liveBidders, preview.rows.length)} advertisers bidding</span>
            </div>
          </div>
          <div className="orderbook-cols mono muted">
            <div>#</div>
            <div>advertiser</div>
            <div className="right">bid / 1K views</div>
            <div className="right">status</div>
          </div>
          {preview.rows.map((row) => (
            <div className={`ob-row ${row.isYou ? 'you' : ''}`} key={`${row.advertiserName}-${row.rank}`}>
              <div className="ob-rank">{row.rank}</div>
              <div className="ob-name-wrap">
                <div className="ob-chip">{row.initial}</div>
                <div>
                  <div className="ob-name">{row.advertiserName}</div>
                  <div className="ob-impr">{row.impressionsLeft} left</div>
                </div>
              </div>
              <div className="ob-bid">${row.bidPer1k.toFixed(2)}</div>
              <div className={`ob-status ${row.isYou ? 'you' : row.serving ? 'serving' : ''}`}>
                {row.isYou ? 'you' : row.serving ? '● serving' : 'queued'}
              </div>
            </div>
          ))}
        </div>

        <form className="bid-panel" onSubmit={fundCampaign}>
          <div className="bid-panel-title">Place your bid</div>

          <label className="mono muted label">campaign name</label>
          <input
            className="input"
            value={campaignName}
            onChange={(event) => setCampaignName(event.target.value)}
            placeholder={user?.company ? `${user.company} launch` : 'Fall product launch'}
            required
          />

          <label className="mono muted label">landing page</label>
          <input
            className="input"
            value={landingUrl}
            onChange={(event) => setLandingUrl(event.target.value)}
            placeholder="https://yourcompany.com"
            required
          />

          <div className="bid-row">
            <label className="mono muted">bid per 1K views</label>
            <span className="bid-value accent">${bid.toFixed(2)}</span>
          </div>
          <input
            className="range"
            type="range"
            min={0.5}
            max={6}
            step={0.05}
            value={bid}
            onChange={(event) => setBid(Number(event.target.value))}
          />

          <div className="bid-row">
            <label className="mono muted">1K-view packs</label>
            <span className="bid-value">{packs}</span>
          </div>
          <input
            className="range"
            type="range"
            min={1}
            max={120}
            step={1}
            value={packs}
            onChange={(event) => setPacks(Number(event.target.value))}
          />

          <div className="bid-summary">
            <div className="bid-summary-top">
              <span className="mono muted">you’d serve</span>
              <span className="bid-rank accent">{preview.phrase}</span>
            </div>
            <div className="bid-summary-divider" />
            <div className="bid-summary-row">
              <span>total budget</span>
              <span className="mono">${preview.total.toLocaleString()}</span>
            </div>
            <div className="bid-summary-row">
              <span>≈ views reached</span>
              <span className="mono">{preview.reach.toLocaleString()}</span>
            </div>
            <div className="bid-summary-row">
              <span>to fellow users (50%)</span>
              <span className="mono accent">${preview.payout.toLocaleString()}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Funding…' : 'Fund this campaign →'}
          </button>
        </form>
      </div>

      <div className="grid-3 marketplace-notes">
        <div className="card card-sm">
          <h3 className="sm">Pay per completed view</h3>
          <p>Skips and half-watches are free. Budget only burns on a full ad view.</p>
        </div>
        <div className="card card-sm">
          <h3 className="sm">Re-bid anytime</h3>
          <p>Losing the top slot? Raise your bid and jump the queue. No contracts.</p>
        </div>
        <div className="card card-sm">
          <h3 className="sm">50% goes back to users</h3>
          <p>Half of every completed view becomes credits for the person who watched.</p>
        </div>
      </div>
    </div>
  );
}
