import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { io, type Socket } from 'socket.io-client';

let server: ChildProcess;
let origin: string;
const sockets: Socket[] = [];
const device = { id: 'test-device', name: 'Test device', type: 'desktop' };
async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}
async function start(production = false) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, production ? ['build/server.js', '--production'] : ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', DISABLE_HMR: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout!.on('data', (chunk) => { output += chunk; });
  child.stderr!.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      if ((await fetch(`${url}/api/health`)).ok) return { child, url };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`Server failed to start: ${output}`);
}
async function connect(transports = ['websocket']) {
  const socket = io(origin, { transports, reconnection: false, forceNew: true });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
function ack(socket: Socket, event: string, data: unknown): Promise<any> {
  return new Promise((resolve, reject) => socket.timeout(2000).emit(event, data,
    (error: Error | null, result: unknown) => error ? reject(error) : resolve(result)));
}
function event(socket: Socket, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing ${name}`)), 2000);
    socket.once(name, (value) => { clearTimeout(timer); resolve(value); });
  });
}
before(async () => { const started = await start(); server = started.child; origin = started.url; });
after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  if (server?.exitCode === null) { server.kill(); await once(server, 'exit'); }
});
test('Vite HMR uses the application HTTP port and accepts a real WebSocket', async () => {
  const client = await (await fetch(`${origin}/@vite/client`)).text();
  const token = client.match(/const wsToken = "([^"]+)"/)?.[1];
  assert.ok(token, 'Vite client must contain its WebSocket token');
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/?token=${token}`, 'vite-hmr');
  try {
    const message = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HMR connection timed out')), 3000);
      ws.onmessage = (msg) => { clearTimeout(timer); resolve(String(msg.data)); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('HMR connection failed')); };
    });
    assert.equal(JSON.parse(message).type, 'connected');
  } finally { ws.close(); }
});

test('pairing by code, command delivery, state sync, isolation, and role-safe resume', async () => {
  const receiver = await connect();
  const controller = await connect(['polling', 'websocket']);
  const stranger = await connect();
  const created = await ack(receiver, 'create_session', { receiverInfo: device });
  assert.equal(created.success, true);
  const sessionId = created.session.sessionId;
  const joined = await ack(controller, 'join_by_code', { code: created.session.pairingCode, controllerInfo: device });
  assert.equal(joined.success, true);
  assert.equal((await ack(stranger, 'join_by_id', { sessionId, controllerInfo: device })).success, false);
  assert.equal((await ack(stranger, 'resume_session', { sessionId, role: 'receiver', token: joined.resumeToken })).success, false);

  const delivered = event(receiver, 'execute_command');
  const command = { type: 'command', action: 'PLAY', timestamp: Date.now() };
  controller.emit('send_command', { sessionId, command });
  assert.deepEqual(await delivered, command);
  const state = { playing: true, currentTime: 15, duration: 100 };
  const synchronized = event(controller, 'playback_state_updated');
  receiver.emit('playback_state_update', { sessionId, state });
  assert.deepEqual(await synchronized, state);
  const rejected = event(controller, 'command_error');
  controller.emit('send_command', { sessionId, command: { ...command, action: 'OPEN_URL', url: 'javascript:alert(1)' } });
  assert.match((await rejected).message, /http/);

  let leaked = false;
  const detectLeak = () => { leaked = true; };
  receiver.on('execute_command', detectLeak);
  stranger.emit('send_command', { sessionId, command });
  stranger.emit('leave_session', { sessionId, role: 'receiver' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  receiver.off('execute_command', detectLeak);
  assert.equal(leaked, false);
  assert.equal((await fetch(`${origin}/api/session/${sessionId}`)).status, 200);

  controller.disconnect();
  const resumedController = await connect();
  assert.equal((await ack(resumedController, 'resume_session', { sessionId, role: 'controller', token: joined.resumeToken })).success, true);
  receiver.disconnect();
  const resumedReceiver = await connect();
  assert.equal((await ack(resumedReceiver, 'resume_session', { sessionId, role: 'receiver', token: created.resumeToken })).success, true);
  const afterResume = event(resumedReceiver, 'execute_command');
  resumedController.emit('send_command', { sessionId, command });
  assert.deepEqual(await afterResume, command);
  resumedReceiver.emit('leave_session', { sessionId, role: 'receiver' });
  await event(resumedController, 'receiver_disconnected');
  assert.equal((await fetch(`${origin}/api/session/${sessionId}`)).status, 404);
});

test('QR session ID pairing and malformed requests are handled', async () => {
  const receiver = await connect();
  const controller = await connect();
  const created = await ack(receiver, 'create_session', { receiverInfo: device });
  const joined = await ack(controller, 'join_by_id', { sessionId: created.session.sessionId, controllerInfo: device });
  assert.equal(joined.success, true);
  assert.equal((await ack(controller, 'create_session', null)).success, false);
  assert.equal((await ack(controller, 'create_session', { receiverInfo: {} })).success, false);
  assert.equal((await fetch(`${origin}/api/health`)).status, 200);
});

test('production start serves built frontend, SPA routes, and realtime API', async () => {
  const { child, url } = await start(true);
  try {
    const page = await (await fetch(`${url}/connect`)).text();
    assert.match(page, /\/assets\//);
    assert.doesNotMatch(page, /@vite\/client/);
    const socket = io(url, { transports: ['websocket'], reconnection: false });
    try {
      await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      assert.equal((await ack(socket, 'create_session', { receiverInfo: device })).success, true);
    } finally { socket.disconnect(); }
  } finally { child.kill(); await once(child, 'exit'); }
});


test('frontend SocketService restores its receiver role on reconnect', async () => {
  const browser = Object.assign(new EventTarget(), { location: { origin } });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  const { socketService } = await import('../src/lib/socket.ts');
  const session = await socketService.createSession(device as any);
  const controller = await connect();
  await ack(controller, 'join_by_code', { code: session.pairingCode, controllerInfo: device });
  const socket = socketService.getSocket()!;
  try {
    socket.disconnect();
    const resumed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Frontend did not resume')), 3000);
      browser.addEventListener('castsync:resumed', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    socket.connect();
    await resumed;
    const delivered = event(socket, 'execute_command');
    controller.emit('send_command', { sessionId: session.sessionId, command: { type: 'command', action: 'PAUSE', timestamp: Date.now() } });
    assert.equal((await delivered).action, 'PAUSE');
  } finally {
    socketService.leaveSession(session.sessionId, 'receiver');
    socket.disconnect();
    Reflect.deleteProperty(globalThis, 'window');
  }
});
