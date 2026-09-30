import React from 'react';
import { Cast, ExternalLink, Power, Wifi, WifiOff, Languages } from 'lucide-react';
import { DeviceBadge } from './DeviceBadge';
import { PWAInstallButton } from './PWAInstallButton';
import { ConnectionStatus, DeviceInfo } from '../../types';
import { Language, translations } from '../../lib/i18n';

interface HeaderProps {
  mode: 'home' | 'receiver' | 'controller';
  peerDevice?: DeviceInfo | null;
  connectionStatus?: ConnectionStatus;
  sessionId?: string;
  lang?: Language;
  onToggleLang?: () => void;
  onExit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  peerDevice,
  connectionStatus = 'idle',
  sessionId,
  lang = 'en',
  onToggleLang,
  onExit,
}) => {
  const t = translations[lang] || translations.en;

  return (
    <header className="app-header sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#09090B]/85 backdrop-blur-xl px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Logo and Mode */}
        <div className="flex items-center gap-3">
          <div
            onClick={mode !== 'home' ? onExit : undefined}
            className={`flex items-center gap-2.5 ${mode !== 'home' ? 'cursor-pointer hover:opacity-85' : ''}`}
            title={mode !== 'home' ? 'Return to Home' : 'CastSync'}
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#6D5DFB]/15 border border-[#6D5DFB]/30 text-[#6D5DFB] ">
              <Cast className="h-5 w-5" />
              {connectionStatus === 'connected' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">CastSync</span>
                {mode !== 'home' && (
                  <span className="hidden sm:inline-block rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                    {mode === 'receiver' ? (lang === 'ku' ? 'ئامێری کۆنتڕۆڵکراو' : 'Controlled Device') : (lang === 'ku' ? 'کۆنتڕۆڵ' : 'Controller')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                {t.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Peer Device details */}
        {peerDevice && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {mode === 'receiver' ? t.controlledBy + ':' : (lang === 'ku' ? 'بەستراوەتەوە بە:' : 'Connected to:')}
            </span>
            <DeviceBadge
              name={peerDevice.name}
              type={peerDevice.type}
              status={connectionStatus === 'connected' ? 'online' : 'reconnecting'}
              size="sm"
            />
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          {onToggleLang && (
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
              title="Change language / گۆڕینی زمان"
            >
              <Languages className="w-3.5 h-3.5 text-[#6D5DFB]" />
              <span>{lang === 'en' ? 'کوردی' : 'EN'}</span>
            </button>
          )}

          {/* Split Screen / New Window simulator button */}
          {mode === 'receiver' && sessionId && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/?session=${sessionId}&role=controller`;
                window.open(url, '_blank', 'width=420,height=820');
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#6D5DFB]/40 bg-[#6D5DFB]/15 hover:bg-[#6D5DFB]/25 text-[#A594FD] text-xs font-medium transition shadow-sm cursor-pointer"
              title="Open Controller in new popup window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.simulateRemote}</span>
            </button>
          )}

          {/* Connection Status Indicator */}
          {mode !== 'home' && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium hidden xs:inline">{t.online}</span>
                </>
              ) : connectionStatus === 'reconnecting' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-400 font-medium">{t.reconnecting}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-400 font-medium">{t.waiting}</span>
                </>
              )}
            </div>
          )}

          <PWAInstallButton />

          {/* Exit / Disconnect button */}
          {mode !== 'home' && onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 active:scale-95 transition cursor-pointer"
              title="Disconnect and return to mode selection"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.disconnect}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
