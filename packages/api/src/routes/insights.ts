import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../auth.js';
import { db } from '../db.js';

const router = Router();
const MAX_TEXT = 20000;

function clip(value: unknown) {
  return String(value || '').slice(0, MAX_TEXT);
}

// Soft product framing: wait-timing insights (conversation context when user allows it).
router.post('/wait-context', authMiddleware, (req, res) => {
  const platform = String(req.body?.platform || '').trim().slice(0, 64);
  const promptText = clip(req.body?.promptText);
  const responseText = clip(req.body?.responseText);
  const promptTokens = Math.max(0, Number(req.body?.promptTokens) || 0);
  const waitMs = Math.max(0, Number(req.body?.waitMs) || 0);
  const clientSessionId = String(req.body?.clientSessionId || '').trim().slice(0, 128);

  if (!platform) {
    return res.status(400).json({ error: 'platform is required' });
  }
  if (!promptText && !responseText) {
    return res.status(400).json({ error: 'context is required' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO wait_context_events (
      id, user_id, platform, client_session_id, prompt_text, response_text, prompt_tokens, wait_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.id,
    platform,
    clientSessionId || null,
    promptText || null,
    responseText || null,
    promptTokens,
    waitMs,
  );

  res.status(201).json({ ok: true, id });
});

export default router;
