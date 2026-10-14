const API = 'https://api.animethemes.moe/anime/';
const INCLUDE = 'animethemes.song.artists,animethemes.animethemeentries.videos.audio,images';
const sampleTracks = [
  {id:'s1',title:'Idol',anime:'Oshi no Ko',artist:'YOASOBI',type:'opening',sequence:'01',year:2023,color:'linear-gradient(145deg,#f0b6cb,#b45d88)',glyph:'星'},
  {id:'s2',title:'Gurenge',anime:'Demon Slayer: Kimetsu no Yaiba',artist:'LiSA',type:'opening',sequence:'01',year:2019,color:'linear-gradient(145deg,#f4c4a8,#b65e6c)',glyph:'紅'},
  {id:'s3',title:'SPECIALZ',anime:'Jujutsu Kaisen',artist:'King Gnu',type:'opening',sequence:'04',year:2023,color:'linear-gradient(145deg,#b9b2d8,#665078)',glyph:'呪'},
  {id:'s4',title:'Kaikai Kitan',anime:'Jujutsu Kaisen',artist:'Eve',type:'opening',sequence:'01',year:2020,color:'linear-gradient(145deg,#a8c4d1,#526b82)',glyph:'廻'},
  {id:'s5',title:'The Rumbling',anime:'Attack on Titan',artist:'SiM',type:'opening',sequence:'07',year:2022,color:'linear-gradient(145deg,#c99b91,#59424a)',glyph:'進'},
  {id:'s6',title:'Mixed Nuts',anime:'SPY x FAMILY',artist:'Official HIGE DANdism',type:'opening',sequence:'01',year:2022,color:'linear-gradient(145deg,#efc990,#bc805a)',glyph:'家'},
  {id:'s7',title:'Again',anime:'Fullmetal Alchemist: Brotherhood',artist:'YUI',type:'opening',sequence:'01',year:2009,color:'linear-gradient(145deg,#a7c0b0,#557c73)',glyph:'鋼'},
  {id:'s8',title:'Unravel',anime:'Tokyo Ghoul',artist:'TK from Ling Tosite Sigure',type:'opening',sequence:'01',year:2014,color:'linear-gradient(145deg,#b9a0ba,#604764)',glyph:'隻'},
  {id:'s9',title:'Shinzo wo Sasageyo!',anime:'Attack on Titan',artist:'Linked Horizon',type:'opening',sequence:'03',year:2017,color:'linear-gradient(145deg,#d8b087,#826148)',glyph:'捧'},
  {id:'s10',title:'Kigeki',anime:'SPY x FAMILY',artist:'Gen Hoshino',type:'ending',sequence:'01',year:2022,color:'linear-gradient(145deg,#d8a8a4,#8a5366)',glyph:'喜'},
  {id:'s11',title:'Hana ni Natte',anime:'The Apothecary Diaries',artist:'緑黄色社会',type:'opening',sequence:'02',year:2023,color:'linear-gradient(145deg,#e8bfd0,#a16181)',glyph:'花'},
  {id:'s12',title:'KICK BACK',anime:'Chainsaw Man',artist:'Kenshi Yonezu',type:'opening',sequence:'01',year:2022,color:'linear-gradient(145deg,#e6b78f,#bd6953)',glyph:'力'}
];
let tracks = [...sampleTracks];
let activeFilter = 'all';
let searchTerm = '';
let page = 1;
let dataSource = 'Curated picks';
let lastApiQuery = '';
let playingId = null;
let playbackQueue = [];
let activePlayerTrack = null;
let youtubePlayer = null;
let youtubeApiPromise = null;
let youtubeProgressTimer = null;
let youtubeActive = false;
const youtubeSearchCache = new Map();
const favorites = new Set(JSON.parse(localStorage.getItem('sakura-favorites') || '[]'));
const grid = document.getElementById('trackGrid');
const statusEl = document.getElementById('apiStatus');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('searchSuggestions');
const dialog = document.getElementById('playerDialog');
const themeToggle = document.getElementById('themeToggle');
const miniPlayer = document.getElementById('miniPlayer');
const albumArtCache = new Map();
const albumArtQueue = [];
const albumArtJobs = new Map();
const MAX_ART_LOOKUPS = 6;
let activeArtLookups = 0;
let activeSuggestion = -1;
let suggestionItems = [];
let artObserver;
let revealObserver;

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggle.innerHTML = `<span aria-hidden="true">${isDark ? '☀' : '☾'}</span>`;
  themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#17131b' : '#fff8fa';
  localStorage.setItem('sakura-theme', theme);
}

