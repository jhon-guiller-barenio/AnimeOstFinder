const crypto = require('node:crypto');

let jwksCache;
let jwksExpiresAt = 0;

function base64urlDecode(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function getJwks() {
  if (jwksCache && jwksExpiresAt > Date.now()) return jwksCache;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('Clerk secret key is not configured.');
  const response = await fetch('https://api.clerk.com/v1/jwks', {
    headers: {Authorization: 'Bearer ' + secretKey, Accept: 'application/json'},
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Could not load Clerk signing keys.');
  const body = await response.json();
  if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('Clerk signing keys are unavailable.');
  jwksCache = body;
  jwksExpiresAt = Date.now() + 5 * 60 * 1000;
  return jwksCache;
}

async function verifySessionToken(token) {
  if (typeof token !== 'string' || token.length > 12000) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const jwks = await getJwks();
    const jwk = jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'));
    if (!jwk) {
      jwksExpiresAt = 0;
      const refreshed = await getJwks();
      const refreshedKey = refreshed.keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'));
      if (!refreshedKey) return null;
      return verifyWithKey(parts, payload, refreshedKey);
    }
    return verifyWithKey(parts, payload, jwk);
  } catch (_) {
    return null;
  }
}

function verifyWithKey(parts, payload, jwk) {
  const signature = base64urlDecode(parts[2]);
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(parts[0] + '.' + parts[1]),
    crypto.createPublicKey({key: jwk, format: 'jwk'}),
    signature
  );
  const now = Math.floor(Date.now() / 1000);
  if (!valid || typeof payload.sub !== 'string' || !payload.sub.startsWith('user_') ||
      typeof payload.sid !== 'string' || !payload.sid.startsWith('sess_') ||
      !Number.isFinite(payload.exp) || payload.exp <= now ||
      (Number.isFinite(payload.nbf) && payload.nbf > now + 30) ||
      typeof payload.iss !== 'string' || !payload.iss.startsWith('https://')) return null;

  const allowed = (process.env.CLERK_AUTHORIZED_PARTIES || 'https://sakurasound.vercel.app')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (typeof payload.azp === 'string' && allowed.length && !allowed.includes(payload.azp)) return null;
  return payload;
}

async function isAdminUser(userId) {
  if (process.env.SAKURASOUND_ADMIN_USER_ID && userId === process.env.SAKURASOUND_ADMIN_USER_ID) return true;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return false;
  const response = await fetch('https://api.clerk.com/v1/users/' + encodeURIComponent(userId), {
    headers: {Authorization: 'Bearer ' + secretKey, Accept: 'application/json'},
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return false;
  const user = await response.json();
  return user.public_metadata?.role === 'admin';
}

function bearerToken(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

module.exports = {verifySessionToken, isAdminUser, bearerToken};
