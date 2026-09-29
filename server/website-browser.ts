import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { directVideoSource, embeddedSource, type WebsitePage, type WebsiteVideo } from '../src/lib/media-source.ts';

const MAX_BYTES = 2 * 1024 * 1024;
export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function websiteUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) {
    throw new Error('Use a public HTTPS website URL.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
      (ipaddr.isValid(host) && !publicAddress(host))) throw new Error('Private network addresses are not supported.');
  url.hash = '';
  return url;
}

// Resolve and pin the connection to a checked public IP on every redirect.
// This prevents an external page or DNS rebinding from reaching internal services.
export async function publicDocument(value: string, redirects = 0, deadline = Date.now() + 12000): Promise<{ url: string; text: string; type: string }> {
  const url = websiteUrl(value);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('This website took too long to respond.');
  let dnsTimer: ReturnType<typeof setTimeout>;
  const addresses = await Promise.race([
    lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error('Unable to reach this website.')), Math.min(5000, remaining)); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
    throw new Error('Private network addresses are not supported.');
  }
  const address = addresses.find((item) => item.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      agent: false,
      headers: { 'User-Agent': 'CastSync/1.1 WebsiteBrowser', Accept: 'text/html,application/json' },
      lookup: ((_host: string, options: { all?: boolean }, callback: Function) => options.all ? callback(null, [address]) : callback(null, address.address, address.family)) as any,
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirects >= 4) { reject(new Error('This website redirects too many times.')); return; }
        const target = new URL(response.headers.location, url).href;
        publicDocument(target, redirects + 1, deadline).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error('This website did not allow access to its public page. Try a video page link.'));
        return;
      }
      const type = String(response.headers['content-type'] || '').toLowerCase();
      if (!type.includes('text/html') && !type.includes('application/json')) {
        response.resume();
        reject(new Error('This URL is not a supported public webpage.'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error('This webpage is too large to browse.'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ url: url.href, type, text: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new Error('This website took too long to respond.')), Math.max(1, deadline - Date.now()));
    timer.unref();
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}

export function parseWebsite(html: string, pageUrl: string): WebsitePage {
  const $ = load(html);
  const page = new URL(pageUrl);
  let base = page.href;
  try { base = websiteUrl(new URL($('base').attr('href') || page.href, page).href).href; } catch {}
  const title = ($('title').first().text().trim() || page.hostname).slice(0, 200);
  const videos = new Map<string, WebsiteVideo>();
  const links = new Map<string, { title: string; url: string }>();
  const absolute = (value?: string) => {
    try { return value ? websiteUrl(new URL(value, base).href).href : null; } catch { return null; }
  };
  const addVideo = (value: string | undefined, label: string, explicit = false) => {
    const url = absolute(value);
    if (!url || videos.size >= 60) return false;
    const embed = embeddedSource(url);
    if (embed || directVideoSource(url) || explicit) {
      const target = embed?.url || url;
      if (!videos.has(target)) videos.set(target, { url: target, title: (label.trim() || title).slice(0, 200), kind: embed?.provider || 'video' });
      return true;
    }
    return false;
  };
  $('video').each((_i, element) => {
    const video = $(element);
    const label = video.attr('title') || video.attr('aria-label') || title;
    addVideo(video.attr('src'), label, true);
    video.find('source').each((_j, source) => { addVideo($(source).attr('src'), label, true); });
  });
  $('iframe').each((_i, element) => {
    const frame = $(element);
    if (embeddedSource(absolute(frame.attr('src')) || '')) addVideo(frame.attr('src'), frame.attr('title') || title);
  });
  $('meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"]').each((_i, element) => {
    addVideo($(element).attr('content'), title);
  });
  // Structured video metadata is common on public video pages.
  $('script[type="application/ld+json"]').each((_i, element) => {
    try {
      const queue: unknown[] = [JSON.parse($(element).text())];
      let visited = 0;
      while (queue.length && visited++ < 500) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item)) { queue.push(...item.slice(0, 100)); continue; }
        const object = item as Record<string, unknown>;
        if (object['@type'] === 'VideoObject' || (Array.isArray(object['@type']) && object['@type'].includes('VideoObject'))) {
          const label = typeof object.name === 'string' ? object.name : title;
          if (typeof object.contentUrl === 'string') addVideo(object.contentUrl, label, true);
          if (typeof object.embedUrl === 'string' && embeddedSource(absolute(object.embedUrl) || '')) addVideo(object.embedUrl, label);
        }
        queue.push(...Object.values(object).filter((value) => value && typeof value === 'object').slice(0, 100));
      }
    } catch { /* Invalid structured metadata does not prevent normal browsing. */ }
  });
  $('a[href]').each((_i, element) => {
    const anchor = $(element);
    const url = absolute(anchor.attr('href'));
    const label = (anchor.text().replace(/\s+/g, ' ').trim() || anchor.attr('title') || anchor.find('img').attr('alt') || '').slice(0, 200);
    if (!url || url === page.href) return;
    if (addVideo(url, label || new URL(url).pathname)) return;
    if (label && links.size < 80 && !links.has(url)) links.set(url, { title: label, url });
  });
  return {
    title, url: page.href, videos: [...videos.values()], links: [...links.values()],
    note: videos.size ? undefined : 'No selectable videos were found in this public page. Follow a page link below, or open a specific video page. Videos loaded after signing in or by scripts may not be available here.',
  };
}

export async function browseWebsite(value: string): Promise<WebsitePage> {
  const url = websiteUrl(value).href;
  const embed = embeddedSource(url);
  if (embed || directVideoSource(url)) {
    let title = embed ? `${embed.provider === 'youtube' ? 'YouTube' : 'Vimeo'} video` : new URL(url).pathname.split('/').pop() || 'Video';
    if (embed) {
      const endpoint = embed.provider === 'youtube' ? 'https://www.youtube.com/oembed' : 'https://vimeo.com/api/oembed.json';
      try {
        const metadata = await publicDocument(`${endpoint}?url=${encodeURIComponent(embed.url)}&format=json`);
        const data = JSON.parse(metadata.text);
        if (typeof data.title === 'string') title = data.title.slice(0, 200);
      } catch { /* Keep the valid player link when metadata is unavailable. */ }
    }
    return { title, url, videos: [{ title, url: embed?.url || url, kind: embed?.provider || 'video' }], links: [] };
  }
  const document = await publicDocument(url);
  if (!document.type.includes('text/html')) throw new Error('This address is not a webpage.');
  return parseWebsite(document.text, document.url);
}