setTheme(localStorage.getItem('sakura-theme') || 'light');
themeToggle.addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));

function safeText(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getVisibleTracks() {
  let result = tracks.filter(t => activeFilter === 'all' || activeFilter === 'favorites' ? (activeFilter !== 'favorites' || favorites.has(String(t.id))) : t.type === activeFilter);
  if (searchTerm && dataSource === 'Curated picks') {
    const q = searchTerm.toLowerCase();
    result = result.filter(t => `${t.title} ${t.anime} ${t.artist}`.toLowerCase().includes(q));
  }
  const sort = document.getElementById('sortSelect').value;
  if (sort === 'az') result.sort((a,b) => a.title.localeCompare(b.title));
  if (sort === 'year') result.sort((a,b) => (b.year||0) - (a.year||0));
  return result;
}
function render() {
  const visible = getVisibleTracks();
  document.getElementById('allCount').textContent = tracks.length;
  document.getElementById('savedCount').textContent = favorites.size;
  emptyEl.hidden = visible.length > 0;
  grid.innerHTML = visible.map((t,i) => `<article class="track-card" data-card-id="${safeText(t.id)}" style="--card-delay:${Math.min(i,8)*45}ms">
    <div class="cover" data-track-id="${safeText(t.id)}" style="--cover:${t.color || 'linear-gradient(145deg,#efc2d2,#9b6683)'}">
      <span class="cover-label">SAKURA SOUND · ${safeText(String(t.year || 'ANIME'))}</span>
      <span class="cover-glyph">${safeText(t.glyph || '♪')}</span>
      <span class="cover-type">${safeText(t.type || 'opening')} ${t.sequence ? String(t.sequence).padStart(2,'0') : ''}</span>
      <button class="play-button" data-play="${safeText(t.id)}" aria-label="Play ${safeText(t.title)}">▶</button>
      <button class="save-button ${favorites.has(String(t.id))?'saved':''}" data-save="${safeText(t.id)}" aria-label="${favorites.has(String(t.id))?'Remove from':'Add to'} favorites">${favorites.has(String(t.id))?'♥':'♡'}</button>
    </div>
    <div class="track-content"><div class="track-meta"><span>${safeText(t.type || 'opening')}</span><span>${t.year ? safeText(t.year) : 'ANIME OST'}</span></div><h3 class="track-title" title="${safeText(t.title)}">${safeText(t.title)}</h3><div class="track-anime" title="${safeText(t.anime)}">${safeText(t.anime)}</div><div class="track-bottom"><span class="artist">${safeText(t.artist || 'Artist information unavailable')}</span><span class="track-index">${String(i+1).padStart(2,'0')}</span></div></div>
  </article>`).join('');
  grid.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => toggleFavorite(b.dataset.save)));
  grid.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => openPlayer(tracks.find(t => String(t.id) === b.dataset.play), getVisibleTracks())));
  revealTrackCards();
  observeAlbumArt();
  statusEl.querySelector('span:last-child').textContent = dataSource;
  statusEl.classList.toggle('live', dataSource === 'Live catalog');
}

function revealTrackCards() {
  if (revealObserver) revealObserver.disconnect();
  const cards=[...grid.querySelectorAll('.track-card')];
  if (!('IntersectionObserver' in window)) {
    cards.forEach(card=>card.classList.add('is-visible'));
    return;
  }
  revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  }),{rootMargin:'0px 0px -30px 0px',threshold:.08});
  cards.forEach(card=>revealObserver.observe(card));
}

function observeAlbumArt() {
  if (artObserver) artObserver.disconnect();
  const covers = [...grid.querySelectorAll('.cover[data-track-id]')];
  const observe = cover => {
    const track = tracks.find(item => String(item.id) === cover.dataset.trackId);
    if (!track || !track.title) return;
    const key = `${track.title}|${track.artist || ''}|${track.anime || ''}`.toLowerCase();
    if (albumArtCache.has(key)) return applyAlbumArt(cover, track, albumArtCache.get(key));
    if (artObserver) artObserver.observe(cover);
    else queueAlbumArt(cover, track, key);
  };
  artObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      artObserver.unobserve(entry.target);
      const track = tracks.find(item => String(item.id) === entry.target.dataset.trackId);
      if (track) queueAlbumArt(entry.target, track, `${track.title}|${track.artist || ''}|${track.anime || ''}`.toLowerCase());
    });
  }, {rootMargin:'160px 0px'}) : null;
  covers.forEach(observe);
}

