import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
  if (count.count > 0) return;

  const campaigns = [
    {
      advertiserName: 'Factory',
      advertiserUrl: 'https://factory.ai',
      title: 'Factory 2.0',
      description: 'From coding agents to software factories. Via Launch Gallery.',
      videoUrl: 'https://video.twimg.com/amplify_video/2066587985991413760/vid/avc1/1280x720/VmTP9cSkwe6DWJUd.mp4?tag=14',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066587985991413760/img/RP0TnMdwXdgbWgHK.jpg',
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
      videoUrl: 'https://video.twimg.com/amplify_video/2066581137703481344/vid/avc1/1280x720/cx_oabsQzIx4PSWI.mp4?tag=28',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066581137703481344/img/CQafKQxRCH6LIXB2.jpg',
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
      videoUrl: 'https://video.twimg.com/amplify_video/2066537570910003200/vid/avc1/1280x720/mVpAMbmVYV70U3wM.mp4?tag=28',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066537570910003200/img/wTU48rtG4ijBspXb.jpg',
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
      videoUrl: 'https://video.twimg.com/amplify_video/2064363313048477696/vid/avc1/1280x720/raWVzgDsqohLBuGs.mp4?tag=27',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2064363313048477696/img/gTTUduvQKGwwB5ZX.jpg',
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
