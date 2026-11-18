const token = document.getElementById('token');
const site = document.getElementById('site');
const status = document.getElementById('status');

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
  await chrome.storage.sync.set({ token: value, site: site.value.trim() || 'https://seedup.rerereally.com' });
  status.textContent = '저장했습니다.';
});
