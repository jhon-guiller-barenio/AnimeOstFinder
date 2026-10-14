const MUSICBRAINZ = 'https://musicbrainz.org/ws/2';
const COVER_ART_ARCHIVE = 'https://coverartarchive.org';
const ITUNES = 'https://itunes.apple.com/search';
const DEEZER = 'https://api.deezer.com/search/track';

function escapeLucenePhrase(value) {
  return `"${String(value).replace(/[+\-!(){}\[\]^"~*?:\\/]/g, '\\$&')}"`;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function matchScore(releaseGroup, title, artist) {
  const requestedTitle = normalize(title);
  const foundTitle = normalize(releaseGroup.title);
  const foundArtists = (releaseGroup['artist-credit'] || [])
    .map(credit => credit.name || credit.artist?.name || '')
    .join(' ');
  const requestedArtist = normalize(artist);
  const normalizedArtists = normalize(foundArtists);
  const titleMatch = foundTitle === requestedTitle || foundTitle.includes(requestedTitle) || requestedTitle.includes(foundTitle);
  const artistMatch = !requestedArtist || normalizedArtists.includes(requestedArtist) || requestedArtist.includes(normalizedArtists);
  return {titleMatch, artistMatch};
}

async function getCoverArt(mbid) {
  const response = await fetch(`${COVER_ART_ARCHIVE}/release-group/${mbid}`, {
    headers: {Accept: 'application/json'}
  });
  if (!response.ok) return null;
  const data = await response.json();
  const front = (data.images || []).find(image => image.front) || (data.images || [])[0];
  if (!front) return null;
  const imageUrl = front.thumbnails?.['500'] || front.thumbnails?.['250'] || front.image || null;
  return imageUrl ? imageUrl.replace(/^http:/i, 'https:') : null;
}

function normalizeStoreText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(the|a|an)/, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

async function getAppleArtwork(title, artist, anime) {
  const term = [artist, title].filter(Boolean).join(' ');
  const responses = await Promise.all(['JP', 'US'].map(async country => {
    const url = new URL(ITUNES);
    url.searchParams.set('term', term);
    url.searchParams.set('country', country);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '30');
    try {
      const response = await fetch(url);
      return {country, data:response.ok ? await response.json() : {results:[]}};
    } catch (_) { return {country, data:{results:[]}}; }
  }));
  const requestedTitle = normalizeStoreText(title);
  const requestedArtist = normalizeStoreText(artist);
  const animeName = normalizeStoreText(anime);
  const matches = responses.flatMap(({country,data}) => (data.results || []).map(item => ({item,country}))).filter(({item}) => item.artworkUrl100 && item.trackName)
    .map(({item,country}) => {
      const trackName = normalizeStoreText(item.trackName);
      const storeArtist = normalizeStoreText(item.artistName);
      const albumName = normalizeStoreText(item.collectionName);
      const titleExact = trackName === requestedTitle;
      const titleClose = trackName.startsWith(requestedTitle) || requestedTitle.startsWith(trackName);
      const artistMatch = !requestedArtist || storeArtist.includes(requestedArtist) || requestedArtist.includes(storeArtist);
      const albumMatch = animeName && albumName.includes(animeName);
      return {item, country, score: (titleExact ? 8 : titleClose ? 3 : 0) + (artistMatch ? 5 : -8) + (albumMatch ? 2 : 0)};
    })
    .filter(match => match.score >= (requestedArtist ? 5 : 8))
    .sort((a,b) => b.score - a.score);
  const match = matches[0];
  if (!match) return null;
  const imageUrl = match.item.artworkUrl100.replace(/\d+x\d+bb\./, '600x600bb.').replace(/^http:/i, 'https:');
  return {
    imageUrl,
    releaseTitle: match.item.collectionName || match.item.trackName,
    storeUrl: match.item.trackViewUrl || match.item.collectionViewUrl || 'https://music.apple.com/',
    provider: 'Apple Music',
    appleMusicTrackId: String(match.item.trackId || ''),
    appleMusicStorefront: match.country.toLowerCase()
  };
}

