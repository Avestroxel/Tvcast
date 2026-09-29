import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  RotateCw as ReloadIcon,
  Home,
  Tv,
  Globe,
  Compass,
  Sliders,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { DeviceInfo, PlaybackState, RemoteAction, NavDirection } from '../../types';
import { DPadRemote } from './DPadRemote';
import { MediaPresets } from './MediaPresets';
import { Language, translations } from '../../lib/i18n';

interface RemoteControllerProps {
  sessionId: string;
  controlledDevice: DeviceInfo | null;
  playbackState: PlaybackState;
  onSendCommand: (action: RemoteAction, value?: any, url?: string, direction?: NavDirection) => void;
  onDisconnect: () => void;
  lang?: Language;
}

export const RemoteController: React.FC<RemoteControllerProps> = ({
  sessionId,
  controlledDevice,
  playbackState,
  onSendCommand,
  onDisconnect,
  lang = 'en',
}) => {
  const t = translations[lang] || translations.en;
  const [urlInput, setUrlInput] = useState<string>('');
  const [localSeekTime, setLocalSeekTime] = useState<number | null>(null);
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const [optimisticMuted, setOptimisticMuted] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'dpad'>('media');
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Clear optimistic states when server state updates
  useEffect(() => {
    setOptimisticPlaying(null);
  }, [playbackState.playing]);

  useEffect(() => {
    setOptimisticMuted(null);
  }, [playbackState.muted]);

  const currentPlaying = optimisticPlaying !== null ? optimisticPlaying : playbackState.playing;
  const currentMuted = optimisticMuted !== null ? optimisticMuted : playbackState.muted;
  const displayTime = localSeekTime !== null ? localSeekTime : playbackState.currentTime;
  const displayVolume = localVolume !== null ? localVolume : playbackState.volume;

  const handleOpenUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    onSendCommand('OPEN_URL', undefined, targetUrl);
  };

  const handleSelectPreset = (url: string) => {
    setUrlInput(url);
    onSendCommand('OPEN_URL', undefined, url);
    setShowPresets(false);
  };

  const handleTogglePlayback = () => {
    setOptimisticPlaying(!currentPlaying);
    onSendCommand('TOGGLE_PLAYBACK');
  };

  const handleToggleMute = () => {
    const nextMuted = !currentMuted;
    setOptimisticMuted(nextMuted);
    onSendCommand(nextMuted ? 'MUTE' : 'UNMUTE');
  };

  const handleSeekOffset = (seconds: number) => {
    const target = Math.max(0, Math.min(playbackState.duration || 600, displayTime + seconds));
    setLocalSeekTime(target);
    onSendCommand(seconds > 0 ? 'SEEK_FORWARD' : 'SEEK_BACKWARD', Math.abs(seconds));
    setTimeout(() => setLocalSeekTime(null), 800);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-between max-w-lg mx-auto p-4 sm:p-6 pb-8 space-y-6 select-none">
      {/* Top Remote Header */}
      <div className="bg-[#111114] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#6D5DFB]/15 border border-[#6D5DFB]/30 flex items-center justify-center text-[#6D5DFB]">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
              {t.connectedScreen}
            </div>
            <div className="text-base font-bold text-white truncate max-w-[200px]">
              {controlledDevice?.name || 'Living Room TV'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t.online}</span>
          </div>
        </div>
      </div>

      {/* URL Browser Bar */}
      <div className="bg-[#111114] border border-white/10 rounded-3xl p-4 shadow-xl space-y-3">
        <form onSubmit={handleOpenUrl} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t.searchOrUrl}
              className="w-full bg-[#18181D] border border-white/10 focus:border-[#6D5DFB] rounded-2xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={!urlInput.trim()}
            className="px-4 py-2.5 rounded-2xl bg-[#6D5DFB] hover:bg-[#5B4BE3] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition active:scale-95 flex-shrink-0 cursor-pointer shadow-md"
          >
            {t.openOnDevice}
          </button>
        </form>

        {/* Quick presets toggle */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 text-xs text-[#A594FD] hover:text-white transition font-medium cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{showPresets ? t.hideDemos : t.chooseSample}</span>
            {showPresets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {playbackState.mediaTitle && (
            <span className="text-[11px] text-zinc-400 truncate max-w-[180px]">
              {playbackState.mediaTitle}
            </span>
          )}
        </div>

        {/* Collapsible Presets Drawer */}
        {showPresets && (
          <div className="pt-2 border-t border-white/[0.08]">
            <MediaPresets onSelectUrl={handleSelectPreset} />
          </div>
        )}
      </div>

      {/* Mode Segmented Controls: Media Controls vs TV D-Pad */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#141418] border border-white/10">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === 'media'
              ? 'bg-[#6D5DFB] text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>{t.mediaControls}</span>
        </button>
        <button
          onClick={() => setActiveTab('dpad')}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === 'dpad'
              ? 'bg-[#6D5DFB] text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t.dpadRemote}</span>
        </button>
      </div>

      {/* Main Control Panel */}
      {activeTab === 'media' ? (
        <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Timeline & Progress Bar */}
          <div className="space-y-2" dir="ltr">
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span className="text-white font-semibold">{formatTime(displayTime)}</span>
              <span>{formatTime(playbackState.duration)}</span>
            </div>

            <input
              type="range"
              min={0}
              max={playbackState.duration || 100}
              step={1}
              value={displayTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalSeekTime(val);
              }}
              onMouseUp={() => {
                if (localSeekTime !== null) {
                  onSendCommand('SEEK', localSeekTime);
                  setTimeout(() => setLocalSeekTime(null), 500);
                }
              }}
              onTouchEnd={() => {
                if (localSeekTime !== null) {
                  onSendCommand('SEEK', localSeekTime);
                  setTimeout(() => setLocalSeekTime(null), 500);
                }
              }}
              className="w-full accent-[#6D5DFB] cursor-pointer"
            />
          </div>

          {/* Primary Playback Controls with 0ms Optimistic Feedback */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 py-2">
            {/* Seek Back 10s */}
            <button
              onClick={() => handleSeekOffset(-10)}
              className="relative p-4 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-90 border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer shadow-md"
              title="Rewind 10 Seconds"
            >
              <RotateCcw className="w-6 h-6" />
              <span className="absolute bottom-1 right-2 text-[9px] font-bold text-zinc-400">10</span>
            </button>

            {/* Big Play / Pause Toggle with instantaneous state switch */}
            <button
              onClick={handleTogglePlayback}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#6D5DFB] hover:bg-[#5B4BE3] active:scale-90 text-white flex items-center justify-center transition shadow-[0_0_30px_rgba(109,93,251,0.5)] cursor-pointer focus:outline-none"
              title={currentPlaying ? 'Pause' : 'Play'}
            >
              {currentPlaying ? (
                <Pause className="w-10 h-10 fill-white" />
              ) : (
                <Play className="w-10 h-10 fill-white translate-x-1" />
              )}
            </button>

            {/* Seek Forward 10s */}
            <button
              onClick={() => handleSeekOffset(10)}
              className="relative p-4 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-90 border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer shadow-md"
              title="Fast Forward 10 Seconds"
            >
              <RotateCw className="w-6 h-6" />
              <span className="absolute bottom-1 right-2 text-[9px] font-bold text-zinc-400">10</span>
            </button>
          </div>

          {/* Volume Control Bar */}
          <div className="p-4 rounded-2xl bg-[#18181D] border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">{t.deviceVolume}</span>
              <span className="font-mono text-white">
                {currentMuted ? t.muted : `${Math.round(displayVolume * 100)}%`}
              </span>
            </div>

            <div className="flex items-center gap-3" dir="ltr">
              <button
                onClick={handleToggleMute}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-90 text-zinc-300 hover:text-white transition cursor-pointer"
                title={currentMuted ? t.unmute : t.muteAudio}
              >
                {currentMuted || displayVolume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : displayVolume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={currentMuted ? 0 : displayVolume}
                onChange={(e) => {
                  const vol = parseFloat(e.target.value);
                  setLocalVolume(vol);
                  setOptimisticMuted(false);
                  onSendCommand('SET_VOLUME', vol);
                }}
                onMouseUp={() => setLocalVolume(null)}
                onTouchEnd={() => setLocalVolume(null)}
                className="flex-1 accent-[#6D5DFB] cursor-pointer"
              />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const nextVol = Math.max(0, displayVolume - 0.1);
                    setLocalVolume(nextVol);
                    onSendCommand('VOLUME_DOWN');
                    setTimeout(() => setLocalVolume(null), 400);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 text-xs font-bold text-white transition cursor-pointer"
                  title="Volume Down"
                >
                  -
                </button>
                <button
                  onClick={() => {
                    const nextVol = Math.min(1, displayVolume + 0.1);
                    setLocalVolume(nextVol);
                    onSendCommand('VOLUME_UP');
                    setTimeout(() => setLocalVolume(null), 400);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 text-xs font-bold text-white transition cursor-pointer"
                  title="Volume Up"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons: Fullscreen & Mute */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                onSendCommand(playbackState.fullscreen ? 'EXIT_FULLSCREEN' : 'FULLSCREEN')
              }
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border font-semibold text-xs sm:text-sm transition cursor-pointer active:scale-95 ${
                playbackState.fullscreen
                  ? 'bg-[#6D5DFB]/20 border-[#6D5DFB] text-white'
                  : 'bg-[#18181D] hover:bg-[#202027] border-white/10 text-white'
              }`}
            >
              {playbackState.fullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-[#A594FD]" />
                  <span>{t.exitFullscreen}</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-[#6D5DFB]" />
                  <span>{t.fullscreen}</span>
                </>
              )}
            </button>

            <button
              onClick={handleToggleMute}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border font-semibold text-xs sm:text-sm transition cursor-pointer active:scale-95 ${
                currentMuted
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-[#18181D] hover:bg-[#202027] border-white/10 text-white'
              }`}
            >
              {currentMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-400" />
                  <span>{t.unmute}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-zinc-400" />
                  <span>{t.muteAudio}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* TV Navigation Mode (D-Pad) */
        <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
          <DPadRemote onNavigate={(dir) => onSendCommand('NAVIGATE', undefined, undefined, dir)} />
        </div>
      )}

      {/* Browser Controls Section */}
      <div className="bg-[#111114] border border-white/10 rounded-3xl p-4 shadow-xl">
        <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-3 px-1">
          {t.browserControls}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => onSendCommand('BACK')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-95 border border-white/5 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 mb-1" />
            <span className="text-[10px]">{t.back}</span>
          </button>

          <button
            onClick={() => onSendCommand('FORWARD')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-95 border border-white/5 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4 mb-1" />
            <span className="text-[10px]">{t.forward}</span>
          </button>

          <button
            onClick={() => onSendCommand('REFRESH')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-95 border border-white/5 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Refresh"
          >
            <ReloadIcon className="w-4 h-4 mb-1" />
            <span className="text-[10px]">{t.reload}</span>
          </button>

          <button
            onClick={() => onSendCommand('HOME')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#18181D] hover:bg-[#202027] active:scale-95 border border-white/5 text-[#A594FD] hover:text-white transition cursor-pointer"
            title="Home"
          >
            <Home className="w-4 h-4 mb-1" />
            <span className="text-[10px]">{t.home}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
