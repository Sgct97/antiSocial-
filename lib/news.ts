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
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function toNewsRows(subreddit: string, json: RedditListing, fetchedAt: number): NewsPostRow[] {
  const items = json?.data?.children ?? [];
  return items.map((c) => {
    const d = c.data || {};
    const id: string = `${subreddit}_${String(d.id ?? d.name ?? Math.random()).replace(/\W+/g, '')}`;
    const title: string = String(d.title ?? '');
    const permalink: string = String(d.permalink ?? '');
    const url = permalink ? `https://www.reddit.com${permalink}` : String(d.url_overridden_by_dest ?? d.url ?? '');
    const score: number = Number(d.ups ?? d.score ?? 0);
    const createdAt: number = Number(d.created_utc ? d.created_utc * 1000 : Date.now());
    return { id, subreddit, title, url, score, createdAt, fetchedAt } as NewsPostRow;
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
      return cached
        .sort((a, b) => b.score - a.score)
        .slice(0, totalLimit)
        .map(({ id, subreddit, title, url, score, createdAt }) => ({ id, subreddit, title, url, score, createdAt }));
    }
  }

  // Refresh: fetch in parallel per subreddit
  const fetchedAt = now;
  const results = await Promise.allSettled(
    subreddits.map(async (sr) => {
      const json = await fetchTopDaily(sr, limitPerSub);
      return toNewsRows(sr, json, fetchedAt);
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
    .map(({ id, subreddit, title, url, score, createdAt }) => ({ id, subreddit, title, url, score, createdAt }));
  return fresh;
}

export async function refreshNewsCache(subreddits?: string[]) {
  await getTopNewsPosts({ subreddits, forceRefresh: true });
}


