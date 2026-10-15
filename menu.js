(() => {
  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('sideDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const closeButton = document.getElementById('drawerClose');
  if (!toggle || !drawer || !backdrop) return;

  const loginDialog = document.getElementById('loginDialog');
  const chatDialog = document.getElementById('aiChatDialog');
  const chatHistory = [];

  const openDrawer = () => {
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-visible');
    });
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    closeButton?.focus();
  };

  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('drawer-open');
    window.setTimeout(() => {
      if (!drawer.classList.contains('is-open')) backdrop.hidden = true;
    }, 250);
    toggle.focus();
  };

  const openChat = () => {
    closeDrawerIfOpen();
    if (!chatDialog?.open) chatDialog?.showModal();
    document.getElementById('aiChatInput')?.focus();
  };

  function closeDrawerIfOpen() {
    if (toggle.getAttribute('aria-expanded') === 'true') closeDrawer();
  }

  toggle.addEventListener('click', () => {
    toggle.getAttribute('aria-expanded') === 'true' ? closeDrawer() : openDrawer();
  });
  closeButton?.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeDrawer();
  });
  drawer.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', closeDrawer));

  const filterFromMenu = filter => {
    closeDrawer();
    document.querySelector('.filter[data-filter="' + filter + '"]')?.click();
    document.getElementById('tracks')?.scrollIntoView({behavior: 'smooth'});
  };
  document.getElementById('drawerAllSongs')?.addEventListener('click', () => filterFromMenu('all'));
  document.getElementById('drawerOpenings')?.addEventListener('click', () => filterFromMenu('opening'));
  document.getElementById('drawerEndings')?.addEventListener('click', () => filterFromMenu('ending'));
  document.getElementById('drawerFavorites')?.addEventListener('click', () => filterFromMenu('favorites'));
  document.getElementById('drawerCollection')?.addEventListener('click', () => {
    closeDrawer();
    document.getElementById('savedNav')?.click();
  });
  document.getElementById('drawerTheme')?.addEventListener('click', () => {
    closeDrawer();
    document.getElementById('themeToggle')?.click();
  });
  document.getElementById('drawerTip')?.addEventListener('click', () => {
    closeDrawer();
    document.getElementById('tipNav')?.click();
  });
  document.getElementById('loginHeader')?.addEventListener('click', () => loginDialog?.showModal());
  document.getElementById('drawerLogin')?.addEventListener('click', () => {
    closeDrawer();
    loginDialog?.showModal();
  });
  document.getElementById('drawerAiChat')?.addEventListener('click', openChat);
  document.getElementById('supportLauncher')?.addEventListener('click', openChat);
  document.getElementById('supportChatLink')?.addEventListener('click', openChat);
  document.getElementById('closeLogin')?.addEventListener('click', () => loginDialog?.close());
  document.getElementById('closeAiChat')?.addEventListener('click', () => chatDialog?.close());

  for (const id of ['loginDialog', 'aiChatDialog']) {
    document.getElementById(id)?.addEventListener('click', event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
  }

  const log = document.getElementById('aiChatLog');
  const form = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const status = document.getElementById('aiChatStatus');
  const sendButton = form?.querySelector('button[type="submit"]');

  function addMessage(content, kind = '') {
    const message = document.createElement('div');
    message.className = 'drawer-chat-message' + (kind ? ' ' + kind : '');
    message.textContent = content;
    log.appendChild(message);
    log.scrollTop = log.scrollHeight;
    return message;
  }

  async function readStream(response, target) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Your browser could not start the AI response stream.');
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';

    const consumeLine = line => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data);
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === 'string' && text) {
          output += text;
          target.textContent = output;
          log.scrollTop = log.scrollHeight;
        }
      } catch {
        // Ignore partial or non-JSON SSE lines.
      }
    };

    while (true) {
      const {value, done} = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), {stream: !done});
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      lines.forEach(consumeLine);
      if (done) break;
    }
    if (buffer) consumeLine(buffer);
    return output.trim();
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || !log || !status || !sendButton) return;

    addMessage(message, 'user');
    chatHistory.push({role: 'user', content: message});
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;
    status.textContent = 'SakuraSound AI is thinking…';

    const assistantBubble = addMessage('…');
    assistantBubble.classList.add('is-pending');

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'},
        body: JSON.stringify({messages: chatHistory.slice(-8)})
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'AI chat is temporarily unavailable. Please try again.');
      }

      assistantBubble.classList.remove('is-pending');
      const answer = await readStream(response, assistantBubble);
      if (!answer) throw new Error('The AI returned an empty reply. Please try again.');
      chatHistory.push({role: 'assistant', content: answer});
      status.textContent = '';
    } catch (error) {
      assistantBubble.classList.remove('is-pending');
      assistantBubble.classList.add('is-error');
      assistantBubble.textContent = error.message || 'AI chat is temporarily unavailable. Please try again.';
      status.textContent = 'For account or technical help, use the customer support link above.';
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  });

  document.querySelectorAll('[data-chat-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.getAttribute('data-chat-prompt') || '';
      form?.requestSubmit();
    });
  });
})();
