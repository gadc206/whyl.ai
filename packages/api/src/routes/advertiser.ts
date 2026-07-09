import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../auth.js';
import { db } from '../db.js';

const router = Router();

router.get('/campaigns', authMiddleware, (_req, res) => {
  const campaigns = db.prepare(`
    SELECT id, advertiser_name, title, budget, views_target, views_delivered, active, created_at
    FROM campaigns
    ORDER BY created_at DESC
  `).all();

  res.json(campaigns.map((campaign) => {
    const row = campaign as Record<string, unknown>;
    return {
      id: row.id,
      advertiserName: row.advertiser_name,
      title: row.title,
      budget: row.budget,
      viewsTarget: row.views_target,
      viewsDelivered: row.views_delivered,
      active: !!row.active,
      createdAt: row.created_at,
    };
  }));
});

router.post('/campaigns', authMiddleware, (req, res) => {
  const {
    advertiserName,
    advertiserUrl,
    title,
    description,
    videoUrl,
    thumbnailUrl,
    contentType,
    budget,
    viewsTarget,
    targetAudience,
    creditsPerView,
    durationSeconds,
  } = req.body;

  if (!advertiserName || !advertiserUrl || !title || !budget || !viewsTarget) {
    return res.status(400).json({ error: 'Missing required campaign fields' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO campaigns (
      id, advertiser_name, advertiser_url, title, description, video_url,
      thumbnail_url, content_type, budget, views_target, target_audience,
      credits_per_view, duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    advertiserName,
    advertiserUrl,
    title,
    description || null,
    videoUrl || null,
    thumbnailUrl || null,
    contentType || 'video',
    Number(budget),
    Number(viewsTarget),
    targetAudience || 'all',
    Number(creditsPerView) || 12,
    Number(durationSeconds) || 15,
  );

  res.status(201).json({ id });
});

export default router;
