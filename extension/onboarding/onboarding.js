document.getElementById('onboardForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  await chrome.storage.local.set({
    whylAccount: { name, email, createdAt: Date.now() },
    whylBalance: 0,
  });

  document.getElementById('onboardForm').hidden = true;
  document.getElementById('onboardDone').hidden = false;
});
