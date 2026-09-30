(async () => {
  if (!document.querySelector('meta[name="castsync-browser-bridge"]')) return;
  const { receiverOrigin } = await chrome.storage.local.get('receiverOrigin');
  if (receiverOrigin !== location.origin) return;
  const PAGE_SOURCE = 'castsync-page';
  const EXT_SOURCE = 'castsync-extension';

  const post = (type, payload = {}) => {
    window.postMessage({ source: EXT_SOURCE, type, ...payload }, location.origin);
  };

  const send = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          post('ERROR', { error: chrome.runtime.lastError.message });
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (error) {
      post('ERROR', { error: error instanceof Error ? error.message : String(error) });
      resolve(null);
    }
  });

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== PAGE_SOURCE) return;
    if (event.data.type === 'PING' || event.data.type === 'SNAPSHOT') {
      const response = await send({ type: event.data.type === 'PING' ? 'CASTSYNC_PING' : 'CASTSYNC_SNAPSHOT' });
      if (response?.state) post('STATE', { state: response.state });
      if (event.data.type === 'PING') post('READY', { version: chrome.runtime.getManifest().version });
    }
    if (event.data.type === 'COMMAND' && event.data.command) {
      const response = await send({ type: 'CASTSYNC_COMMAND', command: event.data.command });
      if (response?.state) post('STATE', { state: response.state });
      if (response?.error) post('ERROR', { error: response.error });
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'CASTSYNC_STATE') post('STATE', { state: message.state });
    if (message?.type === 'CASTSYNC_ERROR') post('ERROR', { error: message.error });
  });

  void send({ type: 'CASTSYNC_PING' }).then((response) => {
    post('READY', { version: chrome.runtime.getManifest().version });
    if (response?.state) post('STATE', { state: response.state });
  });
})();
