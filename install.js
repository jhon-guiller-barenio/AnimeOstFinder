(() => {
  const button = document.getElementById('installApp');
  const status = document.getElementById('installStatus');
  const androidButton = document.getElementById('installAndroid');
  const appleButton = document.getElementById('installApple');
  const guide = document.getElementById('installGuide');
  let prompt;
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const sync = () => { button.hidden = Boolean(installed()); };
  sync();
  matchMedia('(display-mode: standalone)').addEventListener?.('change', sync);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; });
  window.addEventListener('appinstalled', () => { prompt = null; button.hidden = true; status.hidden = true; });
  const showGuide = message => {
    guide.textContent = message;
    guide.hidden = false;
    guide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const installAndroid = async () => {
    if (prompt) {
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        showGuide('In Chrome, open the ⋮ menu and choose Install app or Add to Home screen.');
      } finally {
        prompt = null;
      }
      return;
    }
    showGuide('On Android, open SakuraSound in Chrome, tap ⋮, then choose Install app or Add to Home screen.');
  };
  const installApple = () => showGuide('On iPhone or iPad: open SakuraSound in Safari, tap Share (the square with an arrow), choose Add to Home Screen, then tap Add.');
  button.addEventListener('click', () => {
    if (isAppleMobile) installApple();
    else installAndroid();
    if (!status.hidden) status.hidden = true;
  });
  androidButton.addEventListener('click', installAndroid);
  appleButton.addEventListener('click', installApple);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('App offline page unavailable', error));
  });
})();