function queueAlbumArt(cover, track, key) {
  if (track.image) {
    const imageSelector = cover.classList.contains('player-art') ? '.player-album-cover' : '.album-cover';
    if (!cover.querySelector(imageSelector)) {
      applyAlbumArt(cover, track, {imageUrl:track.image,releaseTitle:track.anime || 'Anime artwork',provider:'AnimeThemes',artworkType:'anime'});
    }
  }
  const cached = albumArtCache.get(key);
  if (cached) return applyAlbumArt(cover, track, cached);
  if (cached === null) return;
  const saved = localStorage.getItem(`sakura-art:v9:${key}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (Date.now() - data.savedAt < (data.found ? 30 : 0.01) * 86400000) {
        albumArtCache.set(key, data.result);
        return applyAlbumArt(cover, track, data.result);
      }
    } catch (_) { localStorage.removeItem(`sakura-art:v9:${key}`); }
  }
  const existing = albumArtJobs.get(key);
  if (existing) {
    if (!existing.targets.some(target => target.cover === cover)) existing.targets.push({cover, track});
  } else {
    const job = {key, track, targets:[{cover,track}]};
    albumArtJobs.set(key, job);
    albumArtQueue.push(job);
  }
  processAlbumArtQueue();
}

function processAlbumArtQueue() {
  while (activeArtLookups < MAX_ART_LOOKUPS && albumArtQueue.length) {
    const job = albumArtQueue.shift();
    activeArtLookups++;
    loadAlbumArt(job).finally(() => {
      activeArtLookups--;
      processAlbumArtQueue();
    });
  }
}

async function loadAlbumArt(job) {
  let result = null;
  try {
    const artist = job.track.artist && job.track.artist !== 'Artist information unavailable' ? job.track.artist : '';
    const params = new URLSearchParams({title:job.track.title, artist, anime:job.track.anime || '', v:'9'});
    const response = await fetch(`/api/album-art?${params}`);
    if (response.ok) {
      const payload = await response.json();
      if (payload.imageUrl) result = payload;
    }
  } catch (_) { /* Fall back to the anime's own image if album catalogs are unavailable. */ }
  if (!result && job.track.image) {
    result = {imageUrl:job.track.image,releaseTitle:job.track.anime || 'Anime artwork',provider:'AnimeThemes',artworkType:'anime'};
  }
  albumArtCache.set(job.key, result);
  try { localStorage.setItem(`sakura-art:v9:${job.key}`, JSON.stringify({result,found:!!result,savedAt:Date.now()})); } catch (_) {}
  albumArtJobs.delete(job.key);
  job.targets.forEach(({cover,track}) => applyAlbumArt(cover,track,result));
}

function applyAlbumArt(cover, track, result) {
  const isPlayer = cover.classList.contains('player-art');
  if (!result?.imageUrl || !cover.isConnected || (isPlayer && cover.dataset.artKey !== `${track.title}|${track.artist || ''}|${track.anime || ''}`.toLowerCase())) return;
  const existingImage = cover.querySelector(isPlayer ? '.player-album-cover' : '.album-cover');
  if (existingImage) {
    const isAnimeFallback = existingImage.dataset.artworkType === 'anime';
    if (!isAnimeFallback || result.artworkType === 'anime') return;
    existingImage.remove();
  }
  const image = document.createElement('img');
  image.className = isPlayer ? 'player-album-cover' : 'album-cover';
  image.dataset.artworkType = result.artworkType || 'album';
  image.alt = result.artworkType === 'anime' ? `${track.anime} artwork` : `${track.title} album artwork`;
  image.loading = isPlayer ? 'eager' : 'lazy';
  if (isPlayer) image.fetchPriority = 'high';
  image.src = result.imageUrl;
  image.title = result.artworkType === 'anime' ? `Anime artwork: ${track.anime}` : `Album art: ${result.releaseTitle || 'OST release'} · ${result.provider || 'Cover Art Archive'}`;
  image.onerror = () => {
    image.remove();
    cover.classList.remove('has-art');
    if (result.artworkType !== 'anime' && track.image) {
      applyAlbumArt(cover, track, {imageUrl:track.image,releaseTitle:track.anime || 'Anime artwork',provider:'AnimeThemes',artworkType:'anime'});
    }
  };
  cover.classList.add('has-art');
  cover.prepend(image);
  if (isPlayer) { updateMiniArt(image); return; }
  if (result.storeUrl && result.provider === 'Apple Music') {
    const link = document.createElement('a');
    link.className = 'art-store-link';
    link.href = `https://music.youtube.com/search?q=${encodeURIComponent(`${result.releaseTitle || track.title} ${track.artist || ''}`.trim())}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Find album on YouTube Music ↗';
    link.setAttribute('aria-label', `Find ${result.releaseTitle || track.title} on YouTube Music`);
    cover.appendChild(link);
  }
}

