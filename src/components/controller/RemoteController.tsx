import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Chrome, CornerDownLeft, ExternalLink, Home, Keyboard,
  Loader2, Maximize2, Minimize2, MousePointer2, Pause, Play, Plus, RefreshCw,
  Search, Send, Tv, Volume2, VolumeX, X,
} from 'lucide-react';
import type { BrowserState, ConnectionStatus, DeviceInfo, NavDirection, RemoteAction } from '../../types';
import type { Language } from '../../lib/i18n';
import type { SocketService } from '../../lib/socket';
import { DPadRemote } from './DPadRemote';

interface RemoteControllerProps {
  sessionId: string;
  controlledDevice: DeviceInfo | null;
  browserState?: BrowserState;
  connectionStatus?: ConnectionStatus;
  onSendCommand: (action: RemoteAction, value?: any, url?: string, direction?: NavDirection) => void;
  onDisconnect: () => void;
  lang?: Language;
  service?: SocketService;
}
const emptyBrowser: BrowserState = { connected: false, url: '', title: '', loading: false, fullscreen: false, media: null, timestamp: 0 };

function destination(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) {
    try { return new URL(clean).href; } catch { return null; }
  }
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(?:\/|$)/i.test(clean)) return `http://${clean}`;
  if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/\S*)?$/i.test(clean)) return `https://${clean}`;
  return `https://www.google.com/search?q=${encodeURIComponent(clean)}`;
}
function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const seconds = Math.floor(value % 60);
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const RemoteController: React.FC<RemoteControllerProps> = ({
  controlledDevice, browserState = emptyBrowser, connectionStatus = 'connected', onSendCommand, onDisconnect, lang = 'en',
}) => {
  const ku = lang === 'ku';
  const [omnibox, setOmnibox] = useState('');
  const [typing, setTyping] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showDpad, setShowDpad] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const omniboxFocused = useRef(false);
  const media = browserState.media;
  const offline = connectionStatus !== 'connected';

  useEffect(() => {
    if (!omniboxFocused.current && browserState.url) setOmnibox(browserState.url);
  }, [browserState.url]);
  useEffect(() => { setImageReady(false); }, [browserState.screenshot]);

  const host = useMemo(() => {
    try { return new URL(browserState.url).hostname; } catch { return ''; }
  }, [browserState.url]);

  const open = (value: string) => {
    const url = destination(value);
    if (!url || offline) return;
    onSendCommand('OPEN_URL', undefined, url);
    setOmnibox(url);
  };
  const clickPreview = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight || offline) return;
    const rect = image.getBoundingClientRect();
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const boxRatio = rect.width / rect.height;
    const shownWidth = boxRatio > imageRatio ? rect.height * imageRatio : rect.width;
    const shownHeight = boxRatio > imageRatio ? rect.height : rect.width / imageRatio;
    const left = rect.left + (rect.width - shownWidth) / 2;
    const top = rect.top + (rect.height - shownHeight) / 2;
    const x = (event.clientX - left) / shownWidth; const y = (event.clientY - top) / shownHeight;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onSendCommand('POINTER', { x, y });
  };
  const sendText = () => {
    if (!typing || offline) return;
    onSendCommand('TYPE_TEXT', typing); setTyping('');
  };

  return <main className="min-h-[calc(100dvh-65px)] bg-[#090a0e] px-3 py-4 text-white sm:px-6 sm:py-7">
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-[1.7rem] border border-white/[0.07] bg-[#111218] shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#6d5dfb]/12 text-[#b5adff]"><Chrome size={20} />{browserState.connected && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111218] bg-emerald-400" />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{controlledDevice?.name || (ku ? 'لاپتۆپ' : 'Computer')}</p><p className={`mt-0.5 text-[11px] ${browserState.connected ? 'text-emerald-400' : 'text-amber-300'}`}>{browserState.connected ? (ku ? 'Chrome ئامادەیە' : 'Chrome bridge ready') : (ku ? 'Extension پەیوەست نییە' : 'Extension not connected')}</p></div></div>
          <button onClick={onDisconnect} aria-label={ku ? 'پەیوەندی ببڕە' : 'Disconnect'} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
        </div>

        <div className="border-b border-white/[0.06] p-3 sm:p-4">
          <form onSubmit={(event) => { event.preventDefault(); open(omnibox); }} className="flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#090a0e] p-1.5 focus-within:border-[#6d5dfb]/60">
            {browserState.loading ? <Loader2 size={17} className="ms-2 shrink-0 animate-spin text-[#b5adff]" /> : <Search size={17} className="ms-2 shrink-0 text-zinc-600" />}
            <input value={omnibox} onChange={(event) => setOmnibox(event.target.value)} onFocus={() => { omniboxFocused.current = true; }} onBlur={() => { omniboxFocused.current = false; }} dir="ltr" autoCapitalize="none" autoCorrect="off" enterKeyHint="go" placeholder={ku ? 'لە Google بگەڕێ یان ناونیشان بنووسە…' : 'Search Google or type an address…'} aria-label={ku ? 'گەڕان لە Google' : 'Google search or address'} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600" />
            <button disabled={!omnibox.trim() || offline} aria-label={ku ? 'بگەڕێ' : 'Go'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#6d5dfb] text-white disabled:opacity-30"><ArrowRight size={18} /></button>
          </form>
          <div className="mt-3 flex items-center gap-1.5">
            <button disabled={offline} onClick={() => onSendCommand('BACK')} className="browser-icon" aria-label="Back"><ArrowLeft size={17} /></button>
            <button disabled={offline} onClick={() => onSendCommand('FORWARD')} className="browser-icon" aria-label="Forward"><ArrowRight size={17} /></button>
            <button disabled={offline} onClick={() => onSendCommand('REFRESH')} className="browser-icon" aria-label="Reload"><RefreshCw size={16} /></button>
            <button disabled={offline} onClick={() => onSendCommand('HOME')} className="browser-icon" aria-label="Google home"><Home size={16} /></button>
            <span className="flex-1" />
            <button disabled={offline} onClick={() => onSendCommand('NEW_TAB')} className="browser-icon" aria-label="New tab"><Plus size={17} /></button>
            <button disabled={offline || !browserState.url} onClick={() => onSendCommand(browserState.fullscreen ? 'EXIT_FULLSCREEN' : 'FULLSCREEN')} className={`browser-icon ${browserState.fullscreen ? '!bg-[#6d5dfb]/15 !text-[#b5adff]' : ''}`} aria-label="Fullscreen">{browserState.fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>
        </div>

        <div className="relative aspect-[16/10] min-h-[230px] overflow-hidden bg-black sm:min-h-[360px]">
          {browserState.screenshot ? <>
            {!imageReady && <div className="absolute inset-0 grid place-items-center"><Loader2 size={22} className="animate-spin text-zinc-600" /></div>}
            <img src={browserState.screenshot} onLoad={() => setImageReady(true)} onClick={clickPreview} alt={ku ? 'پێشبینینی بڕۆسەری لاپتۆپ' : 'Live computer browser preview'} draggable={false} className={`h-full w-full cursor-crosshair object-contain transition-opacity ${imageReady ? 'opacity-100' : 'opacity-0'}`} />
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[10px] text-zinc-300 backdrop-blur"><MousePointer2 size={12} />{ku ? 'بۆ کلیککردن دەست لە وێنەکە بدە' : 'Tap the preview to click'}</div>
          </> : <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"><span className="mb-4 grid h-16 w-16 place-items-center rounded-3xl border border-white/[0.07] bg-white/[0.03] text-zinc-500"><Tv size={27} /></span><h2 className="text-lg font-semibold">{browserState.connected ? (ku ? 'لە Google بگەڕێ' : 'Start with a Google search') : (ku ? 'پەیوەستکەری Chrome لە لاپتۆپ چالاک بکە' : 'Enable Browser Bridge on the computer')}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">{browserState.error || (browserState.connected ? (ku ? 'ئەنجامەکان لە Chrome ـی لاپتۆپ دەکرێنەوە و لێرە پێشبینییان دەبینیت.' : 'Results open in the computer’s real Chrome tab and appear here as a remote preview.') : (ku ? 'لە لاپتۆپ chrome-extension دابمەزرێنە، پاشان پەڕەکە refresh بکەرەوە.' : 'Install the chrome-extension folder on the computer, then refresh the receiver page.'))}</p></div>}
        </div>

        {(browserState.title || browserState.url) && <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{browserState.title || host}</p><p className="mt-0.5 truncate text-[11px] text-zinc-600" dir="ltr">{browserState.url}</p></div>{browserState.url && <button onClick={() => setOmnibox(browserState.url)} aria-label="Copy current address to search bar" className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 hover:bg-white/5"><ExternalLink size={15} /></button>}</div>}
      </section>

      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.06] bg-[#111218] p-2">
        <button onClick={() => { setShowDpad(false); setShowKeyboard(!showKeyboard); }} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm ${showKeyboard ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-white'}`}><Keyboard size={17} />{ku ? 'نووسین لە پەڕە' : 'Type on page'}</button>
        <button onClick={() => { setShowKeyboard(false); setShowDpad(!showDpad); }} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm ${showDpad ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-white'}`}><CornerDownLeft size={17} />{ku ? 'گەڕانی دوگمەیی' : 'D-pad'}</button>
      </section>

      {showKeyboard && <section className="rounded-[1.5rem] border border-white/[0.07] bg-[#111218] p-4"><p className="mb-3 text-xs leading-5 text-zinc-500">{ku ? 'سەرەتا لە پێشبینینەکە خانەی نووسین هەڵبژێرە، پاشان لێرە بنووسە.' : 'First tap a text field in the preview, then type here.'}</p><form onSubmit={(event) => { event.preventDefault(); sendText(); }} className="flex gap-2"><input value={typing} onChange={(event) => setTyping(event.target.value)} placeholder={ku ? 'دەق بنووسە…' : 'Type text…'} className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#090a0e] px-3 py-3 text-sm outline-none focus:border-[#6d5dfb]/60" /><button disabled={!typing || offline} className="grid w-12 place-items-center rounded-xl bg-white text-black disabled:opacity-30"><Send size={16} /></button></form></section>}
      {showDpad && <section className="rounded-[1.5rem] border border-white/[0.07] bg-[#111218] p-4"><DPadRemote onNavigate={(direction) => {
        if (direction === 'back') onSendCommand('BACK');
        else if (direction === 'home') onSendCommand('HOME');
        else onSendCommand('NAVIGATE', undefined, undefined, direction);
      }} /></section>}

      {media && <section className="rounded-[1.5rem] border border-white/[0.07] bg-[#111218] p-4 sm:p-5">
        <div className="flex items-center gap-4"><button disabled={offline} onClick={() => onSendCommand('TOGGLE_PLAYBACK')} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black shadow-lg">{media.playing ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" className="translate-x-0.5" />}</button><div className="min-w-0 flex-1"><div className="mb-2 flex justify-between font-mono text-[10px] text-zinc-500"><span>{formatTime(media.currentTime)}</span><span>{formatTime(media.duration)}</span></div><input type="range" min={0} max={media.duration || 100} value={Math.min(media.currentTime, media.duration || 100)} onChange={(event) => onSendCommand('SEEK', Number(event.target.value))} className="w-full" /></div><button disabled={offline} onClick={() => onSendCommand(media.muted ? 'UNMUTE' : 'MUTE')} className="browser-icon">{media.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div>
      </section>}

      <p className="px-3 text-center text-[11px] leading-5 text-zinc-700">{ku ? 'پەڕەکە و کوکییەکانی لە Chrome ـی خۆی لاپتۆپ دەکرێنەوە. Fullscreen پەنجەرە و گەورەترین ڤیدیۆ یان پڵەیەر پڕ دەکات.' : 'Pages and their cookies stay in the computer’s Chrome profile. Fullscreen expands the browser window and the largest video or player.'}</p>
    </div>
  </main>;
};
