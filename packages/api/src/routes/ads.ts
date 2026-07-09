import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../auth.js';
import { db, getOrCreateBalance } from '../db.js';
import { creditUser } from '../ledger.js';

const router = Router();
const MIN_VISIBLE_MS = 1000;

interface CampaignRow {
  id: string;
  advertiser_name: string;
  advertiser_url: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  content_type: string;
  credits_per_view: number;
  duration_seconds: number;
}

router.get('/next', authMiddleware, (_req, res) => {
  const campaign = db.prepare(`
    SELECT * FROM campaigns
    WHERE active = 1 AND views_delivered < views_target
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as CampaignRow | undefined;

  if (!campaign) return res.status(404).json({ error: 'No ads available' });

  res.json({
    id: campaign.id,
    advertiserName: campaign.advertiser_name,
    advertiserUrl: campaign.advertiser_url,
    title: campaign.title,
    description: campaign.description,
    videoUrl: campaign.video_url,
    thumbnailUrl: campaign.thumbnail_url,
    contentType: campaign.content_type,
    creditsPerView: campaign.credits_per_view,
    durationSeconds: campaign.duration_seconds,
  });
});

router.post('/session/start', authMiddleware, (req, res) => {
  const { platform, clientSessionId, activationDelayMs } = req.body;
  if (!platform || !clientSessionId) {
    return res.status(400).json({ error: 'platform and clientSessionId are required' });
  }

  const existing = db.prepare(`
    SELECT id FROM ad_sessions WHERE user_id = ? AND client_session_id = ?
  `).get(req.user!.id, clientSessionId) as { id: string } | undefined;

  if (existing) return res.json({ sessionId: existing.id });

  const sessionId = uuid();
  db.prepare(`
    INSERT INTO ad_sessions (id, user_id, platform, client_session_id, activation_delay_ms)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, req.user!.id, platform, clientSessionId, Number(activationDelayMs) || 5000);

  res.status(201).json({ sessionId });
});

router.post('/view/start', authMiddleware, (req, res) => {
  const { sessionId, campaignId, platform } = req.body;
  if (!sessionId || !campaignId || !platform) {
    return res.status(400).json({ error: 'sessionId, campaignId, and platform are required' });
  }

  const session = db.prepare(`
    SELECT id FROM ad_sessions WHERE id = ? AND user_id = ? AND ended_at IS NULL
  `).get(sessionId, req.user!.id);
  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const viewId = uuid();
  db.prepare(`
    INSERT INTO ad_views (id, session_id, user_id, campaign_id, platform)
    VALUES (?, ?, ?, ?, ?)
  `).run(viewId, sessionId, req.user!.id, campaignId, platform);

  res.status(201).json({ viewId });
});

router.post('/view/complete', authMiddleware, (req, res) => {
  const { viewId, continued, visibleDurationMs } = req.body;
  if (!viewId) return res.status(400).json({ error: 'viewId is required' });

  const view = db.prepare(`
    SELECT av.*, c.credits_per_view, c.duration_seconds, c.title
    FROM ad_views av
    JOIN campaigns c ON c.id = av.campaign_id
    WHERE av.id = ? AND av.user_id = ? AND av.completed = 0
  `).get(viewId, req.user!.id) as {
    id: string;
    session_id: string;
    campaign_id: string;
    credits_per_view: number;
    duration_seconds: number;
    title: string;
  } | undefined;

  if (!view) return res.status(404).json({ error: 'View not found or already completed' });

  const durationMs = Math.max(0, Number(visibleDurationMs) || 0);
  const earnableRatio = Math.min(durationMs / Math.max(view.duration_seconds * 1000, 1), 1);
  const credits = durationMs >= MIN_VISIBLE_MS ? Math.floor(view.credits_per_view * earnableRatio) : 0;

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE ad_views SET
        visible_ended_at = datetime('now'),
        visible_duration_ms = ?,
        credits_earned = ?,
        completed = 1,
        continued = ?
      WHERE id = ?
    `).run(durationMs, credits, continued ? 1 : 0, viewId);

    db.prepare('UPDATE campaigns SET views_delivered = views_delivered + 1 WHERE id = ?').run(view.campaign_id);
  });

  transaction();

  if (credits > 0) {
    creditUser({
      userId: req.user!.id,
      credits,
      sourceType: 'ad_view',
      sourceId: viewId,
      description: `Visible ad view: ${view.title}`,
    });
  }

  const balance = getOrCreateBalance(req.user!.id);
  res.json({
    creditsEarned: credits,
    totalBalance: balance.balance,
  });
});

router.post('/session/end', authMiddleware, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  db.prepare(`
    UPDATE ad_sessions SET ended_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(sessionId, req.user!.id);

  res.json({ success: true });
});

export default router;
