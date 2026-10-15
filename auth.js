(() => {
  const dialog = document.getElementById('loginDialog');
  const mount = document.getElementById('clerkAuthMount');
  const status = document.getElementById('clerkAuthStatus');
  const headerLogin = document.getElementById('loginHeader');
  const drawerLogin = document.getElementById('drawerLogin');
  const modeTabs = document.getElementById('authModeTabs');
  const signInTab = document.getElementById('signInTab');
  const signUpTab = document.getElementById('signUpTab');
  if (!dialog || !mount || !status || !headerLogin) return;

  let clerk;
  let loading;
  let selectedMode = 'signin';
  let mountedMode = '';\n  let lastAuthUserId = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.hidden = !message;
  }

  function updateAccountLabels() {
    const user = clerk?.user;
    const signedIn = Boolean(clerk?.isSignedIn && user);
    const label = signedIn
      ? (user.firstName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Account')
      : 'Log in';
    headerLogin.textContent = label;
    headerLogin.setAttribute('aria-label', signedIn ? 'Manage your SakuraSound account' : 'Log in to SakuraSound');
    if (drawerLogin) {
      const labelNode = [...drawerLogin.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (labelNode) labelNode.textContent = signedIn ? 'Account ' : 'Log in ';
    }
    if (modeTabs) modeTabs.hidden = signedIn;
  }

  function unmountCurrent() {
    if (!clerk || !mountedMode) return;
    if (mountedMode === 'signin') clerk.unmountSignIn?.(mount);
    if (mountedMode === 'signup') clerk.unmountSignUp?.(mount);
    if (mountedMode === 'profile') clerk.unmountUserProfile?.(mount);
    mountedMode = '';
  }

  function mountAccountPanel() {
    if (!clerk || !dialog.open) return;
    const mode = clerk.isSignedIn ? 'profile' : selectedMode;
    if (mountedMode === mode) return;
    unmountCurrent();
    mount.replaceChildren();
    if (mode === 'profile') clerk.mountUserProfile(mount);
    else if (mode === 'signup') clerk.mountSignUp(mount);
    else clerk.mountSignIn(mount);
    mountedMode = mode;
    setStatus('');
    updateAccountLabels();
  }

  function selectMode(mode) {
    selectedMode = mode;
    signInTab?.setAttribute('aria-selected', String(mode === 'signin'));
    signUpTab?.setAttribute('aria-selected', String(mode === 'signup'));
    if (clerk) mountAccountPanel();
    else initialize();
  }

  function loadScript(src, attributes = {}) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === src);
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
      Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, {once:true});
      script.addEventListener('error', () => reject(new Error('Could not load Clerk authentication.')), {once:true});
      document.head.appendChild(script);
    });
  }

  async function initialize() {
    if (clerk) {
      mountAccountPanel();
      return clerk;
    }
    if (loading) return loading;
    loading = (async () => {
      setStatus('Connecting to secure sign-in…');
      const response = await fetch('/api/clerk-config', {headers:{Accept:'application/json'}, cache:'no-store'});
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.publishableKey || !config.proxyUrl) {
        throw new Error(config.error || 'Clerk is not configured. Check the publishable key, secret key, and proxy settings in Vercel.');
      }

      const proxyBase = config.proxyUrl.replace(/\/+$/, '');
      await Promise.all([
        loadScript(proxyBase + '/npm/@clerk/ui@1/dist/ui.browser.js'),
        loadScript(proxyBase + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', {
          'data-clerk-publishable-key': config.publishableKey,
          'data-clerk-proxy-url': config.proxyUrl
        })
      ]);
      if (!window.Clerk) throw new Error('Clerk did not start. Check the configured publishable key and proxy URL.');
      clerk = new window.Clerk(config.publishableKey, {proxyUrl: config.proxyUrl});
      await clerk.load({proxyUrl: config.proxyUrl, ui:{ClerkUI:window.__internal_ClerkUICtor}});
      clerk.addListener?.(() => {
        updateAccountLabels();
        mountAccountPanel();
      });
      updateAccountLabels();
      mountAccountPanel();
      return clerk;
    })().catch(error => {
      loading = null;
      setStatus(error.message || 'Sign-in could not be loaded. Please try again.', true);
      return null;
    });
    return loading;
  }

  signInTab?.addEventListener('click', () => selectMode('signin'));
  signUpTab?.addEventListener('click', () => selectMode('signup'));

  const observer = new MutationObserver(() => {
    if (dialog.open) initialize();
  });
  observer.observe(dialog, {attributes:true, attributeFilter:['open']});

  headerLogin.addEventListener('click', () => {
    if (clerk) mountAccountPanel();
    else initialize();
  });
  drawerLogin?.addEventListener('click', () => {
    if (clerk) mountAccountPanel();
    else initialize();
  });

  if ('requestIdleCallback' in window) requestIdleCallback(() => initialize(), {timeout:2500});
  else window.setTimeout(() => initialize(), 1200);
})();
