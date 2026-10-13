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
const favorites = new Set(JSON.parse(localStorage.getItem('sakura-favorites') || '[]'));
const grid = document.getElementById('trackGrid');
const statusEl = document.getElementById('apiStatus');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const dialog = document.getElementById('playerDialog');

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
  grid.innerHTML = visible.map((t,i) => `<article class="track-card">
    <div class="cover" style="--cover:${t.color || 'linear-gradient(145deg,#efc2d2,#9b6683)'}">
      <span class="cover-label">SAKURA SOUND · ${safeText(String(t.year || 'ANIME'))}</span>
      <span class="cover-glyph">${safeText(t.glyph || '♪')}</span>
      <span class="cover-type">${safeText(t.type || 'opening')} ${t.sequence ? String(t.sequence).padStart(2,'0') : ''}</span>
      <button class="play-button" data-play="${safeText(t.id)}" aria-label="Play ${safeText(t.title)}">▶</button>
      <button class="save-button ${favorites.has(String(t.id))?'saved':''}" data-save="${safeText(t.id)}" aria-label="${favorites.has(String(t.id))?'Remove from':'Add to'} favorites">${favorites.has(String(t.id))?'♥':'♡'}</button>
    </div>
    <div class="track-content"><div class="track-meta"><span>${safeText(t.type || 'opening')}</span><span>${t.year ? safeText(t.year) : 'ANIME OST'}</span></div><h3 class="track-title" title="${safeText(t.title)}">${safeText(t.title)}</h3><div class="track-anime" title="${safeText(t.anime)}">${safeText(t.anime)}</div><div class="track-bottom"><span class="artist">${safeText(t.artist || 'Artist information unavailable')}</span><span class="track-index">${String(i+1).padStart(2,'0')}</span></div></div>
  </article>`).join('');
  grid.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => toggleFavorite(b.dataset.save)));
  grid.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => openPlayer(tracks.find(t => String(t.id) === b.dataset.play))));
  statusEl.querySelector('span:last-child').textContent = dataSource;
  statusEl.classList.toggle('live', dataSource === 'Live catalog');
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
  searchTerm=query.trim();
  if (!searchTerm) {loadCatalog();return;}
  loadCatalog(searchTerm,1);
}
function openPlayer(track) {
  if (!track) return;
  playingId=track.id;
  document.getElementById('playerTitle').textContent=track.title;
  document.getElementById('playerSubtitle').textContent=`${track.anime} · ${track.artist || 'Artist unavailable'}`;
  document.getElementById('playerArt').style.background=track.color || 'linear-gradient(145deg,#edc3d2,#96617e)';
  document.getElementById('mediaMount').innerHTML='';
  const mount=document.getElementById('mediaMount');
  const mediaUrl=track.audioUrl || track.videoUrl;
  if (mediaUrl) {
    const media=document.createElement(track.audioUrl ? 'audio' : 'video');
    media.controls=true; media.autoplay=true; media.src=mediaUrl;
    if (media.tagName==='VIDEO') {media.playsInline=true;media.style.width='100%';}
    mount.appendChild(media);
    document.getElementById('sourceLink').href=mediaUrl;
    document.getElementById('sourceLink').classList.remove('hidden');
  } else {
    document.getElementById('sourceLink').classList.add('hidden');
  }
  if (!dialog.open) dialog.showModal();
}
document.getElementById('searchForm').addEventListener('submit', e=>{e.preventDefault();search(searchInput.value);document.getElementById('tracks').scrollIntoView({behavior:'smooth'});});
document.querySelectorAll('.popular button').forEach(b=>b.addEventListener('click',()=>{searchInput.value=b.dataset.query;search(b.dataset.query);document.getElementById('tracks').scrollIntoView({behavior:'smooth'});}));
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelector('.filter.active')?.classList.remove('active');b.classList.add('active');activeFilter=b.dataset.filter;render();}));
document.getElementById('sortSelect').addEventListener('change',render);
document.getElementById('savedNav').addEventListener('click',()=>{activeFilter='favorites';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='favorites'));document.getElementById('tracks').scrollIntoView({behavior:'smooth'});render();});
document.getElementById('clearFilters').addEventListener('click',()=>{activeFilter='all';searchInput.value='';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));loadCatalog();});
document.getElementById('loadMore').addEventListener('click',()=>loadCatalog(lastApiQuery,page+1));
document.getElementById('closePlayer').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>{document.getElementById('mediaMount').querySelectorAll('audio,video').forEach(m=>m.pause());});
render();
loadCatalog();
