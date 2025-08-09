import type { Project, Message, Idea } from './ingest';
import { chunkMessages, chunkProjects } from './chunk';
import { embedTexts } from './embeddings';
import { initDb, upsertDocs, upsertVectors, getAllVectors, getDocsByIds } from './db';
import { kmeans } from './kmeans';

export async function buildIdeas(projects: Project[], messages: Message[]): Promise<Idea[]> {
  initDb();
  const docs = [
    ...chunkProjects(projects),
    ...chunkMessages(messages),
  ];

  // Upsert docs
  upsertDocs(docs.map((d) => ({ id: d.id, text: d.text, source: d.source })));

  // Embed and store vectors
  const vectors = await embedTexts(docs.map((d) => d.text));
  const dim = vectors[0]?.length || 0;
  const blobRows = vectors.map((v, i) => ({ id: docs[i].id, dim, data: float32ToUint8(v) }));
  upsertVectors(blobRows);

  // K estimate
  const n = vectors.length;
  const k = Math.max(3, Math.min(24, Math.floor(Math.sqrt(n) / 2) || 3));
  const { centroids, assignments } = kmeans(vectors, k, 8);

  // Build idea titles from representative doc per cluster (first occurrence)
  const ideas: Idea[] = [];
  for (let c = 0; c < centroids.length; c++) {
    const idx = assignments.findIndex((a) => a === c);
    if (idx === -1) continue;
    const docId = docs[idx].id;
    const doc = getDocsByIds([docId])[0];
    const title = doc.text.length > 64 ? doc.text.slice(0, 61).trimEnd() + '…' : doc.text;
    const blurb = doc.text.length > 140 ? doc.text.slice(0, 137).trimEnd() + '…' : doc.text;
    ideas.push({ id: `k${c}`, title, blurb, tags: [docs[idx].source] });
  }

  return ideas;
}

export function float32ToUint8(arr: number[]): Uint8Array {
  const buf = new ArrayBuffer(arr.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < arr.length; i++) view.setFloat32(i * 4, arr[i], true);
  return new Uint8Array(buf);
}

export function uint8ToFloat32(buf: Uint8Array): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function retrieveTopK(queryVec: number[], k = 8): { id: string; score: number }[] {
  const all = getAllVectors();
  // Cosine similarity in JS
  function cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
  const scored = all.map((v) => ({ id: v.id, score: cosine(uint8ToFloat32(v.data), new Float32Array(queryVec)) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
