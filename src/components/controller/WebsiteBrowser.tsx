import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe, Loader2, Tv, Film, ExternalLink } from 'lucide-react';
import { socketService, type SocketService } from '../../lib/socket';
import type { WebsitePage } from '../../lib/media-source';
import type { Language } from '../../lib/i18n';

export function WebsiteBrowser({ onCast, disabled, lang = 'en', service = socketService }: {
  onCast: (url: string, kind: 'video' | 'youtube' | 'vimeo') => void; disabled: boolean; lang?: Language; service?: SocketService;
}) {
  const ku = lang === 'ku';
  const [address, setAddress] = useState('');
  const [page, setPage] = useState<WebsitePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const history = useRef<string[]>([]);
  const [index, setIndex] = useState(-1);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function browse(value: string, targetIndex?: number) {
    if (!value.trim() || disabled) return;
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (url.protocol !== 'https:') throw new Error();
    } catch { setError(ku ? 'لینکی HTTPS ـی وێبسایت داخڵ بکە.' : 'Enter an HTTPS website URL.'); return; }
    const credentials = service.sessionCredentials();
    if (!credentials) { setError(ku ? 'سەرەتا دیڤایسەکان پەیوەست بکە.' : 'Pair your devices first.'); return; }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(''); setSent('');
    try {
      const response = await fetch('/api/browse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, url: url.href }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open this website.');
      setPage(data); setAddress(data.url);
      if (targetIndex === undefined) {
        history.current = [...history.current.slice(0, index + 1), data.url];
        setIndex(history.current.length - 1);
      } else setIndex(targetIndex);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to open this website.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const button = 'rounded-xl px-3 py-3 bg-[#18181D] border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed';
  return <section className="space-y-4 rounded-3xl border border-white/10 bg-[#111114] p-4 sm:p-5">
    <div className="flex items-center gap-2 font-semibold"><Globe size={19} className="text-[#A594FD]" />{ku ? 'گەڕان لە وێبسایت' : 'Browse websites'}</div>
    <p className="text-xs text-zinc-400 leading-relaxed">{ku ? 'وێبسایتێک بکەرەوە، پەڕەکان بگەڕێ و ڤیدیۆیەک بۆ TV هەڵبژێرە. لینکی پەڕەی ڤیدیۆی YouTube و Vimeo ـیش بەکار دێت.' : 'Open a website, follow its page links, and choose a video for your screen. YouTube and Vimeo video page links work too.'}</p>
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void browse(address); }}>
      <input aria-label={ku ? 'لینکی وێبسایت' : 'Website address'} dir="ltr" type="text" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://example.com" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#18181D] px-3 py-3 text-sm outline-none focus:border-[#6D5DFB]" />
      <button disabled={loading || disabled || !address.trim()} className={`${button} !bg-[#6D5DFB] font-semibold text-sm`} type="submit">{loading ? <Loader2 size={18} className="animate-spin" /> : ku ? 'بیکەرەوە' : 'Browse'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    {sent && <p role="status" className="text-sm text-emerald-300">{ku ? 'نێردرا بۆ دیڤایسی پەیوەستکراو: ' : 'Sent to your connected screen: '}{sent}</p>}
    {page && <div aria-busy={loading} className={`space-y-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-2 border-t border-white/10 pt-3">
        <button className={button} aria-label="Previous page" disabled={index <= 0 || disabled} onClick={() => void browse(history.current[index - 1], index - 1)}><ArrowLeft size={16} /></button>
        <button className={button} aria-label="Next page" disabled={index >= history.current.length - 1 || disabled} onClick={() => void browse(history.current[index + 1], index + 1)}><ArrowRight size={16} /></button>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{page.title}</h3><p className="truncate text-xs text-zinc-500" dir="ltr">{new URL(page.url).hostname}</p></div>
        <a className={button} href={page.url} target="_blank" rel="noopener noreferrer" aria-label="Open original website"><ExternalLink size={16} /></a>
      </div>
      {page.videos.length > 0 && <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-zinc-400">{ku ? 'ڤیدیۆکان' : 'Choose a video'}</h4>
        {page.videos.map((video) => <button key={video.url} disabled={disabled} onClick={() => { onCast(video.url, video.kind); setSent(video.title); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#18181D] p-4 text-start hover:border-[#6D5DFB] disabled:opacity-40">
          <span className="rounded-xl bg-[#6D5DFB]/15 p-3 text-[#A594FD]"><Film size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-medium">{video.title}</span><span className="mt-1 block text-xs text-zinc-500">{video.kind === 'video' ? 'HTML5 video' : video.kind === 'youtube' ? 'YouTube' : 'Vimeo'}</span></span>
          <span className="flex items-center gap-1 text-xs text-[#A594FD]"><Tv size={17} />{ku ? 'پلەی' : 'Play'}</span>
        </button>)}
      </div>}
      {page.note && <p role="status" className="text-xs leading-relaxed text-zinc-400">{ku ? 'لەم پەڕەیە ڤیدیۆی هەڵبژێردراو نەدۆزرایەوە. لینکەکانی خوارەوە بگەڕێ یان لینکی پەڕەی ڤیدیۆیەک داخڵ بکە. هەندێک وێبسایت لێرە پشتگیری ناکرێت.' : page.note}</p>}
      {page.links.length > 0 && <div className="space-y-1 max-h-72 overflow-y-auto">
        <h4 className="mb-2 text-xs uppercase tracking-wider text-zinc-400">{ku ? 'پەڕەکان' : 'Explore pages'}</h4>
        {page.links.map((link) => <button key={link.url} disabled={disabled} onClick={() => void browse(link.url)} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-start text-sm text-zinc-300 hover:bg-white/5"><Globe size={15} className="shrink-0 text-zinc-500" /><span className="flex-1 line-clamp-2">{link.title}</span><ArrowRight size={14} /></button>)}
      </div>}
    </div>}
  </section>;
}
