import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { browseWebsite } from './server/website-browser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  browser?: string;
  os?: string;
}

interface PairingSession {
  sessionId: string;
  pairingCode: string;
  createdAt: number;
  expiresAt: number;
  receiver: DeviceInfo;
  receiverSocketId: string;
  controller: DeviceInfo | null;
  controllerSocketId: string | null;
  status: 'waiting' | 'connected' | 'expired';
  receiverToken: string;
  controllerToken: string | null;
  receiverDisconnectTimer?: NodeJS.Timeout;
  controllerDisconnectTimer?: NodeJS.Timeout;
  browseRequests?: { start: number; count: number };
}

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(express.json());

// Active sessions memory map
const sessions = new Map<string, PairingSession>();
// Quick index by pairing code
const codeToSessionId = new Map<string, string>();
// Rate limiting map: ip -> { count, lastAttempt }
const attemptLimits = new Map<string, { count: number; lastAttempt: number }>();

function generateSessionId(): string {
  return 'room_' + crypto.randomBytes(16).toString('hex');
}

function generatePairingCode(): string {
  let code = '';
  do {
    // Generate 6 digit number
    code = crypto.randomInt(100000, 1000000).toString();
  } while (codeToSessionId.has(code));
  return code;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    clearTimeout(session.receiverDisconnectTimer);
    clearTimeout(session.controllerDisconnectTimer);
    io.in(sessionId).socketsLeave(sessionId);
    codeToSessionId.delete(session.pairingCode);
    sessions.delete(sessionId);
  }
}

// URL Safety validation
function isSafeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// REST health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    timestamp: Date.now(),
  });
});

// REST check session info (for QR code landing verification)
app.get('/api/session/:id', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }
  if (session.status === 'waiting' && Date.now() > session.expiresAt) {
    cleanupSession(session.sessionId);
    return res.status(410).json({ error: 'Session has expired' });
  }
  res.json({
    sessionId: session.sessionId,
    receiver: session.receiver,
    status: session.status,
  });
});

