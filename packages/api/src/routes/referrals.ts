import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { db } from '../db.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(req.user!.id) as {
    referral_code: string;
  } | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(reward_credits), 0) as total
    FROM referrals WHERE referrer_id = ?
  `).get(req.user!.id) as { count: number; total: number };

  const referrals = db.prepare(`
    SELECT u.name, u.email, r.reward_credits, r.created_at
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user!.id);

  const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';

  res.json({
    referralCode: user.referral_code,
    inviteLink: `${baseUrl}/onboard?ref=${user.referral_code}`,
    totalReferrals: stats.count,
    totalRewards: stats.total,
    referrals: referrals.map((referral) => {
      const row = referral as Record<string, unknown>;
      return {
        name: row.name,
        email: row.email,
        rewardCredits: row.reward_credits,
        joinedAt: row.created_at,
      };
    }),
  });
});

export default router;
