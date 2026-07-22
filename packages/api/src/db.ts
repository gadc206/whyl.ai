import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Render, set DATABASE_PATH to a persistent disk mount (e.g. /var/data/whyl.db).
// Without that, SQLite lives on the ephemeral filesystem and resets on redeploy.
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'whyl.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export interface BalanceRow {
  user_id: string;
  balance: number;
  lifetime_earnings: number;
  referral_earnings: number;
  pending_earnings: number;
  withdrawal_balance: number;
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT REFERENCES users(id),
      role TEXT DEFAULT 'watcher',
      company TEXT,
      onboarding_complete INTEGER DEFAULT 0,
      permissions_accepted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_balances (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      balance INTEGER DEFAULT 0,
      lifetime_earnings INTEGER DEFAULT 0,
      referral_earnings INTEGER DEFAULT 0,
      pending_earnings INTEGER DEFAULT 0,
      withdrawal_balance INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      advertiser_name TEXT NOT NULL,
      advertiser_url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      video_url TEXT,
      thumbnail_url TEXT,
      content_type TEXT DEFAULT 'video',
      budget INTEGER NOT NULL,
      views_target INTEGER NOT NULL,
      views_delivered INTEGER DEFAULT 0,
      target_audience TEXT DEFAULT 'all',
      credits_per_view INTEGER DEFAULT 12,
      duration_seconds INTEGER DEFAULT 15,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL,
      client_session_id TEXT NOT NULL,
      activation_delay_ms INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      UNIQUE(user_id, client_session_id)
    );

    CREATE TABLE IF NOT EXISTS ad_views (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ad_sessions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      platform TEXT NOT NULL,
      visible_started_at TEXT DEFAULT (datetime('now')),
      visible_ended_at TEXT,
      visible_duration_ms INTEGER DEFAULT 0,
      credits_earned INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      continued INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS earnings_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      credits INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL REFERENCES users(id),
      referred_id TEXT NOT NULL REFERENCES users(id),
      reward_credits INTEGER DEFAULT 50,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wait_context_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL,
      client_session_id TEXT,
      prompt_text TEXT,
      response_text TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      wait_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Existing local/prod DBs created before role split.
  ensureColumn('users', 'role', "TEXT DEFAULT 'watcher'");
  ensureColumn('users', 'company', 'TEXT');
  ensureColumn('campaigns', 'owner_user_id', 'TEXT');
  ensureColumn('campaigns', 'bid_per_1k', 'REAL DEFAULT 2.75');
  ensureColumn('campaigns', 'view_packs', 'INTEGER DEFAULT 20');
  ensureColumn('campaigns', 'status', "TEXT DEFAULT 'queued'");
}

export function getOrCreateBalance(userId: string): BalanceRow {
  let balance = db.prepare('SELECT * FROM user_balances WHERE user_id = ?').get(userId) as BalanceRow | undefined;
  if (!balance) {
    db.prepare('INSERT INTO user_balances (user_id) VALUES (?)').run(userId);
    balance = db.prepare('SELECT * FROM user_balances WHERE user_id = ?').get(userId) as BalanceRow;
  }
  return balance;
}
