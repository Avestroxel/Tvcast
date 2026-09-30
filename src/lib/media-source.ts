export type EmbeddedSource = { provider: 'youtube' | 'vimeo'; id: string; url: string; hash?: string };

export function embeddedSource(value: string): EmbeddedSource | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? segments[0] : url.searchParams.get('v') ||
        (['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : null);
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` };
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const index = segments.findIndex((segment) => /^\d{1,15}$/.test(segment));
      if (index >= 0) {
        const id = segments[index];
        const hash = url.searchParams.get('h') || segments[index + 1];
        const safeHash = hash && /^[a-f0-9]{6,32}$/i.test(hash) ? hash : undefined;
        return { provider: 'vimeo', id, hash: safeHash, url: `https://vimeo.com/${id}${safeHash ? `/${safeHash}` : ''}` };
      }
    }
  } catch {}
  return null;
}

export function directVideoSource(value: string): boolean {
  try { return /\.(mp4|webm|ogv|ogg|mov|m4v|m3u8)$/i.test(new URL(value).pathname); } catch { return false; }
}

export interface WebsiteVideo { title: string; url: string; kind: 'video' | 'youtube' | 'vimeo'; }
export interface WebsitePage {
  title: string;
  url: string;
  videos: WebsiteVideo[];
  links: { title: string; url: string }[];
  players?: { title: string; url: string }[];
  note?: string;
}
