/**
 * Vercel serverless feedback endpoint.
 * Secrets (webhook/email) loaded only from server env — never exposed to the client.
 *
 * Env:
 *   FEEDBACK_WEBHOOK_URL   Optional webhook (Slack/Discord/custom)
 *   FEEDBACK_MAX_BODY      Optional max body bytes (default 12000)
 *   FEEDBACK_ALLOWED_ORIGIN Optional CORS origin (default request origin / *)
 */
const RATE = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

function corsHeaders(req) {
  const origin = process.env.FEEDBACK_ALLOWED_ORIGIN || req.headers.origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const entry = RATE.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  RATE.set(ip, entry);
  return entry.count <= RATE_MAX;
}

function sanitize(str, max = 1500) {
  return String(str || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function validateBody(body) {
  const types = new Set(['general', 'bug', 'feature', 'clinical', 'accessibility', 'demo']);
  const rating = Number(body?.rating);
  if (!types.has(body?.type)) return { error: 'Invalid feedback type' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Invalid rating' };
  const payload = {
    type: body.type,
    rating,
    tryingToDo: sanitize(body.tryingToDo),
    workedWell: sanitize(body.workedWell),
    confusing: sanitize(body.confusing),
    improve: sanitize(body.improve),
    email: sanitize(body.email, 200),
    role: sanitize(body.role, 64),
    canContact: Boolean(body.canContact),
    interviewOptIn: Boolean(body.interviewOptIn),
    diagnostics: body.diagnostics && typeof body.diagnostics === 'object'
      ? {
          route: sanitize(body.diagnostics.route, 200),
          appVersion: sanitize(body.diagnostics.appVersion, 40),
          userAgent: sanitize(body.diagnostics.userAgent, 240),
          platform: sanitize(body.diagnostics.platform, 80),
          language: sanitize(body.diagnostics.language, 40),
          viewport: body.diagnostics.viewport || null,
          demoMode: Boolean(body.diagnostics.demoMode),
          lastAction: body.diagnostics.lastAction
            ? { name: sanitize(body.diagnostics.lastAction.name, 80), at: sanitize(body.diagnostics.lastAction.at, 40) }
            : null,
          errorId: sanitize(body.diagnostics.errorId, 40)
        }
      : null,
    createdAt: new Date().toISOString()
  };
  if (!payload.tryingToDo && !payload.workedWell && !payload.confusing && !payload.improve) {
    return { error: 'Empty feedback' };
  }
  return { payload };
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    res.statusCode = 429;
    return res.end(JSON.stringify({ error: 'Too many requests' }));
  }

  const maxBody = Number(process.env.FEEDBACK_MAX_BODY) || 12000;
  let raw = '';
  try {
    raw = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
  if (raw.length > maxBody) {
    res.statusCode = 413;
    return res.end(JSON.stringify({ error: 'Payload too large' }));
  }

  let body;
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw || '{}');
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }

  const { payload, error } = validateBody(body);
  if (error) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error }));
  }

  const referenceId = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // Operational log: type/rating/reference only — avoid free-text PHI in logs
  console.log(JSON.stringify({
    event: 'feedback_received',
    referenceId,
    type: payload.type,
    rating: payload.rating,
    hasEmail: Boolean(payload.email),
    demoMode: Boolean(payload.diagnostics?.demoMode)
  }));

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceId, ...payload })
      });
    } catch (err) {
      console.error(JSON.stringify({ event: 'feedback_webhook_failed', referenceId }));
      // Still acknowledge client — destination failure should not drop UX entirely
    }
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, referenceId }));
};
