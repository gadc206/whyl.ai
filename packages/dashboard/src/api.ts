export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type AccountRole = 'watcher' | 'advertiser';

export interface User {
  id: string;
  email: string;
  name: string;
  referralCode: string;
  role: AccountRole;
  company?: string | null;
  onboardingComplete: boolean;
  permissionsAccepted?: boolean;
  balance?: number;
  lifetimeEarnings?: number;
  referralEarnings?: number;
  pendingEarnings?: number;
  withdrawalBalance?: number;
}

export interface Summary {
  balance: number;
  lifetimeEarnings: number;
  referralEarnings: number;
  pendingEarnings: number;
  withdrawalBalance: number;
  adsWatched: number;
}

export function getToken() {
  return localStorage.getItem('whyl_token');
}

export function setToken(token: string) {
  localStorage.setItem('whyl_token', token);
}

export function clearToken() {
  localStorage.removeItem('whyl_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (body: {
    email: string;
    password: string;
    name: string;
    referralCode?: string;
    role?: AccountRole;
    company?: string;
  }) => request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<User>('/auth/me'),
  completeOnboarding: (body: {
    permissionsAccepted: boolean;
    role?: AccountRole;
    company?: string;
  }) =>
    request<{ success: true; role: AccountRole; company: string | null }>('/auth/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  summary: () => request<Summary>('/earnings/summary'),
  history: () => request<Array<{
    id: string;
    credits: number;
    sourceType: string;
    description: string;
    platform?: string;
    advertiserName?: string;
    title?: string;
    createdAt: string;
  }>>('/earnings/history'),
  withdrawals: () => request<Array<{ id: string; amount: number; status: string; createdAt: string }>>('/earnings/withdrawals'),
  withdraw: (amount: number) =>
    request<{ id: string; amount: number; status: string }>('/earnings/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  referrals: () => request<{
    referralCode: string;
    inviteLink: string;
    totalReferrals: number;
    totalRewards: number;
    referrals: Array<{ name: string; email: string; rewardCredits: number; joinedAt: string }>;
  }>('/referrals'),
  campaigns: () => request<Array<{
    id: string;
    advertiserName: string;
    title: string;
    budget: number;
    viewsTarget: number;
    viewsDelivered: number;
    bidPer1k?: number;
    viewPacks?: number;
    status?: string;
    active: boolean;
    createdAt: string;
  }>>('/advertiser/campaigns'),
  marketplace: () => request<{
    liveBidders: number;
    orderbook: Array<{
      id: string;
      advertiserName: string;
      title: string;
      bidPer1k: number;
      viewPacks: number;
      viewsTarget: number;
      viewsDelivered: number;
      rank: number;
      initial: string;
      impressionsLeft: string;
      serving: boolean;
      isYou: boolean;
      status: string;
    }>;
  }>('/advertiser/marketplace'),
  createCampaign: (body: Record<string, unknown>) =>
    request<{
      id: string;
      bidPer1k: number;
      viewPacks: number;
      budget: number;
      viewsTarget: number;
      status: string;
      rank: number;
    }>('/advertiser/campaigns', { method: 'POST', body: JSON.stringify(body) }),
};
