/// <reference types="youtube" />
import React, { useEffect, useRef, useState } from 'react';
import VimeoPlayer from '@vimeo/player';
import type { EmbeddedSource } from '../../lib/media-source';
import type { PlaybackState, RemoteCommand } from '../../types';
import type { SocketService } from '../../lib/socket';

declare global { interface Window { onYouTubeIframeAPIReady?: () => void; } }

interface Adapter {
  play(): Promise<unknown>;
  pause(): Promise<unknown>;
  seek(seconds: number): Promise<unknown>;
  volume(value: number): Promise<unknown>;
  mute(value: boolean): Promise<unknown>;
  reload(): Promise<unknown>;
  state(): Promise<Partial<PlaybackState>>;
  destroy(): void;
}
let youtubeReady: Promise<void> | null = null;
function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeReady) return youtubeReady;
  youtubeReady = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => reject(new Error('YouTube player did not load.')), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timer); reject(new Error('Unable to load YouTube player.')); };
    document.head.appendChild(script);
  }).catch((error) => { youtubeReady = null; throw error; });
  return youtubeReady;
}
const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function EmbeddedPlayer({ source, sessionId, service, onState }: {
  source: EmbeddedSource; sessionId: string; service: SocketService; onState: (state: Partial<PlaybackState>) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const adapter = useRef<Adapter | null>(null);
  const callback = useRef(onState);
  callback.current = onState;
  const [prompt, setPrompt] = useState('Loading player…');
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    let destroyPlayer: (() => void) | undefined;
    let publishing = false;
    let unavailable = false;
    const queued: RemoteCommand[] = [];
    adapter.current = null;
    setPrompt('Loading player…'); setReady(false); setFailed(false);
    const update = (state: Partial<PlaybackState>) => { if (alive) callback.current(state); };
    const fail = (message: string) => {
      if (!alive) return;
      unavailable = true;
      setFailed(true); setPrompt(message);
      update({ playing: false, supportsRemoteMedia: false, error: message });
    };
    const readinessTimer = window.setTimeout(() => {
      if (!adapter.current) fail('The player did not respond. Choose another video or check your connection.');
    }, 20000);
    const publish = async () => {
      const player = adapter.current;
      if (!alive || !player || publishing || unavailable) return;
      publishing = true;
      try { update({ ...await player.state(), supportsRemoteMedia: true }); }
      catch { /* SDK may be transitioning between videos. */ }
      finally { publishing = false; }
    };
    const execute = async (command: RemoteCommand) => {
      const player = adapter.current;
      const actions = ['PLAY', 'PAUSE', 'TOGGLE_PLAYBACK', 'SEEK', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SET_VOLUME', 'VOLUME_UP', 'VOLUME_DOWN', 'MUTE', 'UNMUTE', 'REFRESH', 'NAVIGATE'];
      if (!actions.includes(command.action)) return;
      if (!player) { if (queued.length < 8) queued.push(command); return; }
      try {
        const state = await player.state();
        const volume = state.volume ?? 0.8;
        const time = state.currentTime ?? 0;
        const duration = state.duration || Infinity;
        switch (command.action) {
          case 'PLAY': await player.play(); break;
          case 'PAUSE': await player.pause(); break;
          case 'TOGGLE_PLAYBACK': await (state.playing ? player.pause() : player.play()); break;
          case 'SEEK': await player.seek(Math.min(duration, Number(command.value))); break;
          case 'SEEK_FORWARD': await player.seek(Math.min(duration, time + Number(command.value))); break;
          case 'SEEK_BACKWARD': await player.seek(Math.max(0, time - Number(command.value))); break;
          case 'SET_VOLUME': await player.volume(Number(command.value)); break;
          case 'VOLUME_UP': await player.volume(Math.min(1, volume + 0.1)); break;
          case 'VOLUME_DOWN': await player.volume(Math.max(0, volume - 0.1)); break;
          case 'MUTE': await player.mute(true); break;
          case 'UNMUTE': await player.mute(false); break;
          case 'REFRESH': await player.reload(); break;
          case 'NAVIGATE': if (command.direction === 'ok' || command.direction === 'enter') await (state.playing ? player.pause() : player.play()); break;
        }
        await publish();
      } catch {
        if (alive) {
          setPrompt('Tap Play on this receiving screen to allow playback.');
          update({ error: 'The player needs a tap on the receiving screen, or this operation is unavailable.' });
        }
      }
    };
    const finish = async (player: Adapter) => {
      if (!alive || unavailable) { player.destroy(); return; }
      clearTimeout(readinessTimer);
      adapter.current = player;
      setReady(true); setPrompt('');
      update({ error: null, supportsRemoteMedia: true });
      await publish();
      for (const command of queued.splice(0)) await execute(command);
    };
    const socket = service.getSocket();
    socket?.on('execute_command', execute);
    const interval = window.setInterval(() => { void publish(); }, 1000);
    async function initialize() {
      const mount = document.createElement('div');
      host.current?.replaceChildren(mount);
      if (source.provider === 'youtube') {
        await loadYouTube();
        if (!alive) return;
        const player = new window.YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%', height: '100%', videoId: source.id,
          playerVars: { autoplay: 1, playsinline: 1, origin: window.location.origin, rel: 0 },
          events: {
            onReady: () => {
              void finish({
                play: async () => player.playVideo(), pause: async () => player.pauseVideo(),
                seek: async (seconds) => player.seekTo(seconds, true),
                volume: async (value) => player.setVolume(value * 100),
                mute: async (value) => value ? player.mute() : player.unMute(),
                reload: async () => player.loadVideoById(source.id),
                state: async () => ({ playing: player.getPlayerState() === 1, currentTime: finite(player.getCurrentTime()), duration: finite(player.getDuration()), volume: Math.min(1, finite(player.getVolume()) / 100), muted: player.isMuted(), mediaTitle: (player as any).getVideoData?.().title || 'YouTube video' }),
                destroy: () => player.destroy(),
              });
            },
            onStateChange: () => { if (alive && player.getPlayerState() === 1) { setPrompt(''); update({ error: null }); } void publish(); },
            onError: () => fail('YouTube cannot play this video here. It may be private, unavailable, or disallow embedding.'),
            onAutoplayBlocked: () => { if (alive) setPrompt('Tap Play on this receiving screen to start the video.'); },
          },
        });
        destroyPlayer = () => player.destroy();
      } else {
        const player = new VimeoPlayer(mount, { url: source.url as `https://vimeo.com/${string}`, autoplay: true, playsinline: true, dnt: true });
        destroyPlayer = () => { void player.destroy().catch(() => {}); };
        player.on('play', () => { if (alive) setPrompt(''); void publish(); });
        player.on('pause', () => { void publish(); });
        player.on('timeupdate', () => { void publish(); });
        player.on('volumechange', () => { void publish(); });
        player.on('error', () => fail('Vimeo cannot play this video here. It may be private or disallow embedding.'));
        await player.ready();
        await finish({
          play: () => player.play(), pause: () => player.pause(), seek: (seconds) => player.setCurrentTime(seconds),
          volume: (value) => player.setVolume(value), mute: (value) => player.setMuted(value),
          reload: () => player.loadVideo(source.url),
          state: async () => {
            const [paused, currentTime, duration, volume, muted, mediaTitle] = await Promise.all([player.getPaused(), player.getCurrentTime(), player.getDuration(), player.getVolume(), player.getMuted(), player.getVideoTitle()]);
            return { playing: !paused, currentTime: finite(currentTime), duration: finite(duration), volume, muted, mediaTitle };
          },
          destroy: () => { void player.destroy().catch(() => {}); },
        });
      }
    }
    void initialize().catch(() => fail('Unable to load this player. Check your connection or choose another video.'));
    return () => {
      alive = false;
      clearInterval(interval);
      clearTimeout(readinessTimer);
      socket?.off('execute_command', execute);
      adapter.current = null;
      destroyPlayer?.();
    };
  }, [source.url, sessionId, service]);

  return <div className="absolute inset-0 bg-black">
    <div ref={host} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0 [&>div]:h-full [&>div]:w-full" />
    {prompt && <div className="absolute top-4 inset-x-4 z-20 mx-auto max-w-lg rounded-2xl bg-[#18181D]/95 border border-white/10 p-4 text-sm text-white">
      <p role={failed ? 'alert' : 'status'}>{prompt}</p>
      {ready && !failed && <button className="mt-3 rounded-xl bg-[#6D5DFB] px-5 py-2 font-semibold" onClick={() => {
        void adapter.current?.play().then(() => { setPrompt(''); callback.current({ error: null }); }).catch(() => setPrompt('Use the player’s Play button below.'));
      }}>Play on this screen</button>}
    </div>}
  </div>;
}
