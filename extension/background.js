// Opens onboarding on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

// Placeholder ad until a real ad-serving API exists
const PLACEHOLDER_AD = {
  advertiser: 'Notion',
  url: 'notion.so',
  message: 'Organize your AI workflow with Notion.',
};

const CREDITS_PER_SECOND = 1;

let tickInterval = null;

async function getBalance() {
  const { whylBalance } = await chrome.storage.local.get('whylBalance');
  return whylBalance ?? 0;
}

async function setBalance(value) {
  await chrome.storage.local.set({ whylBalance: value });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'THINKING_START') {
    handleThinkingStart(sender.tab?.id);
    sendResponse({ ad: PLACEHOLDER_AD });
  }
  if (message.type === 'THINKING_END') {
    handleThinkingEnd();
  }
  if (message.type === 'GET_BALANCE') {
    getBalance().then((balance) => sendResponse({ balance }));
    return true;
  }
  if (message.type === 'SESSION_CREDIT_TICK') {
    addCredits(message.amount).then((balance) => sendResponse({ balance }));
    return true;
  }
});

async function addCredits(amount) {
  const balance = await getBalance();
  const next = balance + amount;
  await setBalance(next);
  return next;
}

function handleThinkingStart(tabId) {
  // session tracking hook point for future real backend call
}

function handleThinkingEnd() {
  // session-end hook point for future real backend call
}
