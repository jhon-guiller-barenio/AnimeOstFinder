const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const searchCache = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed'});
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({error: 'In-site YouTube playback needs a YOUTUBE_API_KEY in Vercel Environment Variables. The YouTube Music link still works.'});
  }

  const query = String(req.query?.q || '').trim().slice(0, 180);
  if (!query) return res.status(400).json({error: 'Add a song title to search YouTube.'});

  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({error: 'Cross-site search is not allowed.'});
    } catch (_) {
      return res.status(403).json({error: 'Invalid request origin.'});
    }
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json({videos: cached.videos, cached: true});
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('videoSyndicated', 'true');
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('q', query);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url, {headers: {Accept: 'application/json'}});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiReason = payload.error?.errors?.[0]?.reason;
      const message = apiReason === 'quotaExceeded'
        ? 'YouTube search reached its daily free quota. Try again after it resets.'
        : 'YouTube search is temporarily unavailable. Try the YouTube Music link instead.';
      return res.status(apiReason === 'quotaExceeded' ? 429 : 502).json({error: message});
    }

    const videos = (payload.items || []).map(item => ({
      id: String(item.id?.videoId || ''),
      title: String(item.snippet?.title || ''),
      channelTitle: String(item.snippet?.channelTitle || 'YouTube'),
      thumbnail: String(item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '')
    })).filter(video => /^[a-zA-Z0-9_-]{11}$/.test(video.id) && video.title);

    if (searchCache.size >= MAX_CACHE_ENTRIES) searchCache.delete(searchCache.keys().next().value);
    searchCache.set(cacheKey, {videos, expiresAt: Date.now() + CACHE_TTL_MS});
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json({videos});
  } catch (error) {
    console.error('YouTube video search failed:', error?.message || 'unknown error');
    return res.status(502).json({error: 'YouTube search is temporarily unavailable. Try the YouTube Music link instead.'});
  }
};
