(() => {
  const authCard = document.getElementById('authCard');
  const dashboard = document.getElementById('dashboard');
  const authTitle = document.getElementById('authTitle');
  const authMessage = document.getElementById('authMessage');
  const authMount = document.getElementById('adminAuthMount');
  const status = document.getElementById('pageStatus');
  let clerk;
  let loading;
  let mounted = false;
  let requestId = 0;

  function setStatus(message, isError = true) {
    status.textContent = message || '';
    status.classList.toggle('ok', !isError && !!message);
  }

  function addScript(src, attributes = {}) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(item => item.src === src);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      Object.entries(attributes).forEach(([key,value]) => script.setAttribute(key,value));
      script.addEventListener('load', () => {script.dataset.loaded='true';resolve();},{once:true});
      script.addEventListener('error', () => { script.remove(); reject(new Error('Could not load secure sign-in. Reload to try again.')); }, {once:true});
      document.head.appendChild(script);
    });
  }

  async function startClerk() {
    if (clerk) return clerk;
    if (loading) return loading;
    loading = (async () => {
      const response = await fetch('/api/clerk-config', {cache:'no-store',headers:{Accept:'application/json'}});
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.publishableKey || !config.proxyUrl) throw new Error('Clerk is not configured. Check the SakuraSound Clerk keys in Vercel.');
      const proxyBase = config.proxyUrl.replace(/\/+$/,'');
      await Promise.all([
        addScript(proxyBase + '/npm/@clerk/ui@1/dist/ui.browser.js'),
        addScript(proxyBase + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', {
          'data-clerk-publishable-key':config.publishableKey,
          'data-clerk-proxy-url':config.proxyUrl
        })
      ]);
      if (!window.Clerk) throw new Error('Clerk could not start. Check the configured publishable key and proxy URL.');
      const instance = new window.Clerk(config.publishableKey,{proxyUrl:config.proxyUrl});
      await instance.load({proxyUrl:config.proxyUrl,ui:{ClerkUI:window.__internal_ClerkUICtor}});
      clerk = instance;
      window.SakuraActivity?.setClerk(clerk);
      clerk.addListener?.(() => render());
      return clerk;
    })().catch(error => {
      loading = null;
      setStatus(error.message || 'Clerk could not start.');
      return null;
    });
    return loading;
  }

  function render() {
    if (!clerk) return;
    document.getElementById('signOut').hidden = !clerk.isSignedIn;
    if (!clerk.isSignedIn) {
      ++requestId;
      document.getElementById('refresh').hidden = true;
      authCard.hidden = false;
      dashboard.hidden = true;
      authTitle.textContent = 'Sign in to continue';
      authMessage.textContent = 'Use your SakuraSound Clerk account. The dashboard requires an administrator role.';
      if (!mounted) {clerk.mountSignIn(authMount);mounted=true;}
      return;
    }
    if (mounted) {clerk.unmountSignIn?.(authMount);authMount.replaceChildren();mounted=false;}
    authCard.hidden = true;
    loadDashboard().catch(() => { dashboard.hidden = true; setStatus("Unable to connect to the dashboard. Try refreshing."); });
  }

  function displayChart(rows) {
    const node=document.getElementById('dailyChart');
    const daily=new Map(rows.map(row=>[row.day,row]));
    const days=[];
    for(let offset=13;offset>=0;offset--){
      const date=new Date();
      date.setUTCDate(date.getUTCDate()-offset);
      const key=date.toISOString().slice(0,10);
      days.push({key,label:new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'}).format(date),...(daily.get(key)||{events:0,users:0})});
    }
    const max=Math.max(1,...days.map(item=>Number(item.events)));
    node.innerHTML=days.map(item=>{
      const eventHeight=Math.max(2,Number(item.events)/max*100);
      const userHeight=Math.max(2,Number(item.users)/max*100);
      return '<div class="chart-day" title="'+item.key+': '+item.events+' events, '+item.users+' users"><div class="bars"><i class="bar" style="height:'+eventHeight+'%"></i><i class="bar users" style="height:'+userHeight+'%"></i></div><time>'+item.label+'</time></div>';
    }).join('');
  }

  function renderPopular(rows) {
    const node=document.getElementById('popularPages');
    node.innerHTML=rows.length ? rows.map(row=>'<div class="popular-row"><span>'+escapeHtml(row.page_path || '/')+'</span><b>'+Number(row.views).toLocaleString()+'</b></div>').join('') : '<p class="panel-heading p">No page views recorded yet.</p>';
  }

  function renderRecent(rows) {
    const node=document.getElementById('recentEvents');
    if (!rows.length) {node.innerHTML='<p>No activity recorded yet.</p>';return;}
    node.innerHTML='<table><thead><tr><th>Event</th><th>Clerk user</th><th>Page</th><th>Time</th></tr></thead><tbody>'+rows.map(row=>
      '<tr><td><span class="event-tag">'+escapeHtml(row.event_type.replaceAll('_',' '))+'</span></td><td>'+escapeHtml(row.clerk_user_id || 'Guest')+'</td><td>'+escapeHtml(row.page_path || '/')+'</td><td>'+escapeHtml(new Date(row.created_at).toLocaleString())+'</td></tr>'
    ).join('')+'</tbody></table>';
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

  async function loadDashboard() {
    const current=++requestId;
    const token=await clerk?.session?.getToken?.();
    if (current !== requestId || !clerk?.isSignedIn) return;
    if (!token) { dashboard.hidden = true; setStatus('Your session has expired. Sign in again.'); return; }
    setStatus('Loading activity…',false);
    const response=await fetch('/api/admin/activity',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if (current!==requestId) return;
    if (!response.ok) {
      authCard.hidden=false;
      dashboard.hidden=true;
      authTitle.textContent=response.status===403?'Administrator role required':'Dashboard unavailable';
      authMessage.textContent=response.status===403?'In Clerk Dashboard, open your user and set public_metadata to {"role":"admin"}, or configure SAKURASOUND_ADMIN_USER_ID in Vercel.':(payload.error || 'Unable to load the dashboard.');
      setStatus(payload.error || 'Unable to load the dashboard.');
      return;
    }
    authCard.hidden=true;
    dashboard.hidden=false;
    document.getElementById('refresh').hidden=false;
    document.getElementById('events24').textContent=Number(payload.totals?.events_24h||0).toLocaleString();
    document.getElementById('users24').textContent=Number(payload.totals?.users_24h||0).toLocaleString();
    document.getElementById('events30').textContent=Number(payload.totals?.events_30d||0).toLocaleString();
    document.getElementById('users30').textContent=Number(payload.totals?.users_30d||0).toLocaleString();
    displayChart(payload.daily||[]);
    renderPopular(payload.popular||[]);
    renderRecent(payload.recent||[]);
    setStatus('',false);
  }

  document.getElementById('refresh').addEventListener('click', () => loadDashboard().catch(() => setStatus('Unable to connect. Try again.')));
  document.getElementById('signOut').addEventListener('click',async()=>{
    await clerk?.signOut();
    location.reload();
  });
  document.addEventListener('DOMContentLoaded',async()=>{
    const instance=await startClerk();
    if(instance) render();
  });
})();
