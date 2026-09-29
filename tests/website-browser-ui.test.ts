import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';

test('controller opens a website, follows a page link, and casts an extensionless source without local playback', async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true, writable: true });
  }
  const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { WebsiteBrowser } = await import('../src/components/controller/WebsiteBrowser.tsx');
  const originalFetch = globalThis.fetch;
  const requests: any[] = [];
  const casts: any[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    const film = body.url.endsWith('/film');
    return Response.json({ title: film ? 'Film page' : 'Video website', url: body.url,
      videos: film ? [{ title: 'A selected film', url: 'https://cdn.example.com/play?id=42', kind: 'video' }] : [],
      links: film ? [] : [{ title: 'Open film page', url: 'https://example.com/film' }] });
  };
  try {
    const view = render(React.createElement(WebsiteBrowser, {
      disabled: false, onCast: (...args) => casts.push(args),
      service: { sessionCredentials: () => ({ sessionId: 'room_test', token: 'private_controller_token' }) } as any,
    }));
    fireEvent.change(view.getByRole('textbox', { name: 'Website address' }), { target: { value: 'https://example.com' } });
    fireEvent.click(view.getByRole('button', { name: 'Browse' }));
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Open film page' })));
    fireEvent.click(view.getByRole('button', { name: 'Open film page' }));
    await waitFor(() => assert.ok(view.getByRole('button', { name: /A selected film/ })));
    fireEvent.click(view.getByRole('button', { name: /A selected film/ }));
    assert.deepEqual(casts, [['https://cdn.example.com/play?id=42', 'video']]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].token, 'private_controller_token');
    assert.equal(requests[1].url, 'https://example.com/film');
    assert.equal(view.container.querySelectorAll('video,iframe').length, 0);
    assert.match(view.getByRole('status').textContent!, /Sent to your connected screen/);
    fireEvent.click(view.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Open film page' })));
    fireEvent.click(view.getByRole('button', { name: 'Next page' }));
    await waitFor(() => assert.ok(view.getByRole('button', { name: /A selected film/ })));
  } finally {
    globalThis.fetch = originalFetch;
    cleanup(); dom.window.close();
  }
});

test('receiver routes remote playback and seek commands through the YouTube SDK and publishes actual state', async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true, writable: true });
  }
  const { render, waitFor, cleanup } = await import('@testing-library/react');
  const { EventEmitter } = await import('node:events');
  const socket = new EventEmitter();
  let destroyed = false;
  class TestPlayer {
    status = 2; time = 0; volume = 80; muted = false;
    constructor(mount: HTMLElement, public options: any) {
      mount.replaceWith(dom.window.document.createElement('iframe'));
      queueMicrotask(() => options.events.onReady());
    }
    getPlayerState() { return this.status; }
    getCurrentTime() { return this.time; }
    getDuration() { return 120; }
    getVolume() { return this.volume; }
    isMuted() { return this.muted; }
    getVideoData() { return { title: 'Provider video' }; }
    playVideo() { this.status = 1; this.options.events.onStateChange(); }
    pauseVideo() { this.status = 2; this.options.events.onStateChange(); }
    seekTo(time: number) { this.time = time; }
    setVolume(value: number) { this.volume = value; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    loadVideoById() { this.time = 0; }
    destroy() { destroyed = true; }
  }
  (dom.window as any).YT = { Player: TestPlayer };
  const { EmbeddedPlayer } = await import('../src/components/receiver/EmbeddedPlayer.tsx');
  const states: any[] = [];
  try {
    const view = render(React.createElement(EmbeddedPlayer, {
      source: { provider: 'youtube', id: 'M7lc1UVf-VE', url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE' },
      sessionId: 'room_test', service: { getSocket: () => socket } as any,
      onState: (state) => states.push(state),
    }));
    await waitFor(() => assert.ok(states.some((state) => state.duration === 120)));
    socket.emit('execute_command', { type: 'command', action: 'PLAY', timestamp: Date.now() });
    await waitFor(() => assert.equal(states.at(-1).playing, true));
    socket.emit('execute_command', { type: 'command', action: 'SEEK', value: 42, timestamp: Date.now() });
    await waitFor(() => assert.equal(states.at(-1).currentTime, 42));
    socket.emit('execute_command', { type: 'command', action: 'PAUSE', timestamp: Date.now() });
    await waitFor(() => assert.equal(states.at(-1).playing, false));
    assert.ok(view.container.querySelector('iframe'));
    view.unmount();
    assert.equal(destroyed, true);
    assert.equal(socket.listenerCount('execute_command'), 0);
  } finally { cleanup(); dom.window.close(); }
});
