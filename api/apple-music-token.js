const {sign} = require('node:crypto');

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
let cachedToken = '';
let cachedUntil = 0;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function createDeveloperToken() {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKey = String(process.env.APPLE_MUSIC_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const origin = process.env.APPLE_MUSIC_ORIGIN || 'https://sakurasound.vercel.app';
  const header = base64url(JSON.stringify({alg:'ES256',kid:keyId,typ:'JWT'}));
  const claims = base64url(JSON.stringify({iss:teamId,iat:now,exp:now + TOKEN_LIFETIME_SECONDS,origin:[origin]}));
  const unsignedToken = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsignedToken), {
    key:privateKey,
    dsaEncoding:'ieee-p1363'
  }).toString('base64url');
  cachedUntil = now + TOKEN_LIFETIME_SECONDS;
  cachedToken = `${unsignedToken}.${signature}`;
  return cachedToken;
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  try {
    const token = cachedToken && cachedUntil - Math.floor(Date.now() / 1000) > 3600
      ? cachedToken
      : createDeveloperToken();
    if (!token) {
      return res.status(503).json({error:'Apple Music playback is not configured yet.'});
    }
    res.setHeader('Cache-Control','private, max-age=3600');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).json({developerToken:token});
  } catch (error) {
    console.error('Apple Music token creation failed:', error);
    return res.status(500).json({error:'Apple Music could not be initialized.'});
  }
};
