import { initDb, upsertNewsPosts, getRecentNewsPosts, clearOldNewsPosts, NewsPostRow } from './db';
import defaultSubreddits from '../assets/news.json';

type RedditListing = {
  data: {
    children: Array<{ data: any }>;
  };
};

export type NewsPost = {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  score: number;
  createdAt: number; // ms
  imageUrl?: string | null;
  selfText?: string | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function extractImageUrl(d: any): string | null {
  // Prefer preview images
  try {
    const preview = d.preview?.images?.[0]?.source?.url;
    if (preview) return String(preview).replaceAll('&amp;', '&');
  } catch {}
  // Try preview resolutions for smaller sizes
  try {
    const res = d.preview?.images?.[0]?.resolutions;
    if (Array.isArray(res) && res.length > 0) {
      const best = res[res.length - 1]?.url;
      if (best) return String(best).replaceAll('&amp;', '&');
    }
  } catch {}
  // Reddit gallery support
  try {
    if (d.is_gallery && d.media_metadata) {
      const firstKey = Object.keys(d.media_metadata)[0];
      const meta = d.media_metadata[firstKey];
      // Choose the highest available p (preview) or s (source)
      const src = (meta?.s?.u || (Array.isArray(meta?.p) ? meta.p[meta.p.length - 1]?.u : null));
      if (src) return String(src).replaceAll('&amp;', '&');
    }
  } catch {}
  // Thumbnails that are real URLs
  try {
    const thumb = d.thumbnail;
    if (thumb && typeof thumb === 'string' && thumb.startsWith('http')) return thumb;
  } catch {}
  // Direct URL if it's an image
  try {
    const url: string = String(d.url_overridden_by_dest ?? d.url ?? '');
    if (url.match(/\.(png|jpe?g|gif|webp)(\?|#|$)/i)) return url;
  } catch {}
  return null;
}

function toNewsRows(subreddit: string, json: RedditListing, fetchedAt: number): NewsPostRow[] {
  const items = json?.data?.children ?? [];
  return items.map((c) => {
    const d = c.data || {};
    const id: string = `${subreddit}_${String(d.id ?? d.name ?? Math.random()).replace(/\W+/g, '')}`;
    const title: string = String(d.title ?? '');
    const permalink: string = String(d.permalink ?? '');
    const externalUrl = String(d.url_overridden_by_dest ?? '');
    const url = permalink ? `https://www.reddit.com${permalink}` : String(d.url ?? externalUrl);
    const score: number = Number(d.ups ?? d.score ?? 0);
    const createdAt: number = Number(d.created_utc ? d.created_utc * 1000 : Date.now());
    const imageUrl = extractImageUrl(d);
    const selfText = extractSelfText(d);
    return { id, subreddit, title, url, score, createdAt, fetchedAt, imageUrl, selfText, externalUrl: externalUrl || null } as NewsPostRow;
  });
}

async function fetchTopDaily(subreddit: string, limit: number): Promise<RedditListing> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=day&limit=${Math.max(1, Math.min(100, limit))}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'antiSocial/1.0 (https://github.com/Sgct97/antiSocial-)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Reddit ${subreddit} ${res.status}`);
  return (await res.json()) as RedditListing;
}

function uniqById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function isLikelyExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return !(host.endsWith('reddit.com') || host.endsWith('redd.it'));
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function htmlToPlainText(html: string): string {
  try {
    const cleaned = html
      .replace(/<br\s*\/?>(\n)?/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '</$1>\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n');
    return decodeHtmlEntities(cleaned).trim();
  } catch {
    return html;
  }
}

function extractSelfText(d: any): string | null {
  try {
    if (typeof d.selftext === 'string' && d.selftext.trim().length > 0) return d.selftext.trim();
  } catch {}
  try {
    if (typeof d.selftext_html === 'string' && d.selftext_html.length > 0) {
      const plain = htmlToPlainText(d.selftext_html);
      if (plain.trim().length > 0) return plain.trim();
    }
  } catch {}
  try {
    const cp = Array.isArray(d.crosspost_parent_list) ? d.crosspost_parent_list[0] : null;
    if (cp) {
      if (typeof cp.selftext === 'string' && cp.selftext.trim().length > 0) return cp.selftext.trim();
      if (typeof cp.selftext_html === 'string' && cp.selftext_html.length > 0) {
        const plain = htmlToPlainText(cp.selftext_html);
        if (plain.trim().length > 0) return plain.trim();
      }
    }
  } catch {}
  try {
    const oembedDesc = (d?.media?.oembed?.description || d?.secure_media?.oembed?.description);
    if (oembedDesc && String(oembedDesc).trim().length > 0) return decodeHtmlEntities(String(oembedDesc).trim());
  } catch {}
  return null;
}

async function fetchPageSummary(url: string): Promise<string | null> {
  if (!isLikelyExternalUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'antiSocial/1.0 (+news-summary)'
      }
    });
    const html = await res.text();
    // Try og:description or meta description
    const og = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
      || html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
    if (og) return decodeHtmlEntities(og).trim().slice(0, 420);
    // Fallback to first paragraph text
    const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (p) return htmlToPlainText(p).slice(0, 420);
  } catch {}
  return null;
}

