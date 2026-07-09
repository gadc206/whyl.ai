import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../auth.js';
import { db, getOrCreateBalance } from '../db.js';

const router = Router();

router.get('/summary', authMiddleware, (req, res) => {
  const balance = getOrCreateBalance(req.user!.id);
  const adsWatched = db.prepare(`
    SELECT COUNT(*) as count FROM ad_views WHERE user_id = ? AND completed = 1
  `).get(req.user!.id) as { count: number };

  res.json({
    balance: balance.balance,
    lifetimeEarnings: balance.lifetime_earnings,
    referralEarnings: balance.referral_earnings,
    pendingEarnings: balance.pending_earnings,
    withdrawalBalance: balance.withdrawal_balance,
    adsWatched: adsWatched.count,
  });
});

router.get('/history', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.credits, l.source_type, l.description, l.created_at,
           av.platform, c.advertiser_name, c.title
    FROM earnings_ledger l
    LEFT JOIN ad_views av ON av.id = l.source_id AND l.source_type = 'ad_view'
    LEFT JOIN campaigns c ON c.id = av.campaign_id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
    LIMIT 75
  `).all(req.user!.id);

  res.json(rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      credits: r.credits,
      sourceType: r.source_type,
      description: r.description,
      platform: r.platform,
      advertiserName: r.advertiser_name,
      title: r.title,
      createdAt: r.created_at,
    };
  }));
});

router.get('/withdrawals', authMiddleware, (req, res) => {
  const withdrawals = db.prepare(`
    SELECT id, amount, status, created_at FROM withdrawals
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.user!.id);

  res.json(withdrawals.map((withdrawal) => {
    const row = withdrawal as Record<string, unknown>;
    return {
      id: row.id,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
    };
  }));
});

router.post('/withdraw', authMiddleware, (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount < 100) return res.status(400).json({ error: 'Minimum withdrawal is 100 credits' });

  const balance = getOrCreateBalance(req.user!.id);
  if (balance.withdrawal_balance < amount) {
    return res.status(400).json({ error: 'Insufficient withdrawal balance' });
  }

  const withdrawalId = uuid();
  db.prepare(`
    INSERT INTO withdrawals (id, user_id, amount, status)
    VALUES (?, ?, ?, 'pending')
  `).run(withdrawalId, req.user!.id, amount);

  db.prepare(`
    UPDATE user_balances SET
      withdrawal_balance = withdrawal_balance - ?,
      pending_earnings = pending_earnings + ?
    WHERE user_id = ?
  `).run(amount, amount, req.user!.id);

  res.status(201).json({ id: withdrawalId, amount, status: 'pending' });
});

export default router;
