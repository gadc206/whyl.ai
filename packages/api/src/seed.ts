import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
  if (count.count > 0) return;

  const campaigns = [
    {
      advertiserName: 'Notion',
      advertiserUrl: 'https://notion.so',
      title: 'Your workspace, unified',
      description: 'Notion is the connected workspace where better, faster work happens.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=640',
      contentType: 'video',
      budget: 10000,
      viewsTarget: 5000,
      creditsPerView: 12,
      durationSeconds: 15,
    },
    {
      advertiserName: 'Linear',
      advertiserUrl: 'https://linear.app',
      title: 'Built for modern product teams',
      description: 'Linear helps teams streamline issues, sprints, and product roadmaps.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640',
      contentType: 'video',
      budget: 8000,
      viewsTarget: 4000,
      creditsPerView: 10,
      durationSeconds: 12,
    },
    {
      advertiserName: 'Vercel',
      advertiserUrl: 'https://vercel.com',
      title: 'Develop. Preview. Ship.',
      description: 'Vercel is the frontend cloud for shipping web products.',
      videoUrl: null,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=640',
      contentType: 'brand',
      budget: 5000,
      viewsTarget: 2500,
      creditsPerView: 8,
      durationSeconds: 10,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO campaigns (
      id, advertiser_name, advertiser_url, title, description, video_url,
      thumbnail_url, content_type, budget, views_target, credits_per_view, duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    );
  }
}
