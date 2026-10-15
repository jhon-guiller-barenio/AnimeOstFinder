const {Readable} = require('node:stream');

const UPSTREAM_ORIGIN = 'https://frontend-api.clerk.dev';
const DEFAULT_PROXY_URL = 'https://sakurasound.vercel.app/__clerk';
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'host',
]);

function sendError(res, status, message) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json({error: message});
}

module.exports = async function clerkProxy(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader('Allow', [...ALLOWED_METHODS].join(', '));
    return sendError(res, 405, 'Method not allowed.');
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return sendError(res, 503, 'Clerk proxy is not configured.');

  const proxyUrl = process.env.CLERK_PROXY_URL || DEFAULT_PROXY_URL;
  let proxy;
  try {
    proxy = new URL(proxyUrl);
  } catch {
    return sendError(res, 500, 'Clerk proxy URL is invalid.');
  }

  // Keep the secret-bearing proxy limited to the production site hostname.
  if ((req.headers.host || '').toLowerCase() !== proxy.host.toLowerCase()) {
    return sendError(res, 404, 'Not found.');
  }

  const pathParts = req.query.path == null
    ? []
    : (Array.isArray(req.query.path) ? req.query.path : [req.query.path]).map(String);
  if (pathParts.some(part => !part || part === '.' || part === '..' || /[\\/\0]/.test(part))) {
    return sendError(res, 400, 'Invalid Clerk API path.');
  }

  const incomingUrl = new URL(req.url, 'https://' + proxy.host);
  const upstreamUrl = new URL('/' + pathParts.map(encodeURIComponent).join('/'), UPSTREAM_ORIGIN);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName) || lowerName === 'clerk-secret-key' || lowerName === 'clerk-proxy-url') continue;
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (value != null) headers.set(name, value);
  }

  const forwardedFor = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  if (!forwardedFor) return sendError(res, 400, 'Client IP address is unavailable.');

  headers.set('Clerk-Proxy-Url', proxyUrl.replace(/\/$/, ''));
  headers.set('Clerk-Secret-Key', secretKey);
  headers.set('X-Forwarded-For', forwardedFor);

  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: hasBody ? req : undefined,
      ...(hasBody ? {duplex: 'half'} : {}),
      redirect: 'manual',
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      const lowerName = name.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lowerName) || lowerName === 'set-cookie' || lowerName === 'location') return;
      res.setHeader(name, value);
    });

    const cookies = upstream.headers.getSetCookie?.();
    if (cookies?.length) res.setHeader('Set-Cookie', cookies);
    else {
      const cookie = upstream.headers.get('set-cookie');
      if (cookie) res.setHeader('Set-Cookie', cookie);
    }

    const location = upstream.headers.get('location');
    if (location) {
      const rewritten = location.replace(/^https:\/\/frontend-api\.clerk\.dev(?=\/|$)/i, proxyUrl.replace(/\/$/, ''));
      res.setHeader('Location', rewritten);
    }

    const hasCookies = Boolean(upstream.headers.getSetCookie?.().length || upstream.headers.get('set-cookie'));
    if (req.method === 'GET' && pathParts[0] === 'npm' && upstream.ok && !hasCookies) {
      // Clerk JS assets use versioned URLs. Cache them at Vercel's edge so sign-in
      // does not wait for a new serverless proxy round trip on every visit.
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }

    if (!upstream.body || req.method === 'HEAD') return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('Clerk proxy request failed:', error?.message || 'unknown error');
    if (!res.headersSent) return sendError(res, 502, 'Clerk could not be reached.');
    res.destroy(error);
  }
};

module.exports.config = {api: {bodyParser: false}};
