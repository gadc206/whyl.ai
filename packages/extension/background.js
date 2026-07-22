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

const AI_HOST_RE = /(^|\.)(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|cursor\.com|replit\.com|lovable\.dev|grok\.com|x\.com|manus\.im)$/i;
const API_TIMEOUT_MS = 8000;

function isAiTabUrl(url) {
  if (!url || !/^https?:/i.test(url)) return false;
  try {
    return AI_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function apiRequest(path, options = {}) {
  const { token } = await chrome.storage.local.get('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err?.name === 'AbortError' ? 'Request timed out' : (err?.message || String(err));
    throw new Error(msg);
  }
  clearTimeout(timer);

  let data = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new Error(err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Login failed'));
    }
    clearTimeout(timer);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      return { ok: res.ok };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    } finally {
      clearTimeout(timer);
    }
  },
};

async function contentAlive(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'whylContentPing' });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

async function injectTab(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['net-probe.js'],
      world: 'MAIN',
    });
  } catch {
    /* restricted / already failed */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['content.js'],
    });
  } catch {
    /* restricted */
  }
}

// Chrome does NOT inject content scripts into tabs that were already open when
// the extension is installed/reloaded. Ping first; inject only if missing.
async function ensureTabInjected(tabId, url) {
  if (!tabId || (url && !isAiTabUrl(url))) return;
  if (await contentAlive(tabId)) return;
  await injectTab(tabId);
}

async function injectIntoOpenAiTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: AI_HOST_MATCHES });
  } catch {
    return;
  }
  await Promise.all(tabs.map((tab) => ensureTabInjected(tab.id, tab.url)));
}

function warmFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  fetch(url, { signal: controller.signal })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

function warmApi() {
  const url = `${API_BASE}/health`;
  if (!url.startsWith('http')) return;
  warmFetch(url);
  setTimeout(() => warmFetch(url), 2500);
}

function ensureKeepaliveAlarm() {
  try {
    chrome.alarms.create('whyl-keepalive', { periodInMinutes: 4 });
  } catch {
    /* alarms unavailable */
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  warmApi();
  ensureKeepaliveAlarm();
  injectIntoOpenAiTabs();
  // Retry — some tabs are still restoring when onInstalled fires.
  setTimeout(injectIntoOpenAiTabs, 1500);
  setTimeout(injectIntoOpenAiTabs, 4000);
  if (details.reason === 'install') {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/onboard` });
  }
});

chrome.runtime.onStartup.addListener(() => {
  warmApi();
  ensureKeepaliveAlarm();
  injectIntoOpenAiTabs();
  setTimeout(injectIntoOpenAiTabs, 2000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'whyl-keepalive') return;
  warmApi();
});

// Inject as early as possible on AI navigations so net-probe catches the first stream.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab?.url || '';
  if (!isAiTabUrl(url)) return;
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    ensureTabInjected(tabId, url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isAiTabUrl(tab?.url || '')) return;
    await ensureTabInjected(tabId, tab.url);
  } catch {
    /* tab gone */
  }
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

// Wake + inject as soon as the service worker starts (covers "open Chrome twice").
warmApi();
ensureKeepaliveAlarm();
injectIntoOpenAiTabs();
