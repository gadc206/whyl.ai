import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { v4 as uuid } from 'uuid';
import { authMiddleware, signToken } from '../auth.js';
import { db, getOrCreateBalance } from '../db.js';
import { creditUser } from '../ledger.js';

const router = Router();
const createReferralCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

router.post('/register', (req, res) => {
  const { email, password, name, referralCode } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const userId = uuid();
  const code = createReferralCode();
  const passwordHash = bcrypt.hashSync(password, 10);

  let referredBy: string | null = null;
  if (referralCode) {
    const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode) as { id: string } | undefined;
    referredBy = referrer?.id ?? null;
  }

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, referral_code, referred_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, normalizedEmail, passwordHash, name, code, referredBy);

  getOrCreateBalance(userId);

  if (referredBy) {
    const referralId = uuid();
    db.prepare(`
      INSERT INTO referrals (id, referrer_id, referred_id, reward_credits)
      VALUES (?, ?, ?, 50)
    `).run(referralId, referredBy, userId);

    creditUser({
      userId: referredBy,
      credits: 50,
      sourceType: 'referral',
      sourceId: referralId,
      description: `Referral reward for ${normalizedEmail}`,
      referral: true,
    });
  }

  const token = signToken({ id: userId, email: normalizedEmail });
  res.status(201).json({
    token,
    user: {
      id: userId,
      email: normalizedEmail,
      name,
      referralCode: code,
      onboardingComplete: false,
      permissionsAccepted: false,
    },
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    referral_code: string;
    onboarding_complete: number;
    permissions_accepted: number;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ id: user.id, email: user.email });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      referralCode: user.referral_code,
      onboardingComplete: !!user.onboarding_complete,
      permissionsAccepted: !!user.permissions_accepted,
    },
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as {
    id: string;
    email: string;
    name: string;
    referral_code: string;
    onboarding_complete: number;
    permissions_accepted: number;
  } | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });
  const balance = getOrCreateBalance(user.id);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    referralCode: user.referral_code,
    onboardingComplete: !!user.onboarding_complete,
    permissionsAccepted: !!user.permissions_accepted,
    balance: balance.balance,
    lifetimeEarnings: balance.lifetime_earnings,
    referralEarnings: balance.referral_earnings,
    pendingEarnings: balance.pending_earnings,
    withdrawalBalance: balance.withdrawal_balance,
  });
});

router.post('/onboarding/complete', authMiddleware, (req, res) => {
  const { permissionsAccepted } = req.body;
  db.prepare(`
    UPDATE users SET onboarding_complete = 1, permissions_accepted = ?
    WHERE id = ?
  `).run(permissionsAccepted ? 1 : 0, req.user!.id);

  res.json({ success: true });
});

export default router;
