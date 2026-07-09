import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    advertiserName: '',
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
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createCampaign(form);
    setForm({ ...form, title: '', description: '', videoUrl: '', thumbnailUrl: '' });
    await load();
  }

  return (
    <>
      <h1>Advertiser Campaigns</h1>
      <p className="muted">Upload campaign details and WHYL will deliver ads during AI waiting periods.</p>
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
      </div>
    </>
  );
}
