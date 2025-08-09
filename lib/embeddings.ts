// Embedding interface with deterministic fallback until ONNX is enabled in Dev Build

export type Vector = number[];

// Deterministic pseudo-embedding: hashing n-grams into a 384-dim vector
export function embedTextsFallback(texts: string[], dim = 384): Vector[] {
  return texts.map((t) => hashEmbed(t, dim));
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function hashEmbed(text: string, dim: number): number[] {
  const v = new Array(dim).fill(0);
  const s = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const gram = tokens[i] + (tokens[i + 1] || '') + (tokens[i + 2] || '');
    const h = hash(gram);
    const idx = h % dim;
    v[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

export async function embedTexts(texts: string[]): Promise<Vector[]> {
  // TODO: swap with ONNX Runtime RN MiniLM embedding
  return embedTextsFallback(texts);
}

export function cosine(a: number[], b: number[]): number {
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
