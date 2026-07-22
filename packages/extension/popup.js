const app = document.getElementById('app');

function sendMessage(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...data }, (response) => {
      resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : response || {});
    });
  });
}

function renderLogin(error = '') {
  app.innerHTML = `
    <h1>WHYL</h1>
    <p>Sign in to earn credits while AI thinks.</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form id="login-form">
      <label>Email</label>
      <input id="email" type="email" required />
      <label>Password</label>
      <input id="password" type="password" required />
      <button class="primary" type="submit">Sign In</button>
    </form>
    <button class="secondary" id="onboard">Create Account</button>
  `;

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const result = await sendMessage('login', { email, password });
    if (result.error) {
      renderLogin(result.error.includes('fetch') ? 'Cannot reach WHYL API. Run npm run dev.' : result.error);
      return;
    }
    render();
  });

  document.getElementById('onboard').addEventListener('click', () => {
    sendMessage('openDashboard', { path: '/onboard' });
  });
}

function renderDashboard(summary) {
  app.innerHTML = `
    <h1>Account Summary</h1>
    <p>WHYL is active on supported AI sites.</p>
    <div class="grid">
      <div class="stat"><strong>${summary.balance ?? 0}</strong><span>Credits Balance</span></div>
      <div class="stat"><strong>${summary.lifetimeEarnings ?? 0}</strong><span>Lifetime Earnings</span></div>
      <div class="stat"><strong>${summary.referralEarnings ?? 0}</strong><span>Referral Earnings</span></div>
      <div class="stat"><strong>${summary.pendingEarnings ?? 0}</strong><span>Pending Earnings</span></div>
    </div>
    <p class="privacy-link"><a href="https://gadc206.github.io/whyl.ai/privacy/" target="_blank" rel="noopener">Privacy policy</a></p>
    <button class="primary" data-path="/earnings">Withdraw</button>
    <button class="secondary" data-path="/referrals">Invite Friends</button>
    <button class="secondary" data-path="/">Open Dashboard</button>
    <button class="secondary" data-path="/history">View History</button>
    <button class="secondary" id="logout">Log Out</button>
  `;

  app.querySelectorAll('[data-path]').forEach((button) => {
    button.addEventListener('click', () => sendMessage('openDashboard', { path: button.dataset.path }));
  });

  document.getElementById('logout').addEventListener('click', async () => {
    await sendMessage('clearAuth');
    renderLogin();
  });
}

async function render() {
  const auth = await sendMessage('getAuth');
  if (!auth.token) {
    renderLogin();
    return;
  }

  const summary = await sendMessage('getSummary');
  if (summary.error) {
    renderLogin('Cannot reach WHYL API. Run npm run dev.');
    return;
  }

  renderDashboard(summary);
}

render();
