const MUSICBRAINZ = 'https://musicbrainz.org/ws/2';
const COVER_ART_ARCHIVE = 'https://coverartarchive.org';
const ITUNES = 'https://itunes.apple.com/search';

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
  const queryTerms = [
    [title, artist, anime].filter(Boolean).join(' '),
    [title, anime].filter(Boolean).join(' ')
  ].filter((term, index, values) => term && values.indexOf(term) === index);

  for (const country of ['JP', 'US']) {
    for (const term of queryTerms) {
      const url = new URL(ITUNES);
      url.searchParams.set('term', term);
      url.searchParams.set('country', country);
      url.searchParams.set('media', 'music');
      url.searchParams.set('entity', 'song');
      url.searchParams.set('limit', '15');
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const requestedTitle = normalizeStoreText(title);
      const requestedArtist = normalizeStoreText(artist);
      const exactMatches = (data.results || []).filter(item =>
        item.trackName && item.artworkUrl100 && normalizeStoreText(item.trackName) === requestedTitle
      );
      exactMatches.sort((a,b) => {
        const aArtist = normalizeStoreText(a.artistName);
        const bArtist = normalizeStoreText(b.artistName);
        const aScore = requestedArtist && aArtist.includes(requestedArtist) ? 2 : 0;
        const bScore = requestedArtist && bArtist.includes(requestedArtist) ? 2 : 0;
        const aAlbum = normalizeStoreText(a.collectionName).includes(normalizeStoreText(anime)) ? 1 : 0;
        const bAlbum = normalizeStoreText(b.collectionName).includes(normalizeStoreText(anime)) ? 1 : 0;
        return (bScore + bAlbum) - (aScore + aAlbum);
      });
      const match = exactMatches[0];
      if (!match) continue;
      const imageUrl = match.artworkUrl100.replace(/\d+x\d+bb\./, '600x600bb.').replace(/^http:/i, 'https:');
      return {
        imageUrl,
        releaseTitle: match.collectionName || match.trackName,
        storeUrl: match.trackViewUrl || match.collectionViewUrl || 'https://music.apple.com/',
        provider: 'Apple Music'
      };
    }
  }
  return null;
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
    const appleArtwork = await getAppleArtwork(title, artist, anime);
    if (appleArtwork) return res.status(200).json(appleArtwork);

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
