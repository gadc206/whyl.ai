'use strict';

// Replaced at build time by scripts/build-extension.js when WHYL_API_URL / WHYL_DASHBOARD_URL are set.
const API_BASE = '__WHYL_API_URL__';
const DASHBOARD_URL = '__WHYL_DASHBOARD_URL__';

const AI_HOST_MATCHES = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://claude.ai/*',
  'https://gemini.google.com/*',
  'https://cursor.com/*',
  'https://replit.com/*',
  'https://lovable.dev/*',
  'https://grok.com/*',
  'https://x.com/*',
  'https://manus.im/*',
];

async function apiRequest(path, options = {}) {
  const { token } = await chrome.storage.local.get('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const handlers = {
  getAuth: async () => chrome.storage.local.get(['token', 'user']),

  setAuth: async ({ token, user }) => {
    await chrome.storage.local.set({ token, user: user || null });
    return { success: true };
  },

  clearAuth: async () => {
    await chrome.storage.local.remove(['token', 'user']);
    return { success: true };
  },

  login: async ({ email, password }) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    await chrome.storage.local.set({ token: data.token, user: data.user });
    return data;
  },

  getMe: () => apiRequest('/auth/me'),
  getSummary: () => apiRequest('/earnings/summary'),
  getNextAd: () => apiRequest('/ads/next'),

  startSession: ({ platform, clientSessionId, activationDelayMs }) =>
    apiRequest('/ads/session/start', {
      method: 'POST',
      body: JSON.stringify({ platform, clientSessionId, activationDelayMs }),
    }),

  startView: ({ sessionId, campaignId, platform }) =>
    apiRequest('/ads/view/start', {
      method: 'POST',
      body: JSON.stringify({ sessionId, campaignId, platform }),
    }),

  completeView: ({ viewId, continued, visibleDurationMs }) =>
    apiRequest('/ads/view/complete', {
      method: 'POST',
      body: JSON.stringify({ viewId, continued, visibleDurationMs }),
    }),

  endSession: ({ sessionId }) =>
    apiRequest('/ads/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),

  openDashboard: async ({ path = '/' } = {}) => {
    await chrome.tabs.create({ url: `${DASHBOARD_URL}${path}` });
    return { success: true };
  },

  ping: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      return { ok: res.ok };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  },
};

// Chrome does NOT inject content scripts into tabs that were already open when
// the extension is installed/reloaded. That is why "first try fails, refresh works".
async function injectIntoOpenAiTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: AI_HOST_MATCHES });
  } catch {
    return;
  }

  await Promise.all(tabs.map(async (tab) => {
    if (!tab?.id) return;
    try {
      // MAIN-world probe first so fetch/XHR hooks exist before content.js listens.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ['net-probe.js'],
        world: 'MAIN',
      });
    } catch {
      /* chrome:// or restricted tab */
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ['content.js'],
      });
    } catch {
      /* already injected or restricted */
    }
  }));
}

function warmApi() {
  // Wake Render free-tier cold starts so the first ad session does not hang.
  const url = `${API_BASE}/health`;
  if (!url.startsWith('http')) return;
  fetch(url).catch(() => {});
  setTimeout(() => { fetch(url).catch(() => {}); }, 2500);
}

chrome.runtime.onInstalled.addListener((details) => {
  warmApi();
  injectIntoOpenAiTabs();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/onboard` });
  }
});

chrome.runtime.onStartup.addListener(() => {
  warmApi();
  injectIntoOpenAiTabs();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message.type];
  if (!handler) return false;

  Promise.resolve()
    .then(() => handler(message))
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ error: err?.message || String(err) }));

  return true;
});
