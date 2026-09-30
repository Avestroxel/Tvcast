import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Chrome, Puzzle, Laptop, Loader2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import type { BrowserState, DeviceInfo, RemoteCommand } from '../../types';
import { socketService, type SocketService } from '../../lib/socket';
import type { Language } from '../../lib/i18n';

const emptyState = (error: string | null = null): BrowserState => ({
  connected: false, url: '', title: '', loading: false, fullscreen: false,
  media: null, error, timestamp: Date.now(),
});

export function BrowserReceiver({ sessionId, controllerDevice, lang = 'en', service = socketService }: {
  sessionId: string;
  controllerDevice: DeviceInfo | null;
  lang?: Language;
  service?: SocketService;
}) {
  const ku = lang === 'ku';
  const [bridgeReady, setBridgeReady] = useState(false);
  const [version, setVersion] = useState('');
  const [lastState, setLastState] = useState<BrowserState>(emptyState());
  const lastStateRef = useRef<BrowserState>(emptyState());

  const publish = useCallback((state: BrowserState) => {
    lastStateRef.current = state;
    setLastState(state);
    service.sendBrowserState(sessionId, state);
  }, [service, sessionId]);

  useEffect(() => {
    const socket = service.init();
    const onCommand = (command: RemoteCommand) => {
      if (!bridgeReady) {
        publish(emptyState(ku ? 'پەیوەستکەری Chrome نەدۆزرایەوە. دایبمەزرێنە، ئایکۆنەکەی بکەرەوە و Connect This CastSync هەڵبژێرە.' : 'Chrome Browser Bridge was not found. Install it, open its icon, and choose Connect This CastSync.'));
        return;
      }
      window.postMessage({ source: 'castsync-page', type: 'COMMAND', command }, window.location.origin);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== 'castsync-extension') return;
      if (event.data.type === 'READY') {
        setBridgeReady(true);
        setVersion(typeof event.data.version === 'string' ? event.data.version : '');
        window.postMessage({ source: 'castsync-page', type: 'PING' }, window.location.origin);
      }
      if (event.data.type === 'STATE' && event.data.state) {
        setBridgeReady(true);
        publish({ ...lastStateRef.current, ...event.data.state, connected: true, timestamp: Date.now() });
      }
      if (event.data.type === 'ERROR') {
        publish({ ...lastStateRef.current, connected: true, error: String(event.data.error || 'Browser command failed.'), timestamp: Date.now() });
      }
    };
    window.addEventListener('message', onMessage);
    socket.on('execute_command', onCommand);
    let attempts = 0;
    const poll = () => {
      attempts += 1;
      window.postMessage({ source: 'castsync-page', type: bridgeReady ? 'SNAPSHOT' : 'PING' }, window.location.origin);
      if (attempts === 4 && !bridgeReady) publish(emptyState(ku ? 'پەیوەستکەری Chrome چالاک نییە.' : 'Chrome Browser Bridge is not active.'));
    };
    poll();
    const timer = window.setInterval(poll, bridgeReady ? 3000 : 1800);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      socket.off('execute_command', onCommand);
    };
  }, [bridgeReady, ku, publish, service]);

  return <main className="min-h-[100dvh] bg-[#07080b] p-5 text-white sm:p-8">
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-5xl flex-col">
      <header className="flex items-center justify-between border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#6d5dfb]/12 text-[#b5adff]"><Chrome size={21} /></span><div><h1 className="font-semibold tracking-tight">CastSync Browser</h1><p className="mt-0.5 text-xs text-zinc-500">{ku ? 'بڕۆسەری لاپتۆپ بە مۆبایل کۆنترۆڵ بکە' : 'Your computer browser, controlled by your phone'}</p></div></div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${bridgeReady ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${bridgeReady ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />{bridgeReady ? (ku ? 'ئامادەیە' : 'Ready') : (ku ? 'چاوەڕوانی Extension' : 'Waiting for extension')}</div>
      </header>

      <section className="flex flex-1 items-center justify-center py-10">
        {bridgeReady ? <div className="w-full max-w-2xl text-center">
          <div className="relative mx-auto mb-7 grid h-28 w-28 place-items-center rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.06]"><Laptop size={43} className="text-emerald-300" /><CheckCircle2 size={25} className="absolute -bottom-2 -right-2 rounded-full bg-[#07080b] text-emerald-400" /></div>
          <p className="eyebrow">{ku ? 'پەیوەندی سەرکەوتووە' : 'BRIDGE CONNECTED'}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{lastState.title || (ku ? 'لە مۆبایلەکەت دەست پێ بکە' : 'Start from your phone')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-500">{lastState.url || (ku ? 'لە مۆبایلەکەت سێرچ بکە. پەڕەکە لە تابێکی ڕاستەقینەی Chrome لەم لاپتۆپە دەکرێتەوە.' : 'Search from your phone. The page opens in a real Chrome tab on this computer.')}</p>
          <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-3 text-xs text-zinc-400"><div className="rounded-2xl border border-white/[0.06] p-4"><Smartphone size={18} className="mx-auto mb-2 text-[#b5adff]" />{ku ? 'کۆنترۆڵی مۆبایل' : 'Phone control'}</div><div className="rounded-2xl border border-white/[0.06] p-4"><Chrome size={18} className="mx-auto mb-2 text-[#b5adff]" />{ku ? 'تابی ڕاستەقینە' : 'Real Chrome tab'}</div><div className="rounded-2xl border border-white/[0.06] p-4"><ShieldCheck size={18} className="mx-auto mb-2 text-[#b5adff]" />{ku ? 'لەسەر ئامێرەکەت' : 'On your device'}</div></div>
          {lastState.loading && <p className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500"><Loader2 size={14} className="animate-spin" />{ku ? 'پەڕەکە بار دەکرێت…' : 'Page is loading…'}</p>}
          {lastState.error && <p className="mx-auto mt-5 max-w-lg rounded-xl bg-amber-300/[0.06] p-3 text-sm text-amber-200">{lastState.error}</p>}
          {version && <p className="mt-6 text-[11px] text-zinc-700">Browser Bridge v{version}</p>}
        </div> : <div className="w-full max-w-xl rounded-[2rem] border border-white/[0.08] bg-[#101116] p-6 sm:p-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><Puzzle size={26} /></span>
          <p className="eyebrow mt-6">{ku ? 'هەنگاوێک ماوە' : 'ONE STEP LEFT'}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{ku ? 'پەیوەستکەری Chrome دابمەزرێنە' : 'Install the Chrome Browser Bridge'}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{ku ? 'بۆ کردنەوەی وێبسایتەکان لە تابی ڕاستەقینە و fullscreen ـی پاک، فولدەری chrome-extension لە Chrome بە Load unpacked دابمەزرێنە.' : 'To open sites in a real tab and use clean fullscreen, load the chrome-extension folder in Chrome as an unpacked extension.'}</p>
          <ol className="mt-6 space-y-3 text-sm text-zinc-300" dir="ltr"><li className="rounded-xl bg-black/20 p-3">1. Open <strong>chrome://extensions</strong></li><li className="rounded-xl bg-black/20 p-3">2. Turn on <strong>Developer mode</strong></li><li className="rounded-xl bg-black/20 p-3">3. Choose <strong>Load unpacked</strong> → <strong>chrome-extension</strong></li><li className="rounded-xl bg-black/20 p-3">4. Click the extension icon → <strong>Connect This CastSync</strong></li></ol>
          <button onClick={() => window.location.reload()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"><RefreshCw size={16} />{ku ? 'پاش پەیوەستکردن نوێی بکەرەوە' : 'Refresh after connecting'}</button>
        </div>}
      </section>
      <footer className="border-t border-white/[0.06] pt-4 text-center text-xs text-zinc-600">{controllerDevice ? `${ku ? 'کۆنترۆڵ دەکرێت بە' : 'Controlled by'} ${controllerDevice.name}` : (ku ? 'چاوەڕوانی مۆبایل' : 'Waiting for phone')}</footer>
    </div>
  </main>;
}