// Only the paired controller can browse public pages through this server.
app.post('/api/browse', async (req: Request, res: Response) => {
  const { sessionId, token, url } = req.body || {};
  const session = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
  if (!session || !session.controllerToken || token !== session.controllerToken) {
    res.status(403).json({ error: 'Pair with a receiving device before browsing.' });
    return;
  }
  if (typeof url !== 'string' || url.length > 4096) {
    res.status(400).json({ error: 'Enter a valid website URL.' });
    return;
  }
  const now = Date.now();
  if (!session.browseRequests || now - session.browseRequests.start > 60000) session.browseRequests = { start: now, count: 0 };
  if (session.browseRequests.count++ >= 30) {
    res.status(429).json({ error: 'Please wait a minute before opening more pages.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await browseWebsite(url)); }
  catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to read this website.' }); }
});

// Socket.io logic
io.on('connection', (socket: Socket) => {
  const clientIp = socket.handshake.address;
  const acknowledgedEvents = new Set(['create_session', 'join_by_code', 'join_by_id', 'resume_session']);
  socket.use(([event, payload, callback], next) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        (acknowledgedEvents.has(event) && typeof callback !== 'function')) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid request.' });
      return;
    }
    if (event === 'create_session' || event === 'join_by_code' || event === 'join_by_id') {
      const info = event === 'create_session' ? payload.receiverInfo : payload.controllerInfo;
      if (!info || typeof info.id !== 'string' || typeof info.name !== 'string' ||
          info.name.length > 120 || typeof info.type !== 'string') {
        callback({ success: false, error: 'Invalid device information.' });
        return;
      }
    }
    if (event === 'join_by_code' || event === 'join_by_id') {
      const now = Date.now();
      const limit = attemptLimits.get(clientIp);
      const current = !limit || now - limit.lastAttempt >= 60000 ? { count: 0, lastAttempt: now } : limit;
      if (current.count >= 10) {
        callback({ success: false, error: 'Too many attempts. Please wait 1 minute.' });
        return;
      }
      current.count++;
      attemptLimits.set(clientIp, current);
    }
    next();
  });

  // A private token restores the same role after a transient network loss.
  socket.on('resume_session', ({ sessionId, role, token } = {}, callback) => {
    const session = sessions.get(sessionId);
    const isReceiver = role === 'receiver';
    const expected = isReceiver ? session?.receiverToken : session?.controllerToken;
    if (!session || !expected || token !== expected || !['receiver', 'controller'].includes(role)) {
      return callback({ success: false, error: 'Session ended. Please pair again.' });
    }
    if (session.status === 'waiting' && Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return callback({ success: false, error: 'Pairing session expired.' });
    }
    const oldId = isReceiver ? session.receiverSocketId : session.controllerSocketId;
    if (oldId && oldId !== socket.id) io.sockets.sockets.get(oldId)?.leave(sessionId);
    if (isReceiver) {
      clearTimeout(session.receiverDisconnectTimer);
      session.receiverSocketId = socket.id;
    } else {
      clearTimeout(session.controllerDisconnectTimer);
      session.controllerSocketId = socket.id;
    }
    socket.join(sessionId);
    callback({ success: true });
    socket.to(sessionId).emit('peer_reconnected', { role });
  });

  // Receiver creates pairing session
  socket.on('create_session', ({ receiverInfo }, callback) => {
    try {
      const sessionId = generateSessionId();
      const pairingCode = generatePairingCode();
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

      const session: PairingSession = {
        sessionId,
        pairingCode,
        createdAt: now,
        expiresAt,
        receiver: receiverInfo,
        receiverSocketId: socket.id,
        controller: null,
        controllerSocketId: null,
        status: 'waiting',
        receiverToken: crypto.randomBytes(32).toString('hex'),
        controllerToken: null,
      };

      sessions.set(sessionId, session);
      codeToSessionId.set(pairingCode, sessionId);

      socket.join(sessionId);

      // Auto-cleanup on expiration
      setTimeout(() => {
        const s = sessions.get(sessionId);
        if (s && s.status === 'waiting') {
          s.status = 'expired';
          io.to(sessionId).emit('session_expired', { sessionId });
          cleanupSession(sessionId);
        }
      }, 5 * 60 * 1000);

      callback({
        success: true,
        resumeToken: session.receiverToken,
        session: {
          sessionId,
          pairingCode,
          createdAt: now,
          expiresAt,
          receiver: receiverInfo,
          controller: null,
          status: 'waiting',
        },
      });
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Error creating session' });
    }
  });

  // Controller joins by 6-digit code
  socket.on('join_by_code', ({ code, controllerInfo }, callback) => {
    const cleanCode = String(code).trim().replace(/\s+/g, '');

    const sessionId = codeToSessionId.get(cleanCode);
    if (!sessionId) {
      return callback({ success: false, error: 'Invalid pairing code. Please check and try again.' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return callback({ success: false, error: 'Session not found or expired.' });
    }

    if (session.status === 'waiting' && Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return callback({ success: false, error: 'This pairing code has expired.' });
    }

    if (session.status !== 'waiting' || session.receiverSocketId === socket.id) {
      return callback({ success: false, error: 'This session already has a controller.' });
    }

    session.controllerToken = crypto.randomBytes(32).toString('hex');
    session.controller = controllerInfo;
    session.controllerSocketId = socket.id;
    session.status = 'connected';

    socket.join(sessionId);

    // Notify receiver that controller connected
    socket.to(sessionId).emit('controller_connected', { controller: controllerInfo });

    callback({
      success: true,
      resumeToken: session.controllerToken,
      session: {
        sessionId: session.sessionId,
        pairingCode: session.pairingCode,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        receiver: session.receiver,
        controller: controllerInfo,
        status: 'connected',
      },
    });
  });

  // Controller joins by sessionId (from QR code scan)
  socket.on('join_by_id', ({ sessionId, controllerInfo }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return callback({ success: false, error: 'Session not found or has expired.' });
    }

    if (session.status === 'waiting' && Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return callback({ success: false, error: 'This session has expired.' });
    }

    if (session.status !== 'waiting' || session.receiverSocketId === socket.id) {
      return callback({ success: false, error: 'This session already has a controller.' });
    }

    session.controllerToken = crypto.randomBytes(32).toString('hex');
    session.controller = controllerInfo;
    session.controllerSocketId = socket.id;
    session.status = 'connected';

    socket.join(sessionId);

    // Notify receiver that controller connected
    socket.to(sessionId).emit('controller_connected', { controller: controllerInfo });

    callback({
      success: true,
      resumeToken: session.controllerToken,
      session: {
        sessionId: session.sessionId,
        pairingCode: session.pairingCode,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        receiver: session.receiver,
        controller: controllerInfo,
        status: 'connected',
      },
    });
  });

  // Relay command from controller to receiver
  socket.on('send_command', ({ sessionId, command }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    if (session.controllerSocketId !== socket.id) return;

    const actions = new Set(['OPEN_URL', 'PLAY', 'PAUSE', 'TOGGLE_PLAYBACK', 'SEEK',
      'SEEK_FORWARD', 'SEEK_BACKWARD', 'SET_VOLUME', 'VOLUME_UP', 'VOLUME_DOWN',
      'MUTE', 'UNMUTE', 'FULLSCREEN', 'EXIT_FULLSCREEN', 'BACK', 'FORWARD',
      'REFRESH', 'HOME', 'NAVIGATE', 'DISCONNECT']);
    if (!command || command.type !== 'command' || !actions.has(command.action)) return;
    if (['SEEK', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SET_VOLUME'].includes(command.action) &&
        (typeof command.value !== 'number' || !Number.isFinite(command.value) || command.value < 0 ||
         (command.action === 'SET_VOLUME' && command.value > 1))) return;
    if (command.action === 'NAVIGATE' && !['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'menu', 'enter', 'escape'].includes(command.direction)) return;

    // If opening a URL, validate against dangerous schemes
    if (command.action === 'OPEN_URL') {
      if (!isSafeUrl(command.url)) {
        socket.emit('command_error', {
          message: 'Security error: Only http:// and https:// URLs are permitted.',
        });
        return;
      }
    }

    // Forward to receiver
    io.to(session.receiverSocketId).emit('execute_command', command);
  });

  // Relay playback state updates from receiver to controller
  socket.on('playback_state_update', ({ sessionId, state }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    if (session.receiverSocketId !== socket.id || !state || typeof state !== 'object') return;
    if (session.controllerSocketId) io.to(session.controllerSocketId).emit('playback_state_updated', state);
  });

  // Graceful user leave
  socket.on('leave_session', ({ sessionId, role }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    if (role === 'receiver' && session.receiverSocketId === socket.id) {
      socket.to(sessionId).emit('receiver_disconnected', { reason: 'Receiver ended session' });
      cleanupSession(sessionId);
    } else if (role === 'controller' && session.controllerSocketId === socket.id) {
      session.controllerToken = null;
      session.controller = null;
      session.controllerSocketId = null;
      session.status = 'waiting';
      socket.to(sessionId).emit('controller_disconnected', { reason: 'Controller disconnected' });
      socket.leave(sessionId);
    }
  });

  // Handle socket disconnection with grace period
  socket.on('disconnect', () => {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.receiverSocketId === socket.id) {
        // Receiver disconnected
        socket.to(sessionId).emit('peer_disconnected', {
          role: 'receiver',
          message: 'Controlled device lost connection. Waiting to reconnect...',
        });

        // Grace period of 30 seconds
        session.receiverDisconnectTimer = setTimeout(() => {
          socket.to(sessionId).emit('session_terminated', {
            reason: 'Receiver did not reconnect within grace period.',
          });
          cleanupSession(sessionId);
        }, 30000);
      } else if (session.controllerSocketId === socket.id) {
        // Controller disconnected
        socket.to(sessionId).emit('peer_disconnected', {
          role: 'controller',
          message: 'Controller device lost connection.',
        });

        session.controllerDisconnectTimer = setTimeout(() => {
          session.controllerToken = null;
          session.controller = null;
          session.controllerSocketId = null;
          session.status = 'waiting';
          if (Date.now() > session.expiresAt) cleanupSession(sessionId);
          socket.to(sessionId).emit('controller_left');
        }, 30000);
      }
    }
  });
});

// Configure Vite integration
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: {
          server,
          ...(process.env.HMR_HOST ? { host: process.env.HMR_HOST } : {}),
          ...(process.env.HMR_PROTOCOL ? { protocol: process.env.HMR_PROTOCOL as 'ws' | 'wss' } : {}),
          ...(process.env.HMR_CLIENT_PORT ? { clientPort: Number(process.env.HMR_CLIENT_PORT) } : {}),
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`> CastSync full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start CastSync:', error);
  process.exit(1);
});
