import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Tv, Sparkles, X, RotateCcw } from 'lucide-react';
import { ReceiverPlayer } from '../receiver/ReceiverPlayer';
import { RemoteController } from '../controller/RemoteController';
import { DeviceInfo, PlaybackState, RemoteAction, NavDirection } from '../../types';
import { SocketService } from '../../lib/socket';

interface SplitSimulatorProps {
  onClose: () => void;
}

export const SplitSimulator: React.FC<SplitSimulatorProps> = ({ onClose }) => {
  const [sessionId, setSessionId] = useState<string>('');
  const [receiverService, setReceiverService] = useState<SocketService | null>(null);
  const controllerService = useRef<SocketService | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  const receiverDevice: DeviceInfo = {
    id: 'sim_tv_1',
    name: 'Samsung OLED TV (Simulated)',
    type: 'tv',
    browser: 'Smart TV Browser',
    os: 'Tizen OS',
  };

  const controllerDevice: DeviceInfo = {
    id: 'sim_phone_1',
    name: 'iPhone 16 Pro (Simulated)',
    type: 'mobile',
    browser: 'Mobile Safari',
    os: 'iOS',
  };

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    fullscreen: false,
    currentUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    mediaTitle: 'Big Buck Bunny (1080p Sample)',
    contentType: 'video',
    supportsRemoteMedia: true,
    lastUpdated: Date.now(),
  });

  useEffect(() => {
    // Two independent clients preserve the same role separation as real devices.
    let active = true;
    let roomId = '';
    const receiver = new SocketService(false);
    const controller = new SocketService(false);
    controllerService.current = controller;
    setReceiverService(receiver);
    const onState = (state: PlaybackState) => { if (active) setPlaybackState(state); };
    controller.init().on('playback_state_updated', onState);
    async function setupSim() {
      try {
        const session = await receiver.createSession(receiverDevice);
        roomId = session.sessionId;
        if (!active) { receiver.leaveSession(roomId, 'receiver'); receiver.disconnect(); return; }
        setSessionId(roomId);
        await controller.joinById(roomId, controllerDevice);
        if (active) setIsReady(true);
      } catch (error) {
        if (active) setSetupError(error instanceof Error ? error.message : 'Unable to start simulator');
      }
    }
    void setupSim();
    return () => {
      active = false;
      if (roomId) receiver.leaveSession(roomId, 'receiver');
      controller.getSocket()?.off('playback_state_updated', onState);
      receiver.disconnect();
      controller.disconnect();
    };
  }, []);

  const handleSendCommand = (action: RemoteAction, value?: any, url?: string, direction?: NavDirection) => {
    if (!sessionId) return;
    controllerService.current?.sendCommand(sessionId, {
      type: 'command',
      action,
      value,
      url,
      direction,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B] flex flex-col overflow-hidden">
      {/* Simulator top header */}
      <div className="h-14 border-b border-white/10 bg-[#111114] px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#6D5DFB]/15 text-[#A594FD] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cross-Device Simulator (Real WebSockets)</span>
          </div>
          <span className="text-xs text-zinc-400 hidden sm:inline">
            Both devices linked via room <strong className="text-white font-mono">{sessionId || '...'}</strong>
          </span>
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Exit Simulator</span>
        </button>
      </div>

      {/* Main Split Body: Left = Controlled TV, Right = Mobile Controller */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Controlled TV Screen (Left 7 Cols) */}
        <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col bg-black relative">
          <div className="p-3 bg-[#141418] border-b border-white/10 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-emerald-400" />
              <strong className="text-white">Controlled Screen</strong>
              <span className="text-zinc-500">(Samsung OLED TV)</span>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Receiving Commands
            </span>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {isReady && sessionId ? (
              <ReceiverPlayer
                sessionId={sessionId}
                service={receiverService!}
                controllerDevice={controllerDevice}
                onDisconnect={onClose}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                {setupError || 'Initializing TV simulator socket...'}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Remote Controller (Right 5 Cols) */}
        <div className="lg:col-span-5 bg-[#0D0D10] flex flex-col overflow-y-auto">
          <div className="p-3 bg-[#141418] border-b border-white/10 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#6D5DFB]" />
              <strong className="text-white">Remote Controller</strong>
              <span className="text-zinc-500">(iPhone 16 Pro)</span>
            </div>
            <span className="text-[11px] text-[#A594FD] bg-[#6D5DFB]/10 px-2 py-0.5 rounded">
              Sending Commands
            </span>
          </div>

          <div className="p-4 flex-1">
            {isReady && sessionId ? (
              <RemoteController
                sessionId={sessionId}
                controlledDevice={receiverDevice}
                service={controllerService.current!}
                playbackState={playbackState}
                onSendCommand={handleSendCommand}
                onDisconnect={onClose}
              />
            ) : (
              <div className="py-20 text-center text-zinc-400 text-sm">
                {setupError || 'Pairing remote controller...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
