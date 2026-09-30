import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe, Loader2, Tv, Play, ExternalLink, RotateCw, Bookmark, Search, Layers, Compass } from 'lucide-react';
import { socketService, type SocketService } from '../../lib/socket';
import type { WebsitePage } from '../../lib/media-source';
import type { Language } from '../../lib/i18n';

type SavedPage = { title: string; url: string };
const starters = [
  { title: 'Kurd Cinema', url: 'https://kurdcinama.com/', label: 'KC' },
  { title: 'YouTube', url: 'https://www.youtube.com/', label: 'YT' },
  { title: 'Vimeo', url: 'https://vimeo.com/', label: 'V' },
];
export function WebsiteBrowser({ onCast, disabled, lang = 'en', service = socketService }: {
  onCast: (url: string, kind: 'video' | 'youtube' | 'vimeo' | 'web') => void;
  disabled: boolean; lang?: Language; service?: SocketService;
}) {
  const ku = lang === 'ku';
  const [address, setAddress] = useState('');
  const [page, setPage] = useState<WebsitePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [view, setView] = useState<'sources' | 'page' | 'links'>('sources');
  const [filter, setFilter] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [saved, setSaved] = useState<SavedPage[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem('castsync-bookmarks') || '[]');
      return Array.isArray(value) ? value.filter((item) => typeof item?.title === 'string' && typeof item?.url === 'string' && item.url.startsWith('https://')).slice(0, 20) : [];
    } catch { return []; }
  });
  const history = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const [index, setIndex] = useState(-1);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function browse(value: string, targetIndex?: number) {
    if (!value.trim() || disabled) return;
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch { setError(ku ? 'لینکی HTTPS ـی وێبسایت داخڵ بکە.' : 'Enter an HTTPS website URL.'); return; }
    const credentials = service.sessionCredentials();
    if (!credentials) { setError(ku ? 'سەرەتا دیڤایسەکان پەیوەست بکە.' : 'Pair your devices first.'); return; }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(''); setSent(''); setFilter('');
    try {
      const response = await fetch('/api/browse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, url: url.href }), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || 'Unable to open this website.');
      setPage(data); setAddress(data.url); setFrameKey((key) => key + 1);
      if (targetIndex === undefined) {
        history.current = [...history.current.slice(0, indexRef.current + 1), data.url];
        indexRef.current = history.current.length - 1;
      } else indexRef.current = targetIndex;
      setIndex(indexRef.current);
      setView(data.videos.length || data.players?.length ? 'sources' : 'links');
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to open this website.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function bookmark() {
    if (!page) return;
    const next = saved.some((item) => item.url === page.url) ? saved.filter((item) => item.url !== page.url) : [{ title: page.title, url: page.url }, ...saved].slice(0, 20);
    setSaved(next);
    try { localStorage.setItem('castsync-bookmarks', JSON.stringify(next)); } catch {}
  }
  function cast(url: string, kind: 'video' | 'youtube' | 'vimeo' | 'web', title: string) {
    onCast(url, kind); setSent(title);
  }
  const button = 'browser-icon';
  const sourceCount = (page?.videos.length || 0) + (page?.players?.length || 0);
  return <section className="browser-workspace">
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
      <div><p className="eyebrow">{ku ? 'گەڕان و پخشکردن' : 'DISCOVER & CAST'}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{ku ? 'وێب، بۆ شاشەکەت' : 'The web. On your screen.'}</h2></div>
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-zinc-300"><Compass size={21} /></div>
    </div>
    <div className="border-y border-white/[0.07] bg-black/15 px-3 py-3 space-y-3">
      <form className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c0d11] p-1.5" onSubmit={(event) => { event.preventDefault(); void browse(address); }}>
        <Globe size={17} className="ms-2 shrink-0 text-zinc-500" />
        <input aria-label={ku ? 'لینکی وێبسایت' : 'Website address'} dir="ltr" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={ku ? 'لینکی وێبسایت…' : 'Enter a website address…'} className="min-w-0 flex-1 bg-transparent py-2 text-sm text-zinc-200 outline-none" />
        <button aria-label={ku ? 'بیکەرەوە' : 'Browse'} disabled={loading || disabled || !address.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#6D5DFB] text-white disabled:opacity-40" type="submit">{loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}</button>
      </form>
      <div className="flex items-center gap-1">
        <button className={button} aria-label="Previous page" disabled={index <= 0 || disabled || loading} onClick={() => void browse(history.current[index - 1], index - 1)}><ArrowLeft size={17} /></button>
        <button className={button} aria-label="Next page" disabled={index >= history.current.length - 1 || disabled || loading} onClick={() => void browse(history.current[index + 1], index + 1)}><ArrowRight size={17} /></button>
        <button className={button} aria-label="Reload page and find videos" disabled={!page || loading || disabled} onClick={() => page && void browse(page.url, index)}><RotateCw size={16} /></button>
        <button className={button} aria-label="Saved pages and browser start" onClick={() => { pending.current?.abort(); setLoading(false); setPage(null); setAddress(''); setError(''); setSent(''); }}><Compass size={16} /></button>
        <span className="flex-1" />
        <button className={`${button} ${saved.some((item) => item.url === page?.url) ? '!text-[#b1a7ff]' : ''}`} aria-label="Bookmark this page" disabled={!page} onClick={bookmark}><Bookmark size={16} /></button>
        {page && <a className={button} href={page.url} target="_blank" rel="noopener noreferrer" aria-label="Open original website"><ExternalLink size={16} /></a>}
      </div>
    </div>
    {loading && <div role="status" className="flex items-center gap-2 px-5 py-3 text-xs text-zinc-400"><Loader2 size={15} className="animate-spin" />{ku ? 'پەڕە و پڵەیەرەکان دەخوێندرێنەوە…' : 'Finding videos and embedded players…'}</div>}
    {error && <p role="alert" className="m-4 rounded-xl border border-amber-300/10 bg-amber-300/5 p-3 text-sm text-amber-200">{error}</p>}
    {sent && <p role="status" className="m-4 flex items-center gap-2 rounded-xl bg-emerald-400/5 p-3 text-sm text-emerald-300"><Tv size={16} />{ku ? 'نێردرا بۆ شاشەکەت: ' : 'Sent to your screen: '}{sent}</p>}
    {!page && <div className="p-5 space-y-6">
      <div className="py-7 text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/[0.03]"><Layers size={27} className="text-[#b1a7ff]" /></div><h3 className="font-medium">{ku ? 'چی دەتەوێت ببینیت؟' : 'What are we watching?'}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">{ku ? 'لینکی پەڕەکە دابنێ، ڤیدیۆ یان پڵەیەر هەڵبژێرە و بینێرە بۆ شاشەکەت.' : 'Enter a page address, choose a video or player, and send it to your connected screen.'}</p></div>
      <div className="grid grid-cols-3 gap-2">{starters.map((item) => <button key={item.url} disabled={disabled || loading} onClick={() => void browse(item.url)} className="rounded-2xl border border-white/[0.07] p-3 text-center hover:bg-white/5 disabled:opacity-40"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-sm font-semibold text-zinc-300">{item.label}</span><span className="text-xs text-zinc-400">{item.title}</span></button>)}</div>
      {saved.length > 0 && <div><h4 className="eyebrow mb-2">{ku ? 'پاشەکەوتکراوەکان' : 'SAVED PAGES'}</h4>{saved.map((item) => <button disabled={disabled || loading} key={item.url} onClick={() => void browse(item.url)} className="flex w-full items-center gap-3 py-3 text-start text-sm text-zinc-300"><Bookmark size={15} className="text-zinc-500" /><span className="truncate">{item.title}</span></button>)}</div>}
    </div>}
    {page && <div aria-busy={loading} className={loading ? 'opacity-50 pointer-events-none' : ''}>
      <div className="px-5 pt-4 pb-3"><h3 className="truncate text-sm font-semibold">{page.title}</h3><p className="mt-1 truncate text-xs text-zinc-500" dir="ltr">{new URL(page.url).hostname}</p></div>
      <div className="mx-3 mb-4 grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">{([
        ['sources', ku ? 'ڤیدیۆکان' : 'Videos', sourceCount], ['page', ku ? 'پەڕە' : 'Page', null], ['links', ku ? 'لینکەکان' : 'Links', page.links.length],
      ] as const).map(([key, label, count]) => <button key={key} onClick={() => setView(key)} className={`rounded-lg px-2 py-2.5 text-xs font-medium transition ${view === key ? 'bg-white/[0.08] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'}`}>{label}{count !== null && <span className="ms-1.5 text-[10px] opacity-60">{count}</span>}</button>)}</div>
      {view === 'page' && <div>
        <p className="px-5 pb-3 text-xs leading-relaxed text-zinc-500">{ku ? 'پێشبینینی پەڕە: هەندێک سایت ڕێگە بە پیشاندان نادات. دوای گەڕان لە ناو پەڕەکە، لینکی نوێی بخە ناو خانەی سەرەوە بۆ دۆزینەوەی ڤیدیۆ.' : 'Page preview: some sites block embedding. After navigating inside a page, enter its new address above to discover its videos.'}</p>
        <iframe key={frameKey} src={page.url} title="Website preview" className="h-[60dvh] min-h-80 w-full border-0 bg-white" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="fullscreen; autoplay; encrypted-media" />
        <div className="p-4 flex gap-2"><button disabled={disabled} onClick={() => cast(page.url, 'web', page.title)} className="flex-1 rounded-xl bg-white/5 px-3 py-3 text-xs font-medium">{ku ? 'پەڕە لە TV بکەرەوە' : 'Open page on TV'}</button><a href={page.url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl border border-white/10 px-3 py-3 text-center text-xs font-medium">{ku ? 'لە بڕۆسەر بکەرەوە' : 'Open in browser'}</a></div>
      </div>}
      {view === 'sources' && <div className="px-4 pb-5 space-y-3">
        {page.videos.map((video, i) => <button key={video.url} disabled={disabled} onClick={() => cast(video.url, video.kind, video.title)} className="source-card group">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#6D5DFB]/10 text-[#b1a7ff]"><Play size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-medium">{video.title}</span><span className="mt-1.5 block text-[11px] text-zinc-500">{video.kind === 'video' ? (/\.m3u8(?:\?|$)/i.test(video.url) ? 'HLS stream' : 'Video source') : video.kind === 'youtube' ? 'YouTube' : 'Vimeo'} · {String(i + 1).padStart(2, '0')}</span></span><Tv size={18} className="shrink-0 text-zinc-500 group-hover:text-[#b1a7ff]" />
        </button>)}
        {(page.players || []).map((player) => <div key={player.url} className="rounded-2xl border border-white/[0.07] p-4"><div className="flex items-center gap-3"><Layers size={19} className="text-zinc-500" /><div className="min-w-0"><h4 className="truncate text-sm font-medium">{player.title}</h4><p className="mt-1 text-[11px] text-zinc-500">{ku ? 'پڵەیەری دەرەکی • کۆنترۆڵەکانی خۆی بەکار بێنە' : 'External player · use its own controls'}</p></div></div><div className="mt-4 flex gap-2"><button disabled={disabled} className="flex-1 rounded-xl bg-white/[0.06] py-2.5 text-xs font-medium" onClick={() => cast(player.url, 'web', player.title)}>{ku ? 'لە TV بکەرەوە' : 'Open on TV'}</button><button disabled={disabled} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-400" onClick={() => void browse(player.url)}>{ku ? 'سەرچاوە بدۆزەوە' : 'Find sources'}</button></div></div>)}
        {!sourceCount && <div className="py-7 text-center text-zinc-500"><Search size={25} className="mx-auto mb-3" /><p className="text-sm">{ku ? 'سەرچاوەی ڤیدیۆ نەدۆزرایەوە' : 'No video sources found'}</p><p className="mt-2 text-xs leading-relaxed">{ku ? 'لینکەکان یان پەڕەکە بکەرەوە؛ ڤیدیۆی بە JavaScript بارکراو هەمیشە نادۆزرێتەوە.' : 'Explore links or preview the page. Videos loaded dynamically may be unavailable.'}</p></div>}
        {page.note && sourceCount > 0 && <p className="text-xs text-zinc-500 leading-relaxed">{ku ? 'پڵەیەری دەرەکی ڕەنگە پێویستی بە کلیک لە خودی TV هەبێت. پیشاندان بە ڕێگەپێدانی سایتەکە بەستراوەتەوە.' : page.note}</p>}
      </div>}
      {view === 'links' && <div className="px-4 pb-5"><div className="mb-3 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2"><Search size={15} className="text-zinc-500" /><input aria-label="Filter page links" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={ku ? 'گەڕان لە لینکەکان…' : 'Filter page links…'} className="min-w-0 w-full bg-transparent text-sm outline-none" /></div><div className="max-h-[55dvh] overflow-auto">{page.links.filter((link) => `${link.title} ${link.url}`.toLowerCase().includes(filter.toLowerCase())).map((link) => <button key={link.url} disabled={disabled} onClick={() => void browse(link.url)} className="flex w-full items-center gap-3 border-b border-white/[0.04] px-1 py-3.5 text-start text-sm text-zinc-300 hover:text-white"><Globe size={15} className="shrink-0 text-zinc-600" /><span className="flex-1 line-clamp-2">{link.title}</span><ArrowRight size={14} className="text-zinc-600" /></button>)}</div>{!page.links.length && <p className="py-5 text-center text-xs text-zinc-500">{ku ? 'لینکی تر نەدۆزرایەوە.' : 'No page links found.'}</p>}</div>}
    </div>}
  </section>;
}
