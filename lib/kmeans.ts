export type KMeansResult = { centroids: number[][]; assignments: number[] };

export function kmeans(vectors: number[][], k: number, iterations = 10): KMeansResult {
  if (vectors.length === 0) return { centroids: [], assignments: [] };
  const dim = vectors[0].length;
  // init: pick first k
  const centroids = vectors.slice(0, k).map((v) => v.slice());
  const assignments = new Array(vectors.length).fill(0);

  for (let it = 0; it < iterations; it++) {
    // assign
    for (let i = 0; i < vectors.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = euclidean2(vectors[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      assignments[i] = best;
    }
    // update
    const sums = centroids.map(() => new Array(dim).fill(0));
    const counts = centroids.map(() => 0);
    for (let i = 0; i < vectors.length; i++) {
      const a = assignments[i];
      const v = vectors[i];
      counts[a]++;
      for (let j = 0; j < dim; j++) sums[a][j] += v[j];
    }
    for (let c = 0; c < centroids.length; c++) {
      const count = counts[c] || 1;
      for (let j = 0; j < dim; j++) centroids[c][j] = sums[c][j] / count;
    }
  }

  return { centroids, assignments };
}

function euclidean2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}
