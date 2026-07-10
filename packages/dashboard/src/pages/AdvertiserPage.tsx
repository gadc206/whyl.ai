import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

interface Campaign {
  id: string;
  advertiserName: string;
  title: string;
  budget: number;
  viewsTarget: number;
  viewsDelivered: number;
  active: boolean;
  createdAt: string;
}

export default function AdvertiserPage() {
  const { user } = useAuth();
  const isAdvertiser = user?.role === 'advertiser';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    advertiserName: user?.company || user?.name || '',
    advertiserUrl: '',
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    budget: 1000,
    viewsTarget: 500,
    creditsPerView: 12,
    durationSeconds: 15,
  });

  async function load() {
    setCampaigns(await api.campaigns());
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaigns'));
  }, []);

  useEffect(() => {
    if (user?.company || user?.name) {
      setForm((current) => ({
        ...current,
        advertiserName: current.advertiserName || user.company || user.name || '',
      }));
    }
  }, [user?.company, user?.name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.createCampaign(form);
      setForm({ ...form, title: '', description: '', videoUrl: '', thumbnailUrl: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign');
    }
  }

  if (!isAdvertiser) {
    return (
      <>
        <h1>Advertise on WHYL</h1>
        <p className="muted">
          Same split as whyl.ai — create an advertiser account to fund campaigns that show during AI waits.
        </p>
        <Link className="primary-link" to="/onboard?side=advertiser">Switch to advertiser onboarding</Link>
      </>
    );
  }

  return (
    <>
      <h1>Fund a campaign</h1>
      <p className="muted">
        {user?.company ? `${user.company} · ` : ''}
        Upload creative details and WHYL delivers during AI waiting periods.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="panel-form" onSubmit={submit}>
        <input placeholder="Advertiser name" value={form.advertiserName} onChange={(event) => setForm({ ...form, advertiserName: event.target.value })} required />
        <input placeholder="Landing page URL" value={form.advertiserUrl} onChange={(event) => setForm({ ...form, advertiserUrl: event.target.value })} required />
        <input placeholder="Campaign title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input placeholder="Video URL" value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} />
        <input placeholder="Thumbnail URL" value={form.thumbnailUrl} onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} />
        <div className="form-row">
          <input type="number" placeholder="Budget" value={form.budget} onChange={(event) => setForm({ ...form, budget: Number(event.target.value) })} />
          <input type="number" placeholder="Views target" value={form.viewsTarget} onChange={(event) => setForm({ ...form, viewsTarget: Number(event.target.value) })} />
          <input type="number" placeholder="Credits per view" value={form.creditsPerView} onChange={(event) => setForm({ ...form, creditsPerView: Number(event.target.value) })} />
          <input type="number" placeholder="Duration seconds" value={form.durationSeconds} onChange={(event) => setForm({ ...form, durationSeconds: Number(event.target.value) })} />
        </div>
        <button className="primary">Create Campaign</button>
      </form>
      <h2>Active campaigns</h2>
      <div className="list">
        {campaigns.map((campaign) => (
          <div className="row" key={campaign.id}>
            <div>
              <strong>{campaign.title}</strong>
              <span>{campaign.advertiserName} - {campaign.viewsDelivered}/{campaign.viewsTarget} views</span>
            </div>
            <strong>{campaign.active ? 'Active' : 'Paused'}</strong>
          </div>
        ))}
        {!campaigns.length && <p className="muted">No campaigns yet. Create your first one above.</p>}
      </div>
    </>
  );
}
