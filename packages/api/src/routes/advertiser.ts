import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../auth.js';
import { db } from '../db.js';

const router = Router();

function getUserRole(userId: string) {
  return db.prepare('SELECT role, company, name FROM users WHERE id = ?').get(userId) as {
    role?: string;
    company?: string | null;
    name: string;
  } | undefined;
}

function mapCampaign(row: Record<string, unknown>) {
  return {
    id: row.id,
    advertiserName: row.advertiser_name,
    title: row.title,
    budget: row.budget,
    viewsTarget: row.views_target,
    viewsDelivered: row.views_delivered,
    bidPer1k: Number(row.bid_per_1k ?? 0),
    viewPacks: Number(row.view_packs ?? 0),
    status: row.status || (row.active ? 'serving' : 'paused'),
    active: !!row.active,
    ownerUserId: row.owner_user_id || null,
    createdAt: row.created_at,
  };
}

router.get('/marketplace', authMiddleware, (req, res) => {
  const campaigns = db.prepare(`
    SELECT id, advertiser_name, title, budget, views_target, views_delivered,
           bid_per_1k, view_packs, status, active, owner_user_id, created_at
    FROM campaigns
    WHERE active = 1
    ORDER BY COALESCE(bid_per_1k, 0) DESC, created_at ASC
  `).all() as Array<Record<string, unknown>>;

  const orderbook = campaigns.map((row, index) => {
    const mapped = mapCampaign(row);
    const rank = index + 1;
    return {
      ...mapped,
      rank,
      initial: String(mapped.advertiserName || '?').slice(0, 1).toUpperCase(),
      impressionsLeft: `${Math.max(0, Number(mapped.viewsTarget) - Number(mapped.viewsDelivered))}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      serving: rank <= 2,
      isYou: mapped.ownerUserId === req.user!.id,
    };
  });

  res.json({
    liveBidders: orderbook.length,
    orderbook,
  });
});

router.get('/campaigns', authMiddleware, (req, res) => {
  // Only this account's campaigns (live + previous) for the Campaigns panel.
  const campaigns = db.prepare(`
    SELECT id, advertiser_name, title, budget, views_target, views_delivered,
           bid_per_1k, view_packs, status, active, owner_user_id, created_at
    FROM campaigns
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
  `).all(req.user!.id);

  res.json((campaigns as Array<Record<string, unknown>>).map(mapCampaign));
});

router.post('/campaigns', authMiddleware, (req, res) => {
  const user = getUserRole(req.user!.id);
  // Earners can still enter the marketplace later from profile.
  const {
    advertiserName,
    advertiserUrl,
    title,
    description,
    videoUrl,
    thumbnailUrl,
    contentType,
    bidPer1k,
    viewPacks,
    targetAudience,
    creditsPerView,
    durationSeconds,
  } = req.body;

  const packs = Math.max(1, Number(viewPacks) || 20);
  const bid = Math.max(0.5, Number(bidPer1k) || 2.75);
  const viewsTarget = packs * 1000;
  const budget = Math.round(bid * packs);
  const resolvedName = String(advertiserName || user?.company || user?.name || 'Your campaign').trim();
  const landing = String(advertiserUrl || 'https://whyl.ai').trim();
  const campaignTitle = String(title || `${resolvedName} campaign`).trim();

  if (!resolvedName || !landing || !campaignTitle) {
    return res.status(400).json({ error: 'Missing required campaign fields' });
  }

  // Promote this user to advertiser when they fund a campaign from an earner account.
  if (user?.role !== 'advertiser') {
    db.prepare(`UPDATE users SET role = 'advertiser', company = COALESCE(company, ?) WHERE id = ?`)
      .run(resolvedName, req.user!.id);
  }

  const higherBids = db.prepare(`
    SELECT COUNT(*) as count FROM campaigns
    WHERE active = 1 AND COALESCE(bid_per_1k, 0) > ?
  `).get(bid) as { count: number };
  const status = higherBids.count < 2 ? 'serving' : 'queued';

  const id = uuid();
  db.prepare(`
    INSERT INTO campaigns (
      id, advertiser_name, advertiser_url, title, description, video_url,
      thumbnail_url, content_type, budget, views_target, target_audience,
      credits_per_view, duration_seconds, owner_user_id, bid_per_1k, view_packs, status, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    resolvedName,
    landing,
    campaignTitle,
    description || null,
    videoUrl || null,
    thumbnailUrl || null,
    contentType || 'video',
    budget,
    viewsTarget,
    targetAudience || 'all',
    Number(creditsPerView) || 12,
    Number(durationSeconds) || 15,
    req.user!.id,
    bid,
    packs,
    status,
  );

  res.status(201).json({
    id,
    bidPer1k: bid,
    viewPacks: packs,
    budget,
    viewsTarget,
    status,
    rank: higherBids.count + 1,
  });
});

export default router;
