import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
  if (count.count > 0) return;

  const campaigns = [
    {
      advertiserName: 'Ramp',
      advertiserUrl: 'https://ramp.com',
      title: 'Fall product launch',
      description: 'Reach developers during AI waits.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=640',
      contentType: 'video',
      budget: 420,
      viewsTarget: 100000,
      creditsPerView: 12,
      durationSeconds: 15,
      bidPer1k: 4.2,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Vercel',
      advertiserUrl: 'https://vercel.com',
      title: 'Develop. Preview. Ship.',
      description: 'Vercel is the frontend cloud for shipping web products.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640',
      contentType: 'video',
      budget: 385,
      viewsTarget: 100000,
      creditsPerView: 10,
      durationSeconds: 12,
      bidPer1k: 3.85,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Linear',
      advertiserUrl: 'https://linear.app',
      title: 'Built for modern product teams',
      description: 'Linear helps teams streamline issues, sprints, and product roadmaps.',
      videoUrl: null,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=640',
      contentType: 'brand',
      budget: 210,
      viewsTarget: 100000,
      creditsPerView: 8,
      durationSeconds: 10,
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