export async function getTopNewsPosts(opts?: { subreddits?: string[]; limitPerSub?: number; forceRefresh?: boolean; totalLimit?: number }): Promise<NewsPost[]> {
  initDb();
  const defaults: string[] = (defaultSubreddits as unknown as string[]) || [];
  const subreddits = (opts?.subreddits && opts.subreddits.length > 0) ? opts.subreddits : defaults;
  const limitPerSub = opts?.limitPerSub ?? 10;
  const totalLimit = opts?.totalLimit ?? 60;
  const now = Date.now();

  // Try cached first unless forced
  if (!opts?.forceRefresh) {
    const cached = getRecentNewsPosts(subreddits, now - CACHE_TTL_MS);
    if (cached.length > 0) {
      let mapped = cached
        .sort((a, b) => b.score - a.score)
        .slice(0, totalLimit)
        .map(({ id, subreddit, title, url, score, createdAt, imageUrl, selfText }) => ({ id, subreddit, title, url, score, createdAt, imageUrl, selfText }));
      // If most have no image, trigger a background refresh to enrich images next time
      const withImages = mapped.filter(p => !!p.imageUrl).length;
      if (withImages < Math.max(1, Math.floor(mapped.length * 0.3))) {
        // fire-and-forget refresh
        getTopNewsPosts({ subreddits, limitPerSub, totalLimit, forceRefresh: true }).catch(() => {});
      }
      // If most have no text, do a one-time forced refresh to populate body text
      const withText = mapped.filter(p => !!p.selfText && p.selfText!.length > 0).length;
      if (withText < Math.max(1, Math.floor(mapped.length * 0.2))) {
        return await getTopNewsPosts({ subreddits, limitPerSub, totalLimit, forceRefresh: true });
      }
      return mapped;
    }
  }

  // Refresh: fetch in parallel per subreddit
  const fetchedAt = now;
  const results = await Promise.allSettled(
    subreddits.map(async (sr) => {
      const json = await fetchTopDaily(sr, limitPerSub);
      const rows = toNewsRows(sr, json, fetchedAt);
      // Enrich selfText for link posts via page summaries (best-effort)
      for (const r of rows) {
        const target = (r as any).externalUrl ?? r.url;
        if (!r.selfText && target && isLikelyExternalUrl(target)) {
          try {
            const summary = await fetchPageSummary(target);
            if (summary) r.selfText = summary;
          } catch {}
        }
      }
      return rows;
    })
  );
  const rows = uniqById(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  );

  // Cache and prune old entries
  try { upsertNewsPosts(rows); } catch {}
  try { clearOldNewsPosts(7 * 24 * 60 * 60 * 1000); } catch {}

  const fresh = getRecentNewsPosts(subreddits, now - CACHE_TTL_MS)
    .sort((a, b) => b.score - a.score)
    .slice(0, totalLimit)
    .map(({ id, subreddit, title, url, score, createdAt, imageUrl, selfText, externalUrl }) => ({ id, subreddit, title, url, score, createdAt, imageUrl, selfText, externalUrl }));
  return fresh;
}

export async function refreshNewsCache(subreddits?: string[]) {
  await getTopNewsPosts({ subreddits, forceRefresh: true });
}


