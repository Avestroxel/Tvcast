const HOME_URL = 'https://www.google.com/';
const VERSION = chrome.runtime.getManifest().version;
let stateTimer = null;
let stateBusy = false;

const sessionGet = async (key) => (await chrome.storage.session.get(key))[key];
const sessionSet = async (values) => chrome.storage.session.set(values);
const localGet = async (key) => (await chrome.storage.local.get(key))[key];

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

async function receiverTabId() {
  return await sessionGet('receiverTabId');
}
async function targetTab() {
  const id = await sessionGet('targetTabId');
  if (typeof id !== 'number') return null;
  try { return await chrome.tabs.get(id); } catch { return null; }
}
async function rememberReceiver(tabId) {
  if (typeof tabId === 'number') await sessionSet({ receiverTabId: tabId });
}
async function authorizedReceiver(sender) {
  const receiverOrigin = await localGet('receiverOrigin');
  if (!receiverOrigin || !sender?.url || typeof sender.tab?.id !== 'number') return false;
  try { return new URL(sender.url).origin === receiverOrigin; } catch { return false; }
}
async function ensureTarget(url = HOME_URL) {
  let tab = await targetTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url, active: true });
    await sessionSet({ targetTabId: tab.id });
  } else {
    tab = await chrome.tabs.update(tab.id, { url, active: true });
    if (typeof tab.windowId === 'number') await chrome.windows.update(tab.windowId, { focused: true });
  }
  return tab;
}
async function notifyReceiver(message) {
  const id = await receiverTabId();
  if (typeof id !== 'number') return;
  try { await chrome.tabs.sendMessage(id, message); } catch {}
}
async function run(tabId, func, args = [], frameIds) {
  return chrome.scripting.executeScript({
    target: frameIds ? { tabId, frameIds } : { tabId },
    func,
    args,
  });
}
async function runAllFrames(tabId, func, args = []) {
  return chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args });
}

function pageSummary() {
  const media = [...document.querySelectorAll('video,audio')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 80 && rect.height > 45 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .sort((a, b) => {
      const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0];
  const rect = media?.getBoundingClientRect();
  return {
    focused: document.hasFocus(),
    historyLength: history.length,
    media: media ? {
      area: Math.max(0, (rect?.width || 0) * (rect?.height || 0)),
      playing: !media.paused && !media.ended,
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      duration: Number.isFinite(media.duration) ? media.duration : 0,
      volume: Number.isFinite(media.volume) ? media.volume : 1,
      muted: !!media.muted,
    } : null,
  };
}

async function readState(options = {}) {
  if (stateBusy) return null;
  stateBusy = true;
  try {
    const tab = await targetTab();
    if (!tab?.id) return {
      connected: true, extensionVersion: VERSION, url: '', title: '', loading: false,
      fullscreen: false, media: null, error: null, timestamp: Date.now(),
    };
    let frames = [];
    try { frames = await runAllFrames(tab.id, pageSummary); } catch {}
    const summaries = frames.map((result) => result.result).filter(Boolean);
    const media = summaries.map((item) => item.media).filter(Boolean).sort((a, b) => b.area - a.area)[0] || null;
    let screenshot;
    if (options.screenshot !== false && tab.active && typeof tab.windowId === 'number') {
      try { screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 36 }); } catch {}
    }
    let fullscreen = false;
    if (typeof tab.windowId === 'number') {
      try { fullscreen = (await chrome.windows.get(tab.windowId)).state === 'fullscreen'; } catch {}
    }
    return {
      connected: true,
      extensionVersion: VERSION,
      url: safeUrl(tab.url || '') || '',
      title: tab.title || '',
      screenshot,
      loading: tab.status === 'loading',
      fullscreen,
      canGoBack: summaries.some((item) => item.historyLength > 1),
      canGoForward: false,
      media: media ? { playing: media.playing, currentTime: media.currentTime, duration: media.duration, volume: media.volume, muted: media.muted } : null,
      error: null,
      timestamp: Date.now(),
    };
  } finally { stateBusy = false; }
}

async function publishState(options = {}) {
  const state = await readState(options);
  if (state) await notifyReceiver({ type: 'CASTSYNC_STATE', state });
  return state;
}
function scheduleState(delayMs = 500) {
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = setTimeout(() => { stateTimer = null; void publishState(); }, delayMs);
}

