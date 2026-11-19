const token = document.getElementById('token');
const site = document.getElementById('site');
const status = document.getElementById('status');

// The personal token goes to this address, so only HTTPS (or a local dev server) and only its origin is used.
function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:' || (local && url.protocol === 'http:')) return url.origin;
  } catch {
    // Not a URL at all.
  }
  return null;
}

chrome.storage.sync.get({ token: '', site: 'https://seedup.rerereally.com' }).then((saved) => {
  token.value = saved.token;
  site.value = saved.site;
});

document.getElementById('save').addEventListener('click', async () => {
  const value = token.value.trim();
  if (value && !/^sdp_[a-f0-9]{48}$/i.test(value)) {
    status.textContent = '토큰 모양이 다릅니다. sdp_로 시작하는 토큰을 그대로 붙여 넣으세요.';
    return;
  }
  const origin = normalizeSiteUrl(site.value.trim() || 'https://seedup.rerereally.com');
  if (!origin) {
    status.textContent = 'Seedup 주소는 https://로 시작해야 합니다. (로컬 개발은 http://localhost만 됩니다)';
    return;
  }
  site.value = origin;
  await chrome.storage.sync.set({ token: value, site: origin });
  status.textContent = '저장했습니다.';
});