function updateSuggestions() {
  const query = searchInput.value.trim().toLowerCase();
  activeSuggestion = -1;
  if (!query) { suggestionsEl.hidden = true; return; }
  const all = [...tracks, ...sampleTracks].filter((track,index,array) => array.findIndex(item => item.title === track.title && item.anime === track.anime) === index);
  suggestionItems = all.filter(track => `${track.title} ${track.anime} ${track.artist}`.toLowerCase().includes(query)).slice(0,5);
  const options = suggestionItems.map((track,index) => `<button class="suggestion-option" type="button" role="option" aria-selected="false" data-suggestion="${index}"><span class="suggestion-note">♫</span><span class="suggestion-copy"><strong>${safeText(track.title)}</strong><small>${safeText(track.anime)} · ${safeText(track.artist)}</small></span><span class="suggestion-kind">${safeText(track.type || 'opening')}</span></button>`).join('');
  const searchAll = `<button class="suggestion-search-all" type="button" data-search-all>Search the catalog for “${safeText(searchInput.value.trim())}” <span>→</span></button>`;
  suggestionsEl.innerHTML = `${options}${searchAll}`;
  suggestionsEl.hidden = false;
  suggestionsEl.querySelectorAll('[data-suggestion]').forEach(button => button.addEventListener('click', () => selectSuggestion(Number(button.dataset.suggestion))));
  suggestionsEl.querySelector('[data-search-all]')?.addEventListener('click', submitCurrentSearch);
}

function selectSuggestion(index) {
  const track = suggestionItems[index];
  if (!track) return;
  searchInput.value = track.anime;
  suggestionsEl.hidden = true;
  search(track.anime);
  document.getElementById('tracks').scrollIntoView({behavior:'smooth'});
}

function submitCurrentSearch() {
  suggestionsEl.hidden = true;
  search(searchInput.value);
  document.getElementById('tracks').scrollIntoView({behavior:'smooth'});
}

