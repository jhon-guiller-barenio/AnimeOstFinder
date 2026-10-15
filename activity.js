(() => {
  const STORAGE_KEY = 'sakurasound-visitor-id';
  let visitorId;
  try {
    visitorId = localStorage.getItem(STORAGE_KEY);
    if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, visitorId);
    }
  } catch (_) {
    visitorId = crypto.randomUUID();
  }

  let clerk;
  async function send(eventType) {
    try {
      const token = await window.Clerk?.session?.getToken?.();
      const response = await fetch('/api/activity', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: 'Bearer ' + token} : {})
        },
        body: JSON.stringify({event_type: eventType, visitor_id: visitorId, page_path: location.pathname})
      });
      if (response.status === 401) window.dispatchEvent(new Event('sakurasound-session-expired'));
    } catch (_) { /* Activity reporting must not interrupt music or sign-in. */ }
  }

  window.SakuraActivity = {track: send, setClerk(value) { clerk = value; window.Clerk = value; }};
  document.addEventListener('submit', event => {
    if (event.target?.id === 'searchForm') send('search');
  });
  document.addEventListener('click', event => {
    const target = event.target.closest?.('button, a');
    if (!target) return;
    if (target.matches('[data-play]')) send('play');
    else if (target.matches('[data-save]')) send(target.classList.contains('saved') ? 'favorite_add' : 'favorite_remove');
    else if (target.matches('#supportLauncher, #supportChatLink')) send('support_open');
    else if (target.matches('#drawerAiChat')) send('chat_open');
    else if (target.matches('#downloadTrack, #downloadMp3Track') || target.getAttribute('href')?.includes('/api/download')) send('download');
  });
  document.addEventListener('DOMContentLoaded', () => send('page_view'));
  if (document.readyState !== 'loading') send('page_view');
})();
