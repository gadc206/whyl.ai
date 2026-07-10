import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
  if (count.count > 0) return;

  // Seed metadata only — extension always plays bundled local Launch Gallery MP4s.
  const campaigns = [
    {
      advertiserName: 'Factory',
      advertiserUrl: 'https://factory.ai',
      title: 'Factory 2.0',
      description: 'From coding agents to software factories. Via Launch Gallery.',
      videoUrl: null,
      thumbnailUrl: null,
      contentType: 'video',
      budget: 420,
      viewsTarget: 100000,
      creditsPerView: 14,
      durationSeconds: 30,
      bidPer1k: 4.2,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Lightwork',
      advertiserUrl: 'https://lightwork.ai',
      title: 'Introducing Lightwork',
      description: 'Launch Gallery startup launch cut.',
      videoUrl: null,
      thumbnailUrl: null,
      contentType: 'video',
      budget: 385,
      viewsTarget: 100000,
      creditsPerView: 12,
      durationSeconds: 30,
      bidPer1k: 3.85,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Boardy',
      advertiserUrl: 'https://boardy.ai',
      title: 'Boardy Pro',
      description: 'AI that makes deals happen.',
      videoUrl: null,
      thumbnailUrl: null,
      contentType: 'video',
      budget: 275,
      viewsTarget: 100000,
      creditsPerView: 12,
      durationSeconds: 30,
      bidPer1k: 2.75,
      viewPacks: 100,
      status: 'queued',
    },
    {
      advertiserName: 'CrowdReply',
      advertiserUrl: 'https://crowdreply.io',
      title: 'Searchmaxxing',
      description: 'Visibility in AI answers.',
      videoUrl: null,
      thumbnailUrl: null,
      contentType: 'video',
      budget: 210,
      viewsTarget: 100000,
      creditsPerView: 10,
      durationSeconds: 30,
      bidPer1k: 2.1,
      viewPacks: 100,
      status: 'queued',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO campaigns (
      id, advertiser_name, advertiser_url, title, description, video_url,
      thumbnail_url, content_type, budget, views_target, credits_per_view,
      duration_seconds, bid_per_1k, view_packs, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const campaign of campaigns) {
    insert.run(
      uuid(),
      campaign.advertiserName,
      campaign.advertiserUrl,
      campaign.title,
      campaign.description,
      campaign.videoUrl,
      campaign.thumbnailUrl,
      campaign.contentType,
      campaign.budget,
      campaign.viewsTarget,
      campaign.creditsPerView,
      campaign.durationSeconds,
      campaign.bidPer1k,
      campaign.viewPacks,
      campaign.status,
    );
  }
}
