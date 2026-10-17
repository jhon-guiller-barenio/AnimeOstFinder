(() => {
  const button = document.getElementById('installApp');
  const status = document.getElementById('installStatus');
  let prompt;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const sync = () => { button.hidden = Boolean(installed()); };
  sync();
  matchMedia('(display-mode: standalone)').addEventListener('change', sync);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; });
  window.addEventListener('appinstalled', () => { prompt = null; button.hidden = true; status.hidden = true; });
  button.addEventListener('click', async () => {
    if (prompt) {
      try { await prompt.prompt(); await prompt.userChoice; }
      catch { status.textContent = 'Use your browser menu to install SakuraSound.'; status.hidden = false; }
      finally { prompt = null; }
      return;
    }
    status.textContent = /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? 'In Safari, tap Share → Add to Home Screen → Add.'
      : 'Open your browser menu and choose Install app or Add to Home screen. If unavailable, try Chrome or Edge.';
    status.hidden = false;
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('App offline page unavailable', error));
  });
})();
