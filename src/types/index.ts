export type DeviceType = 'tv' | 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'unknown';

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  browser?: string;
  os?: string;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'expired';

export interface PlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 1
  muted: boolean;
  fullscreen: boolean;
  currentUrl: string;
  mediaTitle: string;
  contentType: 'video' | 'embed' | 'web' | 'empty';
  supportsRemoteMedia: boolean;
  lastUpdated: number;
  error?: string | null;
}

export type RemoteAction =
  | 'OPEN_URL'
  | 'PLAY'
  | 'PAUSE'
  | 'TOGGLE_PLAYBACK'
  | 'SEEK'
  | 'SEEK_FORWARD'
  | 'SEEK_BACKWARD'
  | 'SET_VOLUME'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE'
  | 'UNMUTE'
  | 'FULLSCREEN'
  | 'EXIT_FULLSCREEN'
  | 'BACK'
  | 'FORWARD'
  | 'REFRESH'
  | 'HOME'
  | 'NAVIGATE'
  | 'DISCONNECT';

export type NavDirection = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'home' | 'menu' | 'enter' | 'escape';

export interface RemoteCommand {
  type: 'command';
  action: RemoteAction;
  value?: number | string | boolean;
  url?: string;
  direction?: NavDirection;
  timestamp: number;
}

export interface PairingSession {
  sessionId: string;
  pairingCode: string;
  createdAt: number;
  expiresAt: number;
  receiver: DeviceInfo;
  controller: DeviceInfo | null;
  status: 'waiting' | 'connected' | 'expired';
}
