import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
  if (count.count > 0) return;

  const campaigns = [
    {
      advertiserName: 'Nova',
      advertiserUrl: 'https://whyl.ai',
      title: 'Ship the launch cut',
      description: 'Cinematic product launch energy while you wait.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=640',
      contentType: 'video',
      budget: 420,
      viewsTarget: 100000,
      creditsPerView: 14,
      durationSeconds: 15,
      bidPer1k: 4.2,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Orbit',
      advertiserUrl: 'https://whyl.ai',
      title: 'Motion that converts',
      description: 'High-energy launch motion for AI wait inventory.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=640',
      contentType: 'video',
      budget: 385,
      viewsTarget: 100000,
      creditsPerView: 12,
      durationSeconds: 15,
      bidPer1k: 3.85,
      viewPacks: 100,
      status: 'serving',
    },
    {
      advertiserName: 'Pulse',
      advertiserUrl: 'https://whyl.ai',
      title: 'Make the wait worth it',
      description: 'Premium launch creative for deep-work waits.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=640',
      contentType: 'video',
      budget: 275,
      viewsTarget: 100000,
      creditsPerView: 12,
      durationSeconds: 15,
      bidPer1k: 2.75,
      viewPacks: 100,
      status: 'queued',
    },
    {
      advertiserName: 'Spark',
      advertiserUrl: 'https://whyl.ai',
      title: 'Drop day energy',
      description: 'Bold launch visuals timed to AI thinking windows.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640',
      contentType: 'video',
      budget: 210,
      viewsTarget: 100000,
      creditsPerView: 10,
      durationSeconds: 12,
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
