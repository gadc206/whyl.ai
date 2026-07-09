(function () {
  const TOKEN_KEY = 'whyl_token';

  function syncToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) chrome.runtime.sendMessage({ type: 'setAuth', token, user: null });
  }

  syncToken();

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) syncToken();
  });

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function setItem(key, value) {
    originalSetItem(key, value);
    if (key === TOKEN_KEY) syncToken();
  };
})();
