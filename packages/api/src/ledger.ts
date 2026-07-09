import { v4 as uuid } from 'uuid';
import { db } from './db.js';

export function creditUser(params: {
  userId: string;
  credits: number;
  sourceType: 'ad_view' | 'referral';
  sourceId: string;
  description: string;
  referral?: boolean;
}) {
  if (params.credits <= 0) return;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO earnings_ledger (id, user_id, source_type, source_id, credits, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), params.userId, params.sourceType, params.sourceId, params.credits, params.description);

    db.prepare(`
      UPDATE user_balances SET
        balance = balance + ?,
        lifetime_earnings = lifetime_earnings + ?,
        referral_earnings = referral_earnings + ?,
        withdrawal_balance = withdrawal_balance + ?
      WHERE user_id = ?
    `).run(
      params.credits,
      params.credits,
      params.referral ? params.credits : 0,
      params.referral ? 0 : params.credits,
      params.userId,
    );
  });

  transaction();
}
