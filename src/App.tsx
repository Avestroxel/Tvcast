/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/common/Header';
import { ModeSelection } from './components/home/ModeSelection';
import { ReceiverPairing } from './components/receiver/ReceiverPairing';
import { ReceiverConnected } from './components/receiver/ReceiverConnected';
import { ReceiverPlayer } from './components/receiver/ReceiverPlayer';
import { ControllerPairing } from './components/controller/ControllerPairing';
import { RemoteController } from './components/controller/RemoteController';
import { SplitSimulator } from './components/simulator/SplitSimulator';
import { detectDevice } from './lib/device';
import { socketService } from './lib/socket';
import { getStoredLanguage, setStoredLanguage, Language, translations } from './lib/i18n';
import {
  DeviceInfo,
  PairingSession,
  PlaybackState,
  ConnectionStatus,
  RemoteAction,
  NavDirection,
} from './types';

export default function App() {
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo>(() => detectDevice());
  const [mode, setMode] = useState<'home' | 'receiver' | 'controller'>('home');
  const [receiverStep, setReceiverStep] = useState<'pairing' | 'connected' | 'player'>('pairing');
  const [session, setSession] = useState<PairingSession | null>(null);
  const [peerDevice, setPeerDevice] = useState<DeviceInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [showSplitSimulator, setShowSplitSimulator] = useState<boolean>(false);

  const initialJoinAttempted = useRef<boolean>(false);

  // Playback state on controller
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playing: false,
    currentTime: 0,
    duration: 596,
    volume: 0.8,
    muted: false,
    fullscreen: false,
    currentUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    mediaTitle: 'Big Buck Bunny (1080p Sample)',
    contentType: 'video',
    supportsRemoteMedia: true,
    lastUpdated: Date.now(),
  });

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ku' : 'en';
    setLang(nextLang);
    setStoredLanguage(nextLang);
  };

  // Controller joins by Session ID (from QR Code or URL)
  const handleJoinById = useCallback(async (sessionId: string) => {
    setIsPairing(true);
    setPairingError(null);
    try {
      const activeSession = await socketService.joinById(sessionId, currentDevice);
      setSession(activeSession);
      setPeerDevice(activeSession.receiver);
      setConnectionStatus('connected');
      setMode('controller');
      sessionStorage.setItem('castsync_session', JSON.stringify({ sessionId, role: 'controller' }));
    } catch (err: any) {
      setPairingError(err.message || 'Invalid or expired session');
    } finally {
      setIsPairing(false);
    }
  }, [currentDevice]);

  // Check URL query parameters for direct QR scan link: `?session=ROOM_ID&role=controller`
  useEffect(() => {
    if (initialJoinAttempted.current) return;
    initialJoinAttempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const roleParam = params.get('role');

    if (sessionParam && roleParam === 'controller') {
      setMode('controller');
      handleJoinById(sessionParam);
    }
  }, [handleJoinById]);

  // Register PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  // Socket event setup
  useEffect(() => {
    const socket = socketService.init();

    const handleConnect = () => {
      if (session) {
        setConnectionStatus('connected');
      }
    };

    const handleDisconnect = () => {
      if (session) {
        setConnectionStatus('reconnecting');
      }
    };

    // Controller connected (received by Controlled Device)
    const handleControllerConnected = ({ controller }: { controller: DeviceInfo }) => {
      setPeerDevice(controller);
      setConnectionStatus('connected');
      setReceiverStep('connected');
    };

    // Peer disconnected with grace period
    const handlePeerDisconnected = ({ role, message }: { role: string; message: string }) => {
      setConnectionStatus('reconnecting');
    };

    // State update received on Controller from Controlled Device
    const handlePlaybackStateUpdated = (newState: PlaybackState) => {
      setPlaybackState(newState);
    };

    const handleSessionExpired = () => {
      setConnectionStatus('expired');
      setPairingError(lang === 'ku' ? 'کاتی کۆدەکە بەسەرچوو. تکایە کۆدێکی نوێ دروست بکە.' : 'Pairing session expired. Please generate a new code.');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('controller_connected', handleControllerConnected);
    socket.on('peer_disconnected', handlePeerDisconnected);
    socket.on('playback_state_updated', handlePlaybackStateUpdated);
    socket.on('session_expired', handleSessionExpired);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('controller_connected', handleControllerConnected);
      socket.off('peer_disconnected', handlePeerDisconnected);
      socket.off('playback_state_updated', handlePlaybackStateUpdated);
      socket.off('session_expired', handleSessionExpired);
    };
  }, [session, lang]);

  // Start Receiver mode: create pairing session
  const handleStartReceiver = useCallback(async () => {
    setIsGenerating(true);
    setMode('receiver');
    setReceiverStep('pairing');
    setConnectionStatus('connecting');

    try {
      const newSession = await socketService.createSession(currentDevice);
      setSession(newSession);
      setConnectionStatus('idle');
      sessionStorage.setItem('castsync_session', JSON.stringify({ sessionId: newSession.sessionId, role: 'receiver' }));
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setConnectionStatus('disconnected');
    } finally {
      setIsGenerating(false);
    }
  }, [currentDevice]);

  // Controller joins by 6-digit code
  const handleJoinByCode = async (code: string) => {
    setIsPairing(true);
    setPairingError(null);
    try {
      const activeSession = await socketService.joinByCode(code, currentDevice);
      setSession(activeSession);
      setPeerDevice(activeSession.receiver);
      setConnectionStatus('connected');
      setMode('controller');
      sessionStorage.setItem('castsync_session', JSON.stringify({ sessionId: activeSession.sessionId, role: 'controller' }));
    } catch (err: any) {
      setPairingError(err.message || (lang === 'ku' ? 'کۆدەکە هەڵەیە یان بەسەرچووە' : 'Invalid or expired pairing code'));
    } finally {
      setIsPairing(false);
    }
  };

  // Controller sends command
  const handleSendCommand = (
    action: RemoteAction,
    value?: any,
    url?: string,
    direction?: NavDirection
  ) => {
    if (!session) return;
    socketService.sendCommand(session.sessionId, {
      type: 'command',
      action,
      value,
      url,
      direction,
    });
  };

  // Reset / Disconnect
  const handleExit = () => {
    if (session) {
      socketService.leaveSession(
        session.sessionId,
        mode === 'receiver' ? 'receiver' : 'controller'
      );
    }
    sessionStorage.removeItem('castsync_session');
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setMode('home');
    setSession(null);
    setPeerDevice(null);
    setReceiverStep('pairing');
    setConnectionStatus('idle');
    setPairingError(null);
  };

  return (
    <div
      dir={lang === 'ku' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#09090B] text-white flex flex-col selection:bg-[#6D5DFB]/30"
    >
      {/* Universal Top Header */}
      <Header
        mode={mode}
        peerDevice={peerDevice}
        connectionStatus={connectionStatus}
        sessionId={session?.sessionId}
        lang={lang}
        onToggleLang={toggleLanguage}
        onExit={handleExit}
        onOpenSplitDemo={() => setShowSplitSimulator(true)}
      />

      {/* Main Content Router */}
      <main className="flex-1 flex flex-col">
        {mode === 'home' && (
          <ModeSelection
            currentDevice={currentDevice}
            lang={lang}
            onSelectMode={(selectedMode) => {
              if (selectedMode === 'receiver') {
                handleStartReceiver();
              } else {
                setMode('controller');
              }
            }}
            onOpenSplitDemo={() => setShowSplitSimulator(true)}
          />
        )}

        {/* Receiver Flow */}
        {mode === 'receiver' && (
          <>
            {receiverStep === 'pairing' && (
              <ReceiverPairing
                session={session}
                receiverDevice={currentDevice}
                isGenerating={isGenerating}
                lang={lang}
                onRefreshSession={handleStartReceiver}
              />
            )}

            {receiverStep === 'connected' && (
              <ReceiverConnected
                controllerDevice={peerDevice}
                onContinue={() => setReceiverStep('player')}
              />
            )}

            {receiverStep === 'player' && session && (
              <ReceiverPlayer
                sessionId={session.sessionId}
                controllerDevice={peerDevice}
                lang={lang}
                onDisconnect={handleExit}
              />
            )}
          </>
        )}

        {/* Controller Flow */}
        {mode === 'controller' && (
          <>
            {connectionStatus !== 'connected' || !session ? (
              <ControllerPairing
                controllerDevice={currentDevice}
                isPairing={isPairing}
                pairingError={pairingError}
                lang={lang}
                onJoinByCode={handleJoinByCode}
                onJoinById={handleJoinById}
              />
            ) : (
              <RemoteController
                sessionId={session.sessionId}
                controlledDevice={peerDevice}
                playbackState={playbackState}
                lang={lang}
                onSendCommand={handleSendCommand}
                onDisconnect={handleExit}
              />
            )}
          </>
        )}
      </main>

      {/* Split-Screen Simulator Modal for local testing */}
      {showSplitSimulator && (
        <SplitSimulator onClose={() => setShowSplitSimulator(false)} />
      )}
    </div>
  );
}
