'use strict';

const API_BASE = 'http://localhost:3001/api';
const DASHBOARD_URL = 'http://localhost:5173';

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
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/onboard` });
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
