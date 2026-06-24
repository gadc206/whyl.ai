async function loadBalance() {
  const { balance } = await chrome.runtime.sendMessage({ type: 'GET_BALANCE' });
  document.getElementById('balanceValue').textContent = balance ?? 0;
}

loadBalance();

// Dashboard/withdraw/history pages don't exist on whyl.ai yet —
// pointing at the waitlist page as a placeholder until they're built.
const WEBSITE_URL = 'https://whyl.ai';

document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: WEBSITE_URL });
});
document.getElementById('withdrawBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: WEBSITE_URL });
});
document.getElementById('historyBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: WEBSITE_URL });
});
document.getElementById('inviteBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: `${WEBSITE_URL}#waitlist` });
});