function mediaCandidate() {
  const media = [...document.querySelectorAll('video,audio')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 80 && rect.height > 45;
    })
    .sort((a, b) => {
      const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0];
  const rect = media?.getBoundingClientRect();
  return media ? { area: (rect?.width || 0) * (rect?.height || 0) } : null;
}
async function bestMediaFrame(tabId) {
  try {
    const results = await runAllFrames(tabId, mediaCandidate);
    return results.filter((item) => item.result).sort((a, b) => b.result.area - a.result.area)[0]?.frameId;
  } catch { return undefined; }
}
function controlMedia(action, value) {
  const media = [...document.querySelectorAll('video,audio')]
    .filter((node) => node.getBoundingClientRect().width > 80)
    .sort((a, b) => {
      const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0];
  if (!media) return false;
  if (action === 'PLAY') void media.play();
  if (action === 'PAUSE') media.pause();
  if (action === 'TOGGLE_PLAYBACK') media.paused ? void media.play() : media.pause();
  if (action === 'SEEK') media.currentTime = Math.max(0, Math.min(media.duration || value, value));
  if (action === 'SEEK_FORWARD') media.currentTime = Math.min(media.duration || media.currentTime + value, media.currentTime + value);
  if (action === 'SEEK_BACKWARD') media.currentTime = Math.max(0, media.currentTime - value);
  if (action === 'SET_VOLUME') { media.volume = value; media.muted = false; }
  if (action === 'VOLUME_UP') { media.volume = Math.min(1, media.volume + .1); media.muted = false; }
  if (action === 'VOLUME_DOWN') media.volume = Math.max(0, media.volume - .1);
  if (action === 'MUTE') media.muted = true;
  if (action === 'UNMUTE') media.muted = false;
  return true;
}

function navigateFocus(direction) {
  if (direction === 'up' || direction === 'down') {
    window.scrollBy({ top: direction === 'up' ? -Math.round(innerHeight * .65) : Math.round(innerHeight * .65), behavior: 'smooth' });
  }
  const items = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter((el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= innerHeight && s.visibility !== 'hidden' && s.display !== 'none';
    });
  if (!items.length) return false;
  let index = Number(document.documentElement.dataset.castsyncFocus || -1);
  if (['right','down'].includes(direction)) index = (index + 1) % items.length;
  else if (['left','up'].includes(direction)) index = (index - 1 + items.length) % items.length;
  else if (['ok','enter'].includes(direction)) { const current = items[Math.max(0, index)]; current?.click(); return true; }
  else if (direction === 'escape') { document.activeElement?.blur?.(); return true; }
  else return false;
  document.documentElement.dataset.castsyncFocus = String(index);
  document.querySelector('[data-castsync-selected]')?.removeAttribute('data-castsync-selected');
  const target = items[index];
  target.setAttribute('data-castsync-selected', 'true');
  target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  let style = document.getElementById('castsync-focus-style');
  if (!style) { style = document.createElement('style'); style.id = 'castsync-focus-style'; style.textContent = '[data-castsync-selected]{outline:3px solid #8b7cff!important;outline-offset:4px!important}'; document.documentElement.append(style); }
  return true;
}
function clickPoint(x, y) {
  const element = document.elementFromPoint(innerWidth * x, innerHeight * y);
  if (!element) return { clicked: false };
  if (element instanceof HTMLIFrameElement) {
    const rect = element.getBoundingClientRect();
    return { clicked: false, frame: element.src, x: (innerWidth * x - rect.left) / rect.width, y: (innerHeight * y - rect.top) / rect.height };
  }
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: innerWidth * x, clientY: innerHeight * y }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: innerWidth * x, clientY: innerHeight * y }));
  element.focus?.();
  return { clicked: true };
}
function typeIntoFocus(text) {
  if (!document.hasFocus()) return false;
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length; const end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, 'end');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }
  if (el?.isContentEditable) { document.execCommand('insertText', false, text); return true; }
  return false;
}
function fullscreenPage(enable) {
  const id = 'castsync-browser-fullscreen-style';
  document.getElementById(id)?.remove();
  for (const item of document.querySelectorAll('[data-castsync-media-fullscreen]')) {
    item.removeAttribute('data-castsync-media-fullscreen');
  }
  if (!enable) { document.documentElement.style.removeProperty('overflow'); document.body.style.removeProperty('overflow'); return false; }
  const candidates = [...document.querySelectorAll('video,iframe,embed')].filter((el) => {
    const r = el.getBoundingClientRect(); return r.width > 160 && r.height > 90;
  }).sort((a, b) => {
    const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect();
    return br.width * br.height - ar.width * ar.height;
  });
  const target = candidates[0];
  if (!target) return false;
  target.setAttribute('data-castsync-media-fullscreen', 'true');
  const style = document.createElement('style'); style.id = id;
  style.textContent = '[data-castsync-media-fullscreen]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483647!important;background:#000!important;object-fit:contain!important}html,body{overflow:hidden!important;background:#000!important}';
  document.documentElement.append(style); return true;
}

