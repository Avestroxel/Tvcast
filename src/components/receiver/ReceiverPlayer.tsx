import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Tv,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Globe,
  Film,
  Sparkles,
  Info,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { DeviceInfo, PlaybackState, RemoteCommand } from '../../types';
import { socketService, SocketService } from '../../lib/socket.ts';
import { Language, translations } from '../../lib/i18n';

interface ReceiverPlayerProps {
  sessionId: string;
  controllerDevice: DeviceInfo | null;
  onDisconnect: () => void;
  lang?: Language;
  service?: SocketService;
}

// Preset default video for instant demonstration
const DEFAULT_DEMO_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const DEFAULT_DEMO_TITLE = 'Big Buck Bunny (1080p Sample)';

export const ReceiverPlayer: React.FC<ReceiverPlayerProps> = ({
  sessionId,
  controllerDevice,
  onDisconnect,
  lang = 'en',
  service = socketService,
}) => {
  const t = translations[lang] || translations.en;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingPlay = useRef(false);
  const history = useRef([DEFAULT_DEMO_VIDEO]);
  const historyIndex = useRef(0);
  const navigatingHistory = useRef(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Playback state
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_DEMO_VIDEO);
  const [mediaTitle, setMediaTitle] = useState<string>(DEFAULT_DEMO_TITLE);
  const [contentType, setContentType] = useState<'video' | 'web'>('video');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenPrompt, setFullscreenPrompt] = useState<boolean>(false);
  const [unmutePrompt, setUnmutePrompt] = useState<boolean>(false);
  const [lastActionToast, setLastActionToast] = useState<string | null>(null);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [iframeError, setIframeError] = useState<boolean>(false);

  // Auto-hide HUD on TV after 4 seconds of idle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isPlaying) {
        setShowHud(false);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [isPlaying, currentTime]);

  const showToast = (msg: string) => {
    setLastActionToast(msg);
    setShowHud(true);
    setTimeout(() => {
      setLastActionToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Helper to convert YouTube / Vimeo URLs to embeddable player URLs
  const getEmbeddableUrl = (url: string): { embedUrl: string; isEmbed: boolean } => {
    try {
      const parsed = new URL(url);
      // YouTube: watch?v=ID or youtu.be/ID
      if (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com') {
        const videoId = parsed.searchParams.get('v');
        if (videoId) {
          return {
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
            isEmbed: true,
          };
        }
      } else if (parsed.hostname === 'youtu.be') {
        const videoId = parsed.pathname.slice(1);
        if (videoId) {
          return {
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
            isEmbed: true,
          };
        }
      } else if (parsed.hostname === 'vimeo.com' || parsed.hostname === 'www.vimeo.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const videoId = parts[parts.length - 1];
          return {
            embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
            isEmbed: true,
          };
        }
      }
    } catch {}
    return { embedUrl: url, isEmbed: false };
  };

  // Helper to determine if a URL points directly to an HTML5 video stream
  const isDirectVideoUrl = (url: string): boolean => {
    const clean = url.split('?')[0].toLowerCase();
    return (
      clean.endsWith('.mp4') ||
      clean.endsWith('.webm') ||
      clean.endsWith('.ogv') ||
      clean.endsWith('.mov') ||
      clean.endsWith('.m4v') ||
      clean.endsWith('.m3u8') ||
      clean.includes('/gtv-videos-bucket/') ||
      clean.includes('.mp4?') ||
      clean.includes('.webm?')
    );
  };

  // Sync playback state to controller over socket
  const broadcastPlaybackState = useCallback(
    (overrides?: Partial<PlaybackState>) => {
      const state: PlaybackState = {
        playing: isPlaying,
        currentTime,
        duration,
        volume,
        muted: isMuted,
        fullscreen: isFullscreen,
        currentUrl,
        mediaTitle,
        contentType,
        supportsRemoteMedia: contentType === 'video',
        lastUpdated: Date.now(),
        ...overrides,
      };
      service.sendPlaybackState(sessionId, state);
    },
    [service, sessionId, isPlaying, currentTime, duration, volume, isMuted, isFullscreen, currentUrl, mediaTitle, contentType]
  );

  // Monitor fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      broadcastPlaybackState({ fullscreen: isFs });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [broadcastPlaybackState]);

  // Request fullscreen with graceful user gesture prompt
  const triggerFullscreen = async () => {
    setFullscreenPrompt(false);
    try {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      } else {
        throw new Error('Fullscreen is not supported by this browser.');
      }
      setIsFullscreen(true);
      broadcastPlaybackState({ fullscreen: true });
    } catch (err: any) {
      console.warn('Fullscreen blocked by browser policy:', err);
      setFullscreenPrompt(true);
    }
  };

  const triggerExitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
      setIsFullscreen(false);
      broadcastPlaybackState({ fullscreen: false });
    } catch (err) {
      console.warn('Exit fullscreen error:', err);
    }
  };

  // Play with browser autoplay policy fallback
  const attemptPlay = (video: HTMLVideoElement) => {
    video
      .play()
      .then(() => {
        setIsPlaying(true);
        setUnmutePrompt(false);
      })
      .catch((err) => {
        console.warn('Autoplay with sound prevented, attempting muted play:', err);
        if (err.name !== 'NotAllowedError') {
          setMediaError('Unable to play this video. Check the URL and supported format.');
          return;
        }
        // Try muted playback when autoplay with audio is blocked.
        video.muted = true;
        setIsMuted(true);
        video
          .play()
          .then(() => {
            setIsPlaying(true);
            setUnmutePrompt(true);
            showToast('Playing muted (tap screen or remote to unmute)');
          })
          .catch(() => {
            setIsPlaying(false);
          });
      });
  };

  // Execute remote commands
  const handleRemoteCommand = useCallback(
    async (cmd: RemoteCommand) => {
      setShowHud(true);
      const video = videoRef.current;

      switch (cmd.action) {
        case 'OPEN_URL': {
          if (!cmd.url) return;
          const url = cmd.url.trim();
          setMediaError(null);
          if (!navigatingHistory.current) {
            history.current = history.current.slice(0, historyIndex.current + 1);
            history.current.push(url);
            historyIndex.current = history.current.length - 1;
          }
          navigatingHistory.current = false;
          showToast(`Opening: ${url}`);

          if (isDirectVideoUrl(url)) {
            pendingPlay.current = true;
            setContentType('video');
            setCurrentUrl(url);
            const derivedTitle = url.split('/').pop()?.split('?')[0] || 'Media Stream';
            try { setMediaTitle(decodeURIComponent(derivedTitle)); } catch { setMediaTitle(derivedTitle); }
            setIframeError(false);

            if (video) {
              video.src = url;
              video.load();
              pendingPlay.current = false;
              attemptPlay(video);
            }
          } else {
            // Check if YouTube / Vimeo embed
            const embedInfo = getEmbeddableUrl(url);
            setContentType('web');
            setCurrentUrl(embedInfo.embedUrl);
            setMediaTitle(embedInfo.isEmbed ? 'Embedded Video Stream' : url);
            setIframeError(false);
            broadcastPlaybackState({
              contentType: 'web',
              supportsRemoteMedia: false,
              currentUrl: embedInfo.embedUrl,
              mediaTitle: embedInfo.isEmbed ? 'Embedded Video Stream' : url,
            });
          }
          break;
        }

        case 'PLAY': {
          if (video && contentType === 'video') {
            attemptPlay(video);
            showToast('Play');
          }
          break;
        }

        case 'PAUSE': {
          if (video && contentType === 'video') {
            video.pause();
            setIsPlaying(false);
            showToast('Pause');
          }
          break;
        }

        case 'TOGGLE_PLAYBACK': {
          if (video && contentType === 'video') {
            if (video.paused) {
              attemptPlay(video);
              showToast('Play');
            } else {
              video.pause();
              setIsPlaying(false);
              showToast('Pause');
            }
          }
          break;
        }

        case 'SEEK': {
          if (video && contentType === 'video' && typeof cmd.value === 'number') {
            const target = Math.max(0, Math.min(video.duration || 0, cmd.value));
            video.currentTime = target;
            setCurrentTime(target);
            showToast(`Seek to ${Math.floor(target / 60)}:${Math.floor(target % 60).toString().padStart(2, '0')}`);
          }
          break;
        }

        case 'SEEK_FORWARD': {
          if (video && contentType === 'video') {
            const step = typeof cmd.value === 'number' ? cmd.value : 10;
            const target = Math.min(video.duration || 0, video.currentTime + step);
            video.currentTime = target;
            setCurrentTime(target);
            showToast(`+${step}s`);
          }
          break;
        }

        case 'SEEK_BACKWARD': {
          if (video && contentType === 'video') {
            const step = typeof cmd.value === 'number' ? cmd.value : 10;
            const target = Math.max(0, video.currentTime - step);
            video.currentTime = target;
            setCurrentTime(target);
            showToast(`-${step}s`);
          }
          break;
        }

        case 'SET_VOLUME': {
          if (typeof cmd.value === 'number') {
            const vol = Math.max(0, Math.min(1, cmd.value));
            if (video) {
              video.volume = vol;
              video.muted = vol === 0;
            }
            setVolume(vol);
            setIsMuted(vol === 0);
            setUnmutePrompt(false);
            showToast(`Volume ${Math.round(vol * 100)}%`);
          }
          break;
        }

        case 'VOLUME_UP': {
          const newVol = Math.min(1, volume + 0.1);
          if (video) {
            video.volume = newVol;
            video.muted = false;
          }
          setVolume(newVol);
          setIsMuted(false);
          setUnmutePrompt(false);
          showToast(`Volume ${Math.round(newVol * 100)}%`);
          break;
        }

        case 'VOLUME_DOWN': {
          const newVol = Math.max(0, volume - 0.1);
          if (video) {
            video.volume = newVol;
          }
          setVolume(newVol);
          showToast(`Volume ${Math.round(newVol * 100)}%`);
          break;
        }

        case 'MUTE': {
          if (video) video.muted = true;
          setIsMuted(true);
          showToast('Muted');
          break;
        }

        case 'UNMUTE': {
          if (video) video.muted = false;
          setIsMuted(false);
          setUnmutePrompt(false);
          showToast('Unmuted');
          break;
        }

        case 'FULLSCREEN': {
          await triggerFullscreen();
          showToast('Fullscreen requested');
          break;
        }

        case 'EXIT_FULLSCREEN': {
          await triggerExitFullscreen();
          showToast('Exited fullscreen');
          break;
        }

        case 'NAVIGATE': {
          const dir = cmd.direction;
          showToast(`Nav: ${dir?.toUpperCase()}`);

          if (dir === 'up') {
            window.scrollBy({ top: -200, behavior: 'smooth' });
          } else if (dir === 'down') {
            window.scrollBy({ top: 200, behavior: 'smooth' });
          } else if (dir === 'left') {
            window.scrollBy({ left: -200, behavior: 'smooth' });
          } else if (dir === 'right') {
            window.scrollBy({ left: 200, behavior: 'smooth' });
          } else if (dir === 'ok' || dir === 'enter') {
            if (fullscreenPrompt) {
              triggerFullscreen();
            } else if (unmutePrompt && video) {
              video.muted = false;
              setIsMuted(false);
              setUnmutePrompt(false);
            } else if (contentType === 'video' && video) {
              if (video.paused) attemptPlay(video);
              else video.pause();
            }
          }
          break;
        }

        case 'BACK':
        case 'FORWARD': {
          const target = historyIndex.current + (cmd.action === 'BACK' ? -1 : 1);
          if (target < 0 || target >= history.current.length) return;
          historyIndex.current = target;
          navigatingHistory.current = true;
          await handleRemoteCommand({ ...cmd, action: 'OPEN_URL', url: history.current[target] });
          break;
        }

        case 'REFRESH': {
          showToast('Reloading media');
          if (contentType === 'video' && video) {
            video.load();
            attemptPlay(video);
          } else if (iframeRef.current) {
            iframeRef.current.src = currentUrl;
          }
          break;
        }

        case 'HOME': {
          showToast('Home');
          setContentType('video');
          setCurrentUrl(DEFAULT_DEMO_VIDEO);
          setMediaTitle(DEFAULT_DEMO_TITLE);
          if (video) {
            video.src = DEFAULT_DEMO_VIDEO;
            video.load();
          }
          break;
        }

        case 'DISCONNECT': {
          onDisconnect();
          break;
        }
      }
    },
    [volume, isMuted, fullscreenPrompt, unmutePrompt, contentType, currentUrl, broadcastPlaybackState, onDisconnect]
  );

  // Set up socket listener for commands
  useEffect(() => {
    const socket = service.getSocket();
    if (!socket) return;

    socket.on('execute_command', handleRemoteCommand);

    return () => {
      socket.off('execute_command', handleRemoteCommand);
    };
  }, [service, handleRemoteCommand]);

  // Initial video setup & HTML5 video element listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    video.muted = isMuted;
    if (pendingPlay.current) {
      pendingPlay.current = false;
      attemptPlay(video);
    }

    const onPlay = () => {
      setIsPlaying(true);
      broadcastPlaybackState({ playing: true });
    };

    const onPause = () => {
      setIsPlaying(false);
      broadcastPlaybackState({ playing: false });
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      broadcastPlaybackState({ currentTime: video.currentTime });
    };

    const onDurationChange = () => {
      setDuration(video.duration || 0);
      broadcastPlaybackState({ duration: video.duration || 0 });
    };

    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      broadcastPlaybackState({ volume: video.volume, muted: video.muted });
    };

    const onEnded = () => {
      setIsPlaying(false);
      broadcastPlaybackState({ playing: false, currentTime: video.duration || 0 });
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      broadcastPlaybackState({ duration: video.duration || 0, currentTime: video.currentTime });
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [broadcastPlaybackState, contentType]);

  // Periodic heartbeat broadcast
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && contentType === 'video') {
        broadcastPlaybackState({
          currentTime: videoRef.current.currentTime,
          duration: videoRef.current.duration || 0,
          playing: !videoRef.current.paused,
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [contentType, broadcastPlaybackState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (fullscreenPrompt) { event.preventDefault(); void triggerFullscreen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenPrompt]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={() => setShowHud(true)}
      onClick={() => {
        if (fullscreenPrompt) {
          triggerFullscreen();
        } else if (unmutePrompt && videoRef.current) {
          videoRef.current.muted = false;
          setIsMuted(false);
          setUnmutePrompt(false);
        }
      }}
      className="relative w-full h-[calc(100vh-65px)] bg-black flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Fullscreen User Gesture Prompt Overlay */}
      {fullscreenPrompt && (
        <div
          onClick={triggerFullscreen}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer animate-fade-in p-6"
        >
          <div className="max-w-md w-full bg-[#18181D] border-2 border-[#6D5DFB] rounded-3xl p-8 text-center space-y-4 shadow-[0_0_50px_rgba(109,93,251,0.5)]">
            <div className="w-16 h-16 rounded-full bg-[#6D5DFB]/20 text-[#6D5DFB] flex items-center justify-center mx-auto">
              <Maximize2 className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-white">{t.fullscreen}</h3>
            <p className="text-zinc-300 text-sm">
              Remote requested Fullscreen. Click or press any key on this screen to activate.
            </p>
            <button className="w-full py-3 rounded-xl bg-[#6D5DFB] hover:bg-[#5B4BE3] text-white font-bold text-base transition shadow-lg cursor-pointer">
              Click or Press OK
            </button>
          </div>
        </div>
      )}

      {mediaError && (
        <div role="alert" className="absolute top-8 z-40 bg-[#18181D] p-4 rounded-xl text-amber-300">{mediaError}</div>
      )}
      {/* Unmute Prompt Banner */}
      {unmutePrompt && (
        <div
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
              setUnmutePrompt(false);
            }
          }}
          className="absolute top-20 z-40 bg-amber-500/90 text-black px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg hover:bg-amber-400 transition"
        >
          <VolumeX className="w-4 h-4" />
          <span>Click to Unmute Audio (Browser Policy)</span>
        </div>
      )}

      {/* Main Content Area */}
      {contentType === 'video' ? (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={currentUrl}
            playsInline
            controls={false}
            onError={() => {
              const error = 'Unable to load media. Use a direct video URL supported by this browser.';
              setMediaError(error);
              broadcastPlaybackState({ playing: false, error });
            }}
            className="w-full h-full object-contain max-h-screen"
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) attemptPlay(videoRef.current);
                else videoRef.current.pause();
              }
            }}
          />
        </div>
      ) : (
        /* Webpage or Embedded Player Viewer */
        <div className="relative w-full h-full flex flex-col bg-[#111114]">
          <div className="w-full bg-[#18181D] border-b border-white/10 px-4 py-2 flex items-center justify-between text-xs text-zinc-300 z-10">
            <div className="flex items-center gap-2 truncate max-w-xl">
              <Globe className="w-4 h-4 text-[#6D5DFB] flex-shrink-0" />
              <span className="truncate">{currentUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[11px] font-medium flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Web View — remote playback unavailable</span>
              </span>
            </div>
          </div>

          <div className="relative flex-1 w-full h-full bg-white">
            <iframe
              ref={iframeRef}
              src={currentUrl}
              title="Remote Web View"
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              onError={() => setIframeError(true)}
            />

            {iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090B] p-6 text-center text-zinc-300">
                <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
                <h4 className="text-lg font-bold text-white mb-1">Third-Party Security Restriction</h4>
                <p className="text-sm text-zinc-400 max-w-md">
                  This website does not permit direct embedding or remote media control (CORS / X-Frame-Options).
                  Use a direct video URL or return to the sample video.
                </p>
                <button
                  onClick={() => {
                    setContentType('video');
                    setCurrentUrl(DEFAULT_DEMO_VIDEO);
                    setMediaTitle(DEFAULT_DEMO_TITLE);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#6D5DFB] text-white text-xs font-semibold cursor-pointer"
                >
                  Return to Sample Video
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action HUD Banner */}
      {lastActionToast && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 bg-[#18181D]/90 border border-white/20 px-6 py-2.5 rounded-full backdrop-blur-xl shadow-2xl flex items-center gap-2.5 text-white font-medium text-sm tracking-wide">
          <Sparkles className="w-4 h-4 text-[#6D5DFB] animate-spin" />
          <span>{lastActionToast}</span>
        </div>
      )}

      {/* Cinematic TV Overlay HUD */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 transition-opacity duration-500 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 sm:p-8 ${
          showHud ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col space-y-3">
          {/* Title and Controller Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#6D5DFB]/20 flex items-center justify-center text-[#6D5DFB]">
                {contentType === 'video' ? <Film className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight truncate max-w-md sm:max-w-2xl">
                  {mediaTitle}
                </h3>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{t.controlledBy}</span>
                  <strong className="text-zinc-200">
                    {controllerDevice ? controllerDevice.name : 'Remote Device'}
                  </strong>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Receiver Active</span>
                </div>
              </div>
            </div>

            {/* TV Volume / Fullscreen Indicators */}
            <div className="flex items-center gap-3 text-zinc-300 text-sm">
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
                <span className="font-mono text-xs">{isMuted ? t.muted : `${Math.round(volume * 100)}%`}</span>
              </div>

              <button
                onClick={isFullscreen ? triggerExitFullscreen : triggerFullscreen}
                className="p-2 rounded-xl bg-black/40 hover:bg-white/10 border border-white/10 text-white transition cursor-pointer"
                title={isFullscreen ? t.exitFullscreen : t.fullscreen}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Progress Timeline */}
          {contentType === 'video' && (
            <div className="w-full flex items-center gap-3" dir="ltr">
              <span className="text-xs font-mono text-zinc-400 w-12 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6D5DFB] transition-all duration-200 rounded-full"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs font-mono text-zinc-400 w-12">
                {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