function moveSuggestion(direction) {
  const buttons = [...suggestionsEl.querySelectorAll('[data-suggestion]')];
  if (!buttons.length) return;
  activeSuggestion = (activeSuggestion + direction + buttons.length) % buttons.length;
  buttons.forEach((button,index) => {
    const selected = index === activeSuggestion;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
}
function toggleFavorite(id) {
  id=String(id); favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem('sakura-favorites', JSON.stringify([...favorites])); render();
}
function normalizeAnime(item) {
  const anime = item.anime || item;
  const images = anime.images || [];
  const image = images[0]?.link || images[0]?.url || '';
  return (anime.animethemes || []).map((theme, idx) => {
    const song = theme.song || {};
    const artists = (song.artists || []).map(a => a.name).filter(Boolean).join(', ');
    const entry = (theme.animethemeentries || [])[0] || {};
    const video = (entry.videos || [])[0] || {};
    const audio = (video.audio || [])[0] || {};
    const type = String(theme.type || 'OP').toLowerCase().startsWith('ed') ? 'ending' : 'opening';
    return {id:`api-${anime.id}-${theme.id || idx}`,title:song.title || `${anime.name} ${type}`,anime:anime.name || 'Unknown anime',artist:artists || 'Artist information unavailable',type,sequence:theme.sequence || '',year:anime.year || '',videoUrl:video.link || video.url || '',audioUrl:audio.link || audio.url || '',image,color:'linear-gradient(145deg,#edc3d2,#96617e)',glyph:(anime.name || '♪').slice(0,1),source:'api'};
  });
}
async function loadCatalog(query='', nextPage=1) {
  lastApiQuery = query;
  const label = statusEl.querySelector('span:last-child');
  statusEl.classList.add('loading'); label.textContent='Finding anime themes…';
  const params = new URLSearchParams();
  params.set('include', INCLUDE); params.set('page[size]', '18'); params.set('page[number]', String(nextPage));
  if (query) params.set('q', query); else { params.set('sort','random'); params.set('filter[has]','animethemes'); }
  try {
    const response = await fetch(`${API}?${params.toString()}`, {headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    const payload = await response.json();
    const animeList = payload.anime || payload.data?.anime || [];
    const fresh = animeList.flatMap(normalizeAnime).filter(t=>t.title && t.anime);
    if (!fresh.length) throw new Error('No themes returned');
    if (nextPage > 1 && !query) tracks = [...tracks, ...fresh];
    else tracks = fresh;
    page=nextPage; dataSource='Live catalog'; searchTerm=''; render();
  } catch (err) {
    dataSource = 'Curated picks';
    if (query) {
      const q=query.toLowerCase();
      tracks=[...sampleTracks].filter(t=>`${t.title} ${t.anime} ${t.artist}`.toLowerCase().includes(q));
      searchTerm=query;
    } else if (nextPage===1) { tracks=[...sampleTracks]; searchTerm=''; }
    statusEl.querySelector('span:last-child').textContent = 'Curated picks';
    render();
  } finally { statusEl.classList.remove('loading'); }
}
function search(query) {
  suggestionsEl.hidden = true;
  searchTerm=query.trim();
  if (!searchTerm) {loadCatalog();return;}
  loadCatalog(searchTerm,1);
}
function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve,reject) => {
    const existing = document.querySelector('script[data-youtube-iframe-api]');
    const priorCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
      if (typeof priorCallback === 'function') { try { priorCallback(); } catch (_) {} }
    };
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.youtubeIframeApi = 'true';
    script.onerror = () => { youtubeApiPromise = null; script.remove(); reject(new Error('YouTube player could not load.')); };
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}
function stopYouTubePlayer() {
  if (youtubeProgressTimer) clearInterval(youtubeProgressTimer);
  youtubeProgressTimer = null;
  if (youtubePlayer) youtubePlayer.destroy();
  youtubePlayer = null;
  youtubeActive = false;
}
function showYouTubeStatus(message, isError = false) {
  const mount = document.getElementById('mediaMount');
  mount.replaceChildren();
  const status = document.createElement('p');
  status.className = `youtube-player-status${isError ? ' is-error' : ''}`;
  status.textContent = message;
  mount.appendChild(status);
}
function showYouTubeChoices(videos) {
  const mount = document.getElementById('mediaMount');
  mount.replaceChildren();
  const heading = document.createElement('p');
  heading.className = 'youtube-choices-heading';
  heading.textContent = 'Choose a YouTube video to play';
  const list = document.createElement('div');
  list.className = 'youtube-video-choices';
  videos.forEach(video => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'youtube-video-choice';
    choice.addEventListener('click', () => playYouTubeVideo(video.id, video.title));
    if (video.thumbnail) {
      const image = document.createElement('img');
      image.src = video.thumbnail;
      image.alt = '';
      image.loading = 'lazy';
      choice.appendChild(image);
    }
    const copy = document.createElement('span');
    copy.className = 'youtube-video-copy';
    const title = document.createElement('strong');
    title.textContent = video.title;
    const channel = document.createElement('small');
    channel.textContent = video.channelTitle;
    copy.append(title, channel);
    const play = document.createElement('span');
    play.className = 'youtube-choice-play';
    play.setAttribute('aria-hidden', 'true');
    play.textContent = '▶';
    choice.append(copy, play);
    list.appendChild(choice);
  });
  mount.append(heading, list);
}
async function findYouTubeVideos() {
  if (!activePlayerTrack) return;
  const button = document.getElementById('findYouTubeTrack');
  const preview = activeMedia();
  if (preview) preview.pause();
  stopYouTubePlayer();
  button.disabled = true;
  showYouTubeStatus('Finding playable YouTube videos…');
  const query = [activePlayerTrack.title, activePlayerTrack.artist, activePlayerTrack.anime, 'opening theme'].filter(Boolean).join(' ');
  try {
    let videos = youtubeSearchCache.get(query);
    if (!videos) {
      const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'YouTube search is unavailable.');
      videos = payload.videos || [];
      youtubeSearchCache.set(query, videos);
    }
    if (!videos.length) throw new Error('No embeddable YouTube videos were found. Try the YouTube Music search link instead.');
    showYouTubeChoices(videos);
  } catch (error) {
    showYouTubeStatus(error.message || 'YouTube could not find a playable video.', true);
  } finally {
    button.disabled = false;
  }
}
async function playYouTubeVideo(videoId, title) {
  const preview = activeMedia();
  if (preview) preview.pause();
  stopYouTubePlayer();
  const mount = document.getElementById('mediaMount');
  mount.innerHTML = '<div class="youtube-embed-shell"><div id="youtubePlayer"></div></div>';
  try {
    const YT = await loadYouTubeIframeApi();
    youtubeActive = true;
    youtubePlayer = new YT.Player('youtubePlayer', {
      width: '100%', height: '390', videoId,
      playerVars: {autoplay: 1, playsinline: 1, rel: 0, origin: window.location.origin},
      events: {
        onReady: event => { event.target.playVideo(); youtubeProgressTimer = setInterval(syncMiniPlayer, 1000); },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) { dialog.classList.add('is-playing'); showMiniPlayer(); }
          else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) dialog.classList.remove('is-playing');
          if (event.data === YT.PlayerState.ENDED) changeTrack(1);
          syncMiniPlayer();
        },
        onError: () => { stopYouTubePlayer(); showYouTubeStatus('This video cannot be embedded. Choose another result or open YouTube Music.', true); }
      }
    });
    const label = document.createElement('p');
    label.className = 'youtube-now-playing';
    label.textContent = `Playing from YouTube: ${title}`;
    mount.appendChild(label);
  } catch (error) {
    stopYouTubePlayer();
    showYouTubeStatus(error.message || 'YouTube player could not start.', true);
  }
}
function openPlayer(track, queue = playbackQueue.length ? playbackQueue : tracks, options = {}) {
  if (!track) return;
  stopYouTubePlayer();
  activePlayerTrack = track;
  playbackQueue = queue.length ? [...queue] : [track];
  if (!playbackQueue.some(item => String(item.id) === String(track.id))) playbackQueue.unshift(track);
  playingId=track.id;
  grid.querySelectorAll('.track-card').forEach(card=>card.classList.toggle('is-playing',String(card.dataset.cardId)===String(track.id)));
  document.getElementById('playerTitle').textContent=track.title;
  document.getElementById('playerSubtitle').textContent=`${track.anime} · ${track.artist || 'Artist unavailable'}`;
  document.getElementById('miniTitle').textContent=track.title;
  document.getElementById('miniSubtitle').textContent=`${track.anime} · ${track.artist || 'Artist unavailable'}`;
  const playerArt = document.getElementById('playerArt');
  const artKey = `${track.title}|${track.artist || ''}|${track.anime || ''}`.toLowerCase();
  playerArt.dataset.artKey = artKey;
  playerArt.querySelector('.player-album-cover')?.remove();
  playerArt.classList.remove('has-art');
  playerArt.style.background=track.color || 'linear-gradient(145deg,#edc3d2,#96617e)';
  document.getElementById('miniArt').style.background=playerArt.style.background;
  document.getElementById('miniArt').innerHTML='<span>♪</span>';
  queueAlbumArt(playerArt, track, artKey);
  const mount=document.getElementById('mediaMount');
  mount.querySelectorAll('audio,video').forEach(media=>media.pause());
  mount.innerHTML='';
  document.getElementById('findYouTubeTrack').disabled = false;
  document.getElementById('findYouTubeTrack').classList.toggle('hidden', !track.title);
  const youtubeMusicLink=document.getElementById('youtubeMusicLink');
  const youtubeQuery=[track.title,track.artist,track.anime].filter(Boolean).join(' ');
  youtubeMusicLink.href=`https://music.youtube.com/search?q=${encodeURIComponent(youtubeQuery)}`;
  youtubeMusicLink.classList.toggle('hidden', !track.title);
  dialog.classList.remove('is-playing');
  miniPlayer.hidden=true;
  const mediaUrl=track.audioUrl || track.videoUrl;
  const sourceLink=document.getElementById('sourceLink');
  const downloadLink=document.getElementById('downloadTrack');
  const downloadMp3Link=document.getElementById('downloadMp3Track');
  let extension='webm';
  try { extension=new URL(mediaUrl).pathname.split('.').pop().split('/')[0] || extension; } catch (_) {}
  const fileBase = `${track.artist || 'anime-ost'} - ${track.title || 'theme'}`.replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-').slice(0,100);
  if (mediaUrl) {
    const media=document.createElement(track.audioUrl ? 'audio' : 'video');
    media.controls=true; media.autoplay=true; media.src=mediaUrl;
    if (media.tagName==='VIDEO') {media.playsInline=true;media.style.width='100%';}
    media.addEventListener('play',()=>{dialog.classList.add('is-playing');syncMiniPlayer();});
    media.addEventListener('pause',()=>{dialog.classList.remove('is-playing');syncMiniPlayer();});
    media.addEventListener('timeupdate',syncMiniPlayer);
    media.addEventListener('durationchange',syncMiniPlayer);
    media.addEventListener('ended', () => changeTrack(1));
    mount.appendChild(media);
    sourceLink.href=mediaUrl;
    sourceLink.classList.remove('hidden');
    downloadLink.href=`/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(`${fileBase}.${extension}`)}`;
    downloadLink.removeAttribute('target');
    downloadLink.removeAttribute('rel');
    downloadLink.download=`${fileBase}.${extension}`;
    downloadLink.querySelector('span').textContent=track.audioUrl ? 'Download audio' : 'Download theme video';
    downloadLink.setAttribute('aria-label', `Download ${track.title} ${track.audioUrl ? 'audio' : 'video'} from the original provider`);
    downloadLink.classList.remove('hidden');
    const mp3Source = track.audioUrl || track.videoUrl;
    if (mp3Source) {
      downloadMp3Link.href=`/api/download?url=${encodeURIComponent(mp3Source)}&filename=${encodeURIComponent(`${fileBase}.mp3`)}&format=mp3`;
      downloadMp3Link.download=`${fileBase}.mp3`;
      downloadMp3Link.setAttribute('aria-label', `Download ${track.title} as MP3`);
      downloadMp3Link.classList.remove('hidden');
    } else {
      downloadMp3Link.classList.add('hidden');
    }
  } else {
    sourceLink.classList.add('hidden');
    downloadLink.classList.add('hidden');
    downloadMp3Link.classList.add('hidden');
  }
  renderPlayerQueue();
  if (options.keepMini && mediaUrl) showMiniPlayer();
  else if (!dialog.open) dialog.showModal();
}
function renderPlayerQueue() {
  const list=document.getElementById('playerQueue');
  const currentIndex=playbackQueue.findIndex(track=>String(track.id)===String(playingId));
  const nextTracks=currentIndex<0 ? playbackQueue : playbackQueue.slice(currentIndex+1);
  list.innerHTML=nextTracks.slice(0,5).map(track=>`<li><button type="button" data-queue-track="${safeText(track.id)}"><span>${safeText(track.title)}</span><small>${safeText(track.anime)}</small></button></li>`).join('');
  if (!nextTracks.length) list.innerHTML='<li class="queue-empty">End of this list</li>';
  list.querySelectorAll('[data-queue-track]').forEach(button=>button.addEventListener('click',()=>{
    const selected=playbackQueue.find(track=>String(track.id)===button.dataset.queueTrack);
    if (selected) openPlayer(selected, playbackQueue);
  }));
  const index=currentIndex;
  document.getElementById('previousTrack').disabled=playbackQueue.length<2 || index<=0;
  document.getElementById('nextTrack').disabled=playbackQueue.length<2 || index<0 || index>=playbackQueue.length-1;
}
function changeTrack(direction) {
  const index=playbackQueue.findIndex(track=>String(track.id)===String(playingId));
  const next=playbackQueue[index+direction];
  if (next) openPlayer(next, playbackQueue, {keepMini:!dialog.open});
}
function formatTime(value) {
  if (!Number.isFinite(value) || value<0) return '0:00';
  const seconds=Math.floor(value);
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
function activeMedia() { return document.getElementById('mediaMount').querySelector('audio,video'); }
function updateMiniArt(image) {
  const miniArt=document.getElementById('miniArt');
  const current=image || document.getElementById('playerArt').querySelector('.player-album-cover');
  if (!current) return;
  const copy=current.cloneNode();
  copy.removeAttribute('fetchpriority');
  miniArt.replaceChildren(copy);
}
function syncMiniPlayer() {
  const media=activeMedia();
  const seek=document.getElementById('miniSeek');
  const button=document.getElementById('miniPlayPause');
  if (youtubeActive && youtubePlayer?.getDuration) {
    const duration = Number(youtubePlayer.getDuration()) || 0;
    const time = Number(youtubePlayer.getCurrentTime()) || 0;
    seek.value = duration ? String(Math.round(time / duration * 1000)) : '0';
    document.getElementById('miniCurrentTime').textContent = formatTime(time);
    document.getElementById('miniDuration').textContent = formatTime(duration);
    const isPlaying = youtubePlayer.getPlayerState() === window.YT?.PlayerState.PLAYING;
    button.textContent = isPlaying ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    return;
  }
  if (!media) return;
  const duration=Number.isFinite(media.duration) ? media.duration : 0;
  seek.value=duration ? String(Math.round(media.currentTime/duration*1000)) : '0';
  document.getElementById('miniCurrentTime').textContent=formatTime(media.currentTime);
  document.getElementById('miniDuration').textContent=formatTime(duration);
  button.textContent=media.paused ? '▶' : 'Ⅱ';
  button.setAttribute('aria-label',media.paused?'Play':'Pause');
}
function showMiniPlayer() {
  if ((!activeMedia() && !youtubeActive) || !playingId) return;
  miniPlayer.hidden=false;
  updateMiniArt();
  syncMiniPlayer();
}
function stopPlayer() {
  stopYouTubePlayer();
  const media=activeMedia();
  if (media) { media.pause(); media.currentTime=0; media.remove(); }
  playingId=null;
  miniPlayer.hidden=true;
  dialog.classList.remove('is-playing');
  grid.querySelectorAll('.track-card').forEach(card=>card.classList.remove('is-playing'));
}
document.getElementById('searchForm').addEventListener('submit', e=>{e.preventDefault();submitCurrentSearch();});
searchInput.addEventListener('input', updateSuggestions);
searchInput.addEventListener('focus', updateSuggestions);
searchInput.addEventListener('keydown', e=>{
  if (suggestionsEl.hidden) return;
  if (e.key==='ArrowDown') {e.preventDefault();moveSuggestion(1);}
  else if (e.key==='ArrowUp') {e.preventDefault();moveSuggestion(-1);}
  else if (e.key==='Escape') suggestionsEl.hidden=true;
  else if (e.key==='Enter' && activeSuggestion>=0) {e.preventDefault();selectSuggestion(activeSuggestion);}
});
document.addEventListener('click', e=>{if (!e.target.closest('.search-shell')) suggestionsEl.hidden=true;});
document.querySelectorAll('.popular button').forEach(b=>b.addEventListener('click',()=>{searchInput.value=b.dataset.query;search(b.dataset.query);document.getElementById('tracks').scrollIntoView({behavior:'smooth'});}));
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelector('.filter.active')?.classList.remove('active');b.classList.add('active');activeFilter=b.dataset.filter;render();}));
document.getElementById('sortSelect').addEventListener('change',render);
document.getElementById('savedNav').addEventListener('click',()=>{activeFilter='favorites';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='favorites'));document.getElementById('tracks').scrollIntoView({behavior:'smooth'});render();});
document.getElementById('clearFilters').addEventListener('click',()=>{activeFilter='all';searchInput.value='';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));loadCatalog();});
document.getElementById('loadMore').addEventListener('click',()=>loadCatalog(lastApiQuery,page+1));
document.getElementById('closePlayer').addEventListener('click',()=>dialog.close());
document.getElementById('previousTrack').addEventListener('click',()=>changeTrack(-1));
document.getElementById('nextTrack').addEventListener('click',()=>changeTrack(1));
document.getElementById('miniPrevious').addEventListener('click',()=>changeTrack(-1));
document.getElementById('miniNext').addEventListener('click',()=>changeTrack(1));
document.getElementById('findYouTubeTrack').addEventListener('click',findYouTubeVideos);
document.getElementById('miniPlayPause').addEventListener('click',()=>{
  if (youtubeActive && youtubePlayer) {
    if (youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
    else youtubePlayer.playVideo();
    syncMiniPlayer();
    return;
  }
  const media=activeMedia();
  if (!media) return;
  if (media.paused) media.play().catch(()=>{}); else media.pause();
  syncMiniPlayer();
});
document.getElementById('miniSeek').addEventListener('input',event=>{
  if (youtubeActive && youtubePlayer) {
    const duration = Number(youtubePlayer.getDuration()) || 0;
    if (duration) youtubePlayer.seekTo(Number(event.target.value) / 1000 * duration, true);
    return;
  }
  const media=activeMedia();
  if (media && Number.isFinite(media.duration)) media.currentTime=Number(event.target.value)/1000*media.duration;
});
document.getElementById('miniExpand').addEventListener('click',()=>{miniPlayer.hidden=true;if(!dialog.open)dialog.showModal();});
document.getElementById('miniStop').addEventListener('click',stopPlayer);
document.getElementById('scrollTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
window.addEventListener('scroll',()=>{document.getElementById('scrollTop').hidden=window.scrollY<420;},{passive:true});
document.getElementById('tipNav').addEventListener('click',()=>document.getElementById('tipDialog').showModal());
document.getElementById('closeTip').addEventListener('click',()=>document.getElementById('tipDialog').close());
document.getElementById('tipDialog').addEventListener('click',event=>{if(event.target.id==='tipDialog')event.currentTarget.close();});
document.getElementById('tipSupportLink').addEventListener('click',event=>{if(event.currentTarget.getAttribute('aria-disabled')==='true')event.preventDefault();});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener('close',showMiniPlayer);
render();
loadCatalog();