async function pointerCommand(tab, point) {
  const top = (await run(tab.id, clickPoint, [point.x, point.y]))[0]?.result;
  if (!top?.frame) return;
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
    const wanted = new URL(top.frame);
    const frame = frames.find((item) => {
      try { const url = new URL(item.url); return url.href === wanted.href || url.hostname === wanted.hostname; } catch { return false; }
    });
    if (frame) await run(tab.id, clickPoint, [Math.max(0, Math.min(1, top.x)), Math.max(0, Math.min(1, top.y))], [frame.frameId]);
  } catch {}
}

async function handleCommand(command) {
  const action = command?.action;
  if (action === 'OPEN_URL') {
    const url = safeUrl(command.url);
    if (!url) throw new Error('Only normal HTTP and HTTPS pages can be opened.');
    await ensureTarget(url); scheduleState(900); return;
  }
  if (action === 'NEW_TAB') { const tab = await chrome.tabs.create({ url: HOME_URL, active: true }); await sessionSet({ targetTabId: tab.id }); scheduleState(700); return; }
  let tab = await targetTab();
  if (!tab?.id) tab = await ensureTarget();
  if (action === 'BACK') { try { await chrome.tabs.goBack(tab.id); } catch {} }
  else if (action === 'FORWARD') { try { await chrome.tabs.goForward(tab.id); } catch {} }
  else if (action === 'REFRESH') await chrome.tabs.reload(tab.id);
  else if (action === 'HOME') await chrome.tabs.update(tab.id, { url: HOME_URL, active: true });
  else if (action === 'CLOSE_TAB') { await chrome.tabs.remove(tab.id); await chrome.storage.session.remove('targetTabId'); }
  else if (action === 'POINTER') await pointerCommand(tab, command.value);
  else if (action === 'TYPE_TEXT') await runAllFrames(tab.id, typeIntoFocus, [command.value]);
  else if (action === 'NAVIGATE') await run(tab.id, navigateFocus, [command.direction]);
  else if (['PLAY','PAUSE','TOGGLE_PLAYBACK','SEEK','SEEK_FORWARD','SEEK_BACKWARD','SET_VOLUME','VOLUME_UP','VOLUME_DOWN','MUTE','UNMUTE'].includes(action)) {
    const frameId = await bestMediaFrame(tab.id);
    if (typeof frameId === 'number') await run(tab.id, controlMedia, [action, command.value], [frameId]);
  }
  else if (action === 'FULLSCREEN') {
    const win = await chrome.windows.get(tab.windowId);
    await sessionSet({ previousWindowState: win.state === 'fullscreen' ? 'maximized' : win.state });
    await run(tab.id, fullscreenPage, [true]);
    await chrome.windows.update(tab.windowId, { state: 'fullscreen', focused: true });
  }
  else if (action === 'EXIT_FULLSCREEN') {
    await run(tab.id, fullscreenPage, [false]);
    const previous = await sessionGet('previousWindowState');
    await chrome.windows.update(tab.windowId, { state: ['normal','maximized'].includes(previous) ? previous : 'maximized', focused: true });
  }
  await chrome.tabs.update(tab.id, { active: true });
  scheduleState(action === 'TYPE_TEXT' ? 250 : 550);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!['CASTSYNC_PING', 'CASTSYNC_SNAPSHOT', 'CASTSYNC_COMMAND'].includes(message?.type)) return;
  void (async () => {
    if (!(await authorizedReceiver(sender))) throw new Error('Open the Browser Bridge icon on the CastSync tab and connect this site first.');
    await rememberReceiver(sender.tab?.id);
    if (message.type === 'CASTSYNC_COMMAND') await handleCommand(message.command);
    const state = await readState({ screenshot: message.type !== 'CASTSYNC_PING' });
    sendResponse({ ok: true, state });
  })().catch(async (error) => {
    const text = error instanceof Error ? error.message : String(error);
    await notifyReceiver({ type: 'CASTSYNC_ERROR', error: text });
    sendResponse({ ok: false, error: text });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  void targetTab().then((tab) => {
    if (tab?.id !== tabId) return;
    if (changeInfo.status === 'loading') void publishState({ screenshot: false });
    if (changeInfo.status === 'complete') scheduleState(650);
  });
});
chrome.tabs.onCreated.addListener((tab) => {
  void targetTab().then(async (target) => {
    if (target?.id && tab.openerTabId === target.id && tab.id) { await sessionSet({ targetTabId: tab.id }); scheduleState(700); }
  });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void sessionGet('targetTabId').then(async (targetId) => {
    if (targetId === tabId) { await chrome.storage.session.remove('targetTabId'); await publishState({ screenshot: false }); }
  });
});
