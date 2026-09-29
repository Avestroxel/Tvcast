import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

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
  disconnectTimer?: NodeJS.Timeout;
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
  return 'room_' + crypto.randomBytes(4).toString('hex');
}

function generatePairingCode(): string {
  let code = '';
  do {
    // Generate 6 digit number
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (codeToSessionId.has(code));
  return code;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.disconnectTimer) {
      clearTimeout(session.disconnectTimer);
    }
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
  if (Date.now() > session.expiresAt) {
    cleanupSession(session.sessionId);
    return res.status(410).json({ error: 'Session has expired' });
  }
  res.json({
    sessionId: session.sessionId,
    receiver: session.receiver,
    status: session.status,
  });
});

// Socket.io logic
io.on('connection', (socket: Socket) => {
  const clientIp = socket.handshake.address;

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

    // Simple brute-force prevention
    const limit = attemptLimits.get(clientIp) || { count: 0, lastAttempt: Date.now() };
    if (Date.now() - limit.lastAttempt > 60000) {
      limit.count = 0;
    }
    if (limit.count > 10) {
      return callback({ success: false, error: 'Too many attempts. Please wait 1 minute.' });
    }
    limit.count++;
    limit.lastAttempt = Date.now();
    attemptLimits.set(clientIp, limit);

    const sessionId = codeToSessionId.get(cleanCode);
    if (!sessionId) {
      return callback({ success: false, error: 'Invalid pairing code. Please check and try again.' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return callback({ success: false, error: 'Session not found or expired.' });
    }

    if (Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return callback({ success: false, error: 'This pairing code has expired.' });
    }

    if (session.disconnectTimer) {
      clearTimeout(session.disconnectTimer);
      delete session.disconnectTimer;
    }

    session.controller = controllerInfo;
    session.controllerSocketId = socket.id;
    session.status = 'connected';

    socket.join(sessionId);

    // Notify receiver that controller connected
    socket.to(sessionId).emit('controller_connected', { controller: controllerInfo });

    callback({
      success: true,
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

    if (Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return callback({ success: false, error: 'This session has expired.' });
    }

    if (session.disconnectTimer) {
      clearTimeout(session.disconnectTimer);
      delete session.disconnectTimer;
    }

    session.controller = controllerInfo;
    session.controllerSocketId = socket.id;
    session.status = 'connected';

    socket.join(sessionId);

    // Notify receiver that controller connected
    socket.to(sessionId).emit('controller_connected', { controller: controllerInfo });

    callback({
      success: true,
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

    // Validate command structure
    if (!command || !command.action) return;

    // If opening a URL, validate against dangerous schemes
    if (command.action === 'OPEN_URL' && command.url) {
      if (!isSafeUrl(command.url)) {
        socket.emit('command_error', {
          message: 'Security error: Only http:// and https:// URLs are permitted.',
        });
        return;
      }
    }

    // Forward to receiver
    socket.to(sessionId).emit('execute_command', command);
  });

  // Relay playback state updates from receiver to controller
  socket.on('playback_state_update', ({ sessionId, state }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    socket.to(sessionId).emit('playback_state_updated', state);
  });

  // Graceful user leave
  socket.on('leave_session', ({ sessionId, role }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    if (role === 'receiver') {
      socket.to(sessionId).emit('receiver_disconnected', { reason: 'Receiver ended session' });
      cleanupSession(sessionId);
    } else {
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
        session.disconnectTimer = setTimeout(() => {
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

        session.disconnectTimer = setTimeout(() => {
          session.controller = null;
          session.controllerSocketId = null;
          session.status = 'waiting';
          socket.to(sessionId).emit('controller_left');
        }, 30000);
      }
    }
  });
});

// Configure Vite integration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: server,
          clientPort: 443,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`> CastSync full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
