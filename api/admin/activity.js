const {getSql} = require('../../lib/activity-db');
const {verifySessionToken, isAdminUser, bearerToken} = require('../../lib/clerk-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed.'});
  }
  const token = bearerToken(req);
  if (!token) return res.status(401).json({error: 'Sign in with an administrator account.'});
  const claims = await verifySessionToken(token);
  if (!claims) return res.status(401).json({error: 'Your session has expired. Sign in again.'});
  try {
    if (!await isAdminUser(claims.sub)) return res.status(403).json({error: 'This Clerk account is not an administrator.'});
    const sql = getSql();
    const [totals, daily, recent, popular] = await Promise.all([
      sql`SELECT count(*)::int AS events_30d,
        count(DISTINCT clerk_user_id)::int AS users_30d,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS events_24h,
        count(DISTINCT clerk_user_id) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS users_24h
        FROM public.activity_events WHERE created_at >= now() - interval '30 days'`,
      sql`SELECT date_trunc('day', created_at)::date::text AS day,
        count(*)::int AS events,
        count(DISTINCT clerk_user_id)::int AS users
        FROM public.activity_events WHERE created_at >= now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
      sql`SELECT id, event_type, clerk_user_id, page_path, created_at
        FROM public.activity_events ORDER BY created_at DESC LIMIT 100`,
      sql`SELECT page_path, count(*)::int AS views
        FROM public.activity_events WHERE event_type = 'page_view'
          AND created_at >= now() - interval '30 days'
        GROUP BY page_path ORDER BY views DESC LIMIT 8`
    ]);
    return res.status(200).json({totals: totals[0], daily, recent, popular});
  } catch (error) {
    console.error('Admin activity query failed:', error?.name || 'request_error');
    return res.status(503).json({error: 'The activity dashboard is temporarily unavailable.'});
  }
};
