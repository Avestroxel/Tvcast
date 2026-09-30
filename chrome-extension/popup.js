const status = document.getElementById('status');
const site = document.getElementById('site');
const connect = document.getElementById('connect');

async function currentCastSyncTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(document.querySelector('meta[name="castsync-browser-bridge"]')),
    });
    return result?.result ? { tab, origin: new URL(tab.url).origin } : null;
  } catch {
    return null;
  }
}

void (async () => {
  const candidate = await currentCastSyncTab();
  if (!candidate) {
    status.textContent = 'Open the CastSync receiver page in this tab, then open this extension again.';
    status.className = 'warn';
    site.textContent = 'No CastSync page detected';
    return;
  }

  site.textContent = candidate.origin;
  site.title = candidate.origin;
  const { receiverOrigin } = await chrome.storage.local.get('receiverOrigin');
  if (receiverOrigin === candidate.origin) {
    status.textContent = 'This CastSync site is connected.';
    status.className = 'ok';
    connect.textContent = 'Reconnect This CastSync';
  } else {
    status.textContent = 'Approve this CastSync site to control browser tabs.';
    status.className = '';
  }
  connect.disabled = false;
  connect.addEventListener('click', async () => {
    connect.disabled = true;
    await chrome.storage.local.set({ receiverOrigin: candidate.origin });
    status.textContent = 'Connected. Refreshing CastSync…';
    status.className = 'ok';
    await chrome.tabs.reload(candidate.tab.id);
    window.setTimeout(() => window.close(), 300);
  });
})().catch(() => {
  status.textContent = 'Could not inspect this tab. Open CastSync and try again.';
  status.className = 'warn';
});
