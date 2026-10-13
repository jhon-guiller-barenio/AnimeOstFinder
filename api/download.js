const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');

const ALLOWED_HOSTS = new Set(['a.animethemes.moe', 'v.animethemes.moe']);
const MAX_DECLARED_SIZE = 120 * 1024 * 1024;

function isAllowedMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname) && !url.username && !url.password;
  } catch (_) {
    return false;
  }
}

function safeFilename(value) {
  const cleaned = String(value || 'anime-theme.webm')
    .normalize('NFKD')
    .replace(/[^\w. -]/g, '')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 140);
  return cleaned || 'anime-theme.webm';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed'});
  }

  const mediaUrl = String(req.query.url || '');
  const filename = safeFilename(req.query.filename);
  if (!isAllowedMediaUrl(mediaUrl)) {
    return res.status(400).json({error: 'Only direct AnimeThemes media downloads are supported.'});
  }

  try {
    let target = mediaUrl;
    let upstream;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!isAllowedMediaUrl(target)) return res.status(400).json({error: 'The media provider redirected to an unsupported host.'});
      upstream = await fetch(target, {redirect: 'manual', headers: {Accept: 'audio/*, video/*, application/octet-stream'}});
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location) return res.status(502).json({error: 'The media provider returned an invalid redirect.'});
      target = new URL(location, target).toString();
    }

    if (!upstream || !upstream.ok || !upstream.body) {
      return res.status(upstream?.status === 404 ? 404 : 502).json({error: 'The provider could not serve this theme file.'});
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > MAX_DECLARED_SIZE) {
      await upstream.body.cancel();
      return res.status(413).json({error: 'This theme file is too large to download here.'});
    }

    const allowedTypes = new Set(['audio/webm', 'video/webm', 'audio/mpeg', 'audio/ogg', 'video/mp4', 'application/octet-stream']);
    const suppliedType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    res.setHeader('Content-Type', allowedTypes.has(suppliedType) ? suppliedType : 'application/octet-stream');
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/["\\]/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    console.error('AnimeThemes download failed:', error);
    if (!res.headersSent) return res.status(502).json({error: 'The theme download could not be started.'});
    res.destroy(error);
  }
};
