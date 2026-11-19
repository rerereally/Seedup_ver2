// Right-click a selected sentence and send it to Seedup with your personal token. Seedup keeps it only when the
// sentence appears in the post word for word; nothing is posted anywhere else.
const MENU_ID = 'seedup-save-quote';

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: 'Seedup에 원문으로 담기', contexts: ['selection'] });
});

function notify(message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: 'Seedup', message });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const { token, site } = await chrome.storage.sync.get({ token: '', site: 'https://seedup.rerereally.com' });
  if (!token) {
    notify('먼저 확장 설정에 Seedup 토큰을 넣어 주세요. (Seedup의 MCP 연동 화면에서 확인)');
    chrome.runtime.openOptionsPage();
    return;
  }
  const origin = normalizeSiteUrl(site);
  if (!origin) {
    notify('확장 설정의 Seedup 주소가 https가 아니라서 토큰을 보내지 않았습니다. 주소를 고쳐 주세요.');
    chrome.runtime.openOptionsPage();
    return;
  }
  try {
    const response = await fetch(`${origin}/api/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: info.pageUrl, quote: info.selectionText ?? '', title: tab?.title ?? '' }),
    });
    const json = await response.json().catch(() => ({}));
    notify(response.ok ? '원문과 대조해 담았습니다. PRD 작업 공간의 근거 패널에서 고를 수 있습니다.' : json.error ?? '담지 못했습니다.');
  } catch {
    notify('Seedup에 연결하지 못했습니다.');
  }
});
