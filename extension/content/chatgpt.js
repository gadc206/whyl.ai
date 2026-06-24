(function () {
  let isThinking = false;
  let debounceTimer = null;
  let tickTimer = null;
  let sessionCredits = 0;

  let panelHost = null;
  let shadow = null;

  function isThinkingNow() {
    // ChatGPT shows a "Stop generating" / "Stop streaming" control while it is responding.
    return Boolean(
      document.querySelector('button[data-testid="stop-button"]') ||
      document.querySelector('button[aria-label="Stop streaming"]') ||
      document.querySelector('button[aria-label="Stop generating"]')
    );
  }

  function setThinking(next) {
    if (next === isThinking) return;
    isThinking = next;
    if (isThinking) {
      onThinkingStart();
    } else {
      onThinkingEnd();
    }
  }

  function onThinkingStart() {
    sessionCredits = 0;
    chrome.runtime.sendMessage({ type: 'THINKING_START' }, (response) => {
      showPanel(response?.ad);
    });
    tickTimer = setInterval(() => {
      sessionCredits += 1;
      chrome.runtime.sendMessage({ type: 'SESSION_CREDIT_TICK', amount: 1 }, (res) => {
        updatePanelCredits(sessionCredits, res?.balance);
      });
    }, 1000);
  }

  function onThinkingEnd() {
    clearInterval(tickTimer);
    chrome.runtime.sendMessage({ type: 'THINKING_END' });
    hidePanel();
  }

  function showPanel(ad) {
    if (panelHost) return;
    panelHost = document.createElement('div');
    panelHost.id = 'whyl-panel-host';
    document.body.appendChild(panelHost);
    shadow = panelHost.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/panel.css');
    shadow.appendChild(link);

    const panel = document.createElement('div');
    panel.className = 'whyl-panel';
    panel.innerHTML = `
      <div class="whyl-header">Sponsored</div>
      <div class="whyl-ad">
        <p class="whyl-ad-message">${ad?.message ?? ''}</p>
        <p class="whyl-ad-by">Sponsored by ${ad?.advertiser ?? ''} · ${ad?.url ?? ''}</p>
      </div>
      <div class="whyl-earnings">
        <span class="whyl-session">+<span id="whyl-session-count">0</span> Credits</span>
        <span class="whyl-balance">Total Balance: <span id="whyl-balance-count">0</span></span>
      </div>
    `;
    shadow.appendChild(panel);
  }

  function updatePanelCredits(session, balance) {
    if (!shadow) return;
    const sessionEl = shadow.getElementById('whyl-session-count');
    const balanceEl = shadow.getElementById('whyl-balance-count');
    if (sessionEl) sessionEl.textContent = session;
    if (balanceEl && balance != null) balanceEl.textContent = balance;
  }

  function hidePanel() {
    if (panelHost) {
      panelHost.remove();
      panelHost = null;
      shadow = null;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setThinking(isThinkingNow());
    }, 150);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
