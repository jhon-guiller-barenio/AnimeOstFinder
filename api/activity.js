const {getSql} = require('../lib/activity-db');
const {verifySessionToken, bearerToken} = require('../lib/clerk-auth');

const ALLOWED_EVENTS = new Set([
  'page_view','search','play','favorite_add','favorite_remove','download',
  'chat_open','support_open','sign_in','sign_up','sign_out'
]);
const rateBuckets = new Map();

function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const state = rateBuckets.get(ip);
  if (state && state.until > now) {
    if (state.count >= 60) return true;
    state.count += 1;
  } else rateBuckets.set(ip, {count: 1, until: now + 60_000});
  if (rateBuckets.size > 1500) for (const [key, value] of rateBuckets) if (value.until <= now) rateBuckets.delete(key);
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error: 'Method not allowed.'});
  }
  if (limited(req)) return res.status(429).json({error: 'Too many activity events.'});

  const eventType = req.body?.event_type;
  if (!ALLOWED_EVENTS.has(eventType)) return res.status(400).json({error: 'Invalid activity event.'});
  const visitorId = typeof req.body?.visitor_id === 'string' && /^[a-f0-9-]{36}$/i.test(req.body.visitor_id)
    ? req.body.visitor_id : null;
  const pagePath = typeof req.body?.page_path === 'string'
    ? req.body.page_path.split(/[?#]/, 1)[0].slice(0, 200) : '/';
  if (pagePath && !pagePath.startsWith('/')) return res.status(400).json({error: 'Invalid page path.'});

  let userId = null;
  const token = bearerToken(req);
  if (token) {
    const claims = await verifySessionToken(token);
    if (!claims) return res.status(401).json({error: 'Your session has expired. Sign in again.'});
    userId = claims.sub;
  }

  try {
    const sql = getSql();
    await sql`INSERT INTO public.activity_events
      (event_type, clerk_user_id, visitor_id, page_path, metadata)
      VALUES (${eventType}, ${userId}, ${visitorId}, ${pagePath || '/'}, '{}'::jsonb)`;
    return res.status(204).end();
  } catch (error) {
    console.error('Activity event could not be stored:', error?.name || 'database_error');
    return res.status(503).json({error: 'Activity tracking is temporarily unavailable.'});
  }
};
