import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { v4 as uuid } from 'uuid';
import { authMiddleware, signToken } from '../auth.js';
import { db, getOrCreateBalance } from '../db.js';
import { creditUser } from '../ledger.js';

const router = Router();
const createReferralCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  referral_code: string;
  role?: string;
  company?: string | null;
  onboarding_complete: number;
  permissions_accepted: number;
  improve_wait_timing?: number | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    referralCode: user.referral_code,
    role: user.role === 'advertiser' ? 'advertiser' : 'watcher',
    company: user.company || null,
    onboardingComplete: !!user.onboarding_complete,
    permissionsAccepted: !!user.permissions_accepted,
    // Default ON when column missing/null.
    improveWaitTiming: user.improve_wait_timing !== 0,
  };
}

router.post('/register', (req, res) => {
  const { email, password, name, referralCode, role, company } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const accountRole = role === 'advertiser' ? 'advertiser' : 'watcher';
  const companyName = accountRole === 'advertiser' ? String(company || '').trim() : '';
  if (accountRole === 'advertiser' && !companyName) {
    return res.status(400).json({ error: 'Company / startup name is required for advertisers' });
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
    INSERT INTO users (id, email, password_hash, name, referral_code, referred_by, role, company)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    normalizedEmail,
    passwordHash,
    name,
    code,
    referredBy,
    accountRole,
    companyName || null,
  );

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
      role: accountRole,
      company: companyName || null,
      onboardingComplete: false,
      permissionsAccepted: false,
      improveWaitTiming: true,
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
    role?: string;
    company?: string | null;
    onboarding_complete: number;
    permissions_accepted: number;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ id: user.id, email: user.email });
  res.json({
    token,
    user: serializeUser(user),
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as {
    id: string;
    email: string;
    name: string;
    referral_code: string;
    role?: string;
    company?: string | null;
    onboarding_complete: number;
    permissions_accepted: number;
  } | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });
  const balance = getOrCreateBalance(user.id);

  res.json({
    ...serializeUser(user),
    balance: balance.balance,
    lifetimeEarnings: balance.lifetime_earnings,
    referralEarnings: balance.referral_earnings,
    pendingEarnings: balance.pending_earnings,
    withdrawalBalance: balance.withdrawal_balance,
  });
});

router.post('/onboarding/complete', authMiddleware, (req, res) => {
  const { permissionsAccepted, role, company } = req.body;
  const existing = db.prepare('SELECT role, company FROM users WHERE id = ?').get(req.user!.id) as {
    role?: string;
    company?: string | null;
  } | undefined;

  const nextRole = role === 'advertiser' || existing?.role === 'advertiser' ? 'advertiser' : 'watcher';
  const nextCompany = nextRole === 'advertiser'
    ? String(company || existing?.company || '').trim()
    : null;

  if (nextRole === 'advertiser' && !nextCompany) {
    return res.status(400).json({ error: 'Company / startup name is required for advertisers' });
  }

  db.prepare(`
    UPDATE users SET
      onboarding_complete = 1,
      permissions_accepted = ?,
      role = ?,
      company = ?
    WHERE id = ?
  `).run(permissionsAccepted ? 1 : 0, nextRole, nextCompany, req.user!.id);

  res.json({ success: true, role: nextRole, company: nextCompany });
});

router.patch('/preferences', authMiddleware, (req, res) => {
  if (typeof req.body?.improveWaitTiming !== 'boolean') {
    return res.status(400).json({ error: 'improveWaitTiming boolean is required' });
  }

  const enabled = req.body.improveWaitTiming !== false;
  db.prepare('UPDATE users SET improve_wait_timing = ? WHERE id = ?').run(enabled ? 1 : 0, req.user!.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as {
    id: string;
    email: string;
    name: string;
    referral_code: string;
    role?: string;
    company?: string | null;
    onboarding_complete: number;
    permissions_accepted: number;
    improve_wait_timing?: number | null;
  } | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: serializeUser(user) });
});

export default router;