async function getDeezerArtwork(title, artist, anime) {
  const term = [artist, title].filter(Boolean).join(' ');
  const requestedTitle = normalizeStoreText(title);
  const requestedArtist = normalizeStoreText(artist);
  const animeName = normalizeStoreText(anime);
  const url = new URL(DEEZER);
  url.searchParams.set('q', term);
  url.searchParams.set('limit', '25');
  let data;
  try {
    const response = await fetch(url);
    data = response.ok ? await response.json() : {data:[]};
  } catch (_) { data = {data:[]}; }
  const matches = (data.data || []).filter(item => item.title && (item.album?.cover_xl || item.album?.cover_big))
      .map(item => {
        const trackTitle = normalizeStoreText(item.title);
        const trackArtist = normalizeStoreText(item.artist?.name);
        const albumTitle = normalizeStoreText(item.album?.title);
        const exact = trackTitle === requestedTitle;
        const close = trackTitle.startsWith(requestedTitle) || requestedTitle.startsWith(trackTitle);
        const artistMatch = !requestedArtist || trackArtist.includes(requestedArtist) || requestedArtist.includes(trackArtist);
        return {item, score: (exact ? 8 : close ? 3 : 0) + (artistMatch ? 5 : -8) + (animeName && albumTitle.includes(animeName) ? 2 : 0)};
      })
      .filter(match => match.score >= (requestedArtist ? 5 : 8))
      .sort((a,b) => b.score - a.score);
  const match = matches[0]?.item;
  return match ? {
    imageUrl: match.album.cover_xl || match.album.cover_big,
    releaseTitle: match.album.title || match.title,
    storeUrl: match.link || match.album.link || 'https://www.deezer.com/',
    provider: 'Deezer'
  } : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed'});
  }

  const title = String(req.query.title || '').trim().slice(0, 120);
  const artist = String(req.query.artist || '').trim().slice(0, 120);
  const anime = String(req.query.anime || '').trim().slice(0, 120);
  if (!title) return res.status(400).json({error: 'A song title is required.'});

  res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const [appleResult, deezerResult] = await Promise.allSettled([
      getAppleArtwork(title, artist, anime),
      getDeezerArtwork(title, artist, anime)
    ]);
    const appleArtwork = appleResult.status === 'fulfilled' ? appleResult.value : null;
    const deezerArtwork = deezerResult.status === 'fulfilled' ? deezerResult.value : null;
    const artwork = appleArtwork || deezerArtwork;
    if (artwork) return res.status(200).json(artwork);

    if (!artist) {
      res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json({found: false});
    }

    const query = `release:${escapeLucenePhrase(title)} AND artist:${escapeLucenePhrase(artist)}`;
    const searchUrl = new URL(`${MUSICBRAINZ}/release-group`);
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('fmt', 'json');
    searchUrl.searchParams.set('limit', '5');

    const contact = process.env.MUSICBRAINZ_CONTACT || 'https://github.com/jhon-guiller-barenio';
    const response = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `SakuraSound/1.1 (${contact})`
      }
    });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(502).json({error: 'The album-art catalog is temporarily unavailable.'});
    }

    const data = await response.json();
    const groups = (data['release-groups'] || []).filter(group => group.id);
    groups.sort((a,b) => (Number(b.score)||0) - (Number(a.score)||0));

    for (const group of groups.slice(0, 3)) {
      const match = matchScore(group, title, artist);
      if (!match.titleMatch || !match.artistMatch) continue;
      const imageUrl = await getCoverArt(group.id);
      if (imageUrl) {
        return res.status(200).json({
          imageUrl,
          releaseTitle: group.title,
          releaseGroupId: group.id,
          provider: 'MusicBrainz / Cover Art Archive'
        });
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({found: false});
  } catch (error) {
    console.error('Album art lookup failed:', error);
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(502).json({error: 'Album artwork could not be loaded.'});
  }
};
