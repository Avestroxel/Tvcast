import { io, Socket } from 'socket.io-client';
import { DeviceInfo, PairingSession, PlaybackState, RemoteCommand } from '../types';

export class SocketService {
  constructor(private reportLifecycle = true) {}
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private activeSession: { sessionId: string; role: 'receiver' | 'controller'; token: string } | null = null;

  public init(): Socket {
    if (this.socket) {
      if (!this.socket.connected && !this.isConnecting) {
        this.socket.connect();
      }
      return this.socket;
    }

    this.isConnecting = true;

    // Use current origin so it connects smoothly to port 3000 in dev and deployed
    const url = typeof window !== 'undefined' ? window.location.origin : '';

    this.socket = io(url, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      if (this.activeSession) {
        this.socket!.timeout(10000).emit('resume_session', this.activeSession, (error: Error | null, response: { success: boolean }) => {
          if (!error && response?.success) {
            if (this.reportLifecycle) window.dispatchEvent(new Event('castsync:resumed'));
          }
          else {
            this.activeSession = null;
            if (this.reportLifecycle) window.dispatchEvent(new Event('castsync:resume-failed'));
          }
        });
      }
    });

    this.socket.on('connect_error', () => {
      this.isConnecting = false;
      // Do not throw; polling will automatically retry or fallback
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
    });

    return this.socket;
  }

  public disconnect() {
    this.activeSession = null;
    this.socket?.disconnect();
    this.socket = null;
    this.isConnecting = false;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private ensureConnected(): Promise<Socket> {
    const s = this.init();
    if (s.connected) {
      return Promise.resolve(s);
    }
    return new Promise((resolve, reject) => {
      // If already connected or once connected, resolve immediately
      const onConnect = () => {
        cleanup();
        resolve(s);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Unable to connect to server. Check your connection and server URL.'));
      }, 4000);

      const cleanup = () => {
        clearTimeout(timer);
        s.off('connect', onConnect);
      };

      s.once('connect', onConnect);
    });
  }

  public async createSession(receiverInfo: DeviceInfo): Promise<PairingSession> {
    const s = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out. Please try again.'));
      }, 10000);

      s.emit('create_session', { receiverInfo }, (response: { success: boolean; session?: PairingSession; resumeToken?: string; error?: string }) => {
        clearTimeout(timeout);
        if (response && response.success && response.session) {
          this.activeSession = response.resumeToken ? { sessionId: response.session.sessionId, role: 'receiver', token: response.resumeToken } : null;
          resolve(response.session);
        } else {
          reject(new Error(response?.error || 'Failed to create pairing session'));
        }
      });
    });
  }

  public async joinByCode(code: string, controllerInfo: DeviceInfo): Promise<PairingSession> {
    const s = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out. Check pairing code.'));
      }, 10000);

      s.emit('join_by_code', { code: code.replace(/\s+/g, ''), controllerInfo }, (response: { success: boolean; session?: PairingSession; resumeToken?: string; error?: string }) => {
        clearTimeout(timeout);
        if (response && response.success && response.session) {
          this.activeSession = response.resumeToken ? { sessionId: response.session.sessionId, role: 'controller', token: response.resumeToken } : null;
          resolve(response.session);
        } else {
          reject(new Error(response?.error || 'Invalid or expired pairing code'));
        }
      });
    });
  }

  public async joinById(sessionId: string, controllerInfo: DeviceInfo): Promise<PairingSession> {
    const s = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out. Check QR code.'));
      }, 10000);

      s.emit('join_by_id', { sessionId, controllerInfo }, (response: { success: boolean; session?: PairingSession; resumeToken?: string; error?: string }) => {
        clearTimeout(timeout);
        if (response && response.success && response.session) {
          this.activeSession = response.resumeToken ? { sessionId: response.session.sessionId, role: 'controller', token: response.resumeToken } : null;
          resolve(response.session);
        } else {
          reject(new Error(response?.error || 'Invalid or expired session'));
        }
      });
    });
  }

  public sendCommand(sessionId: string, command: Omit<RemoteCommand, 'timestamp'>) {
    if (!this.socket?.connected) {
      return;
    }
    const fullCommand: RemoteCommand = {
      ...command,
      timestamp: Date.now(),
    };
    this.socket.emit('send_command', { sessionId, command: fullCommand });
  }

  public sendPlaybackState(sessionId: string, state: PlaybackState) {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('playback_state_update', { sessionId, state });
  }

  public leaveSession(sessionId: string, role: 'controller' | 'receiver') {
    this.activeSession = null;
    if (this.socket) {
      this.socket.emit('leave_session', { sessionId, role });
    }
  }
}

export const socketService = new SocketService();
