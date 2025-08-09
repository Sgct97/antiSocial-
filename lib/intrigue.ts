import type { Idea } from './ingest';

export type ScoreInput = {
  currentFocus?: number[];
  recentlySeen?: Array<{ id: string; vector?: number[] }>;
  now?: number;
};

function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function scoreIdea(_idea: Idea, _vec?: number[], ctx?: ScoreInput): number {
  const R = 0.4 * (ctx?.currentFocus && _vec ? cosineSim(ctx.currentFocus, _vec) : Math.random() * 0.3);
  const N = 0.25 * (Math.random());
  const F = 0.2 * (Math.random());
  const V = Math.random() * 0.25;
  return R + N + F + V;
}
