export function normalizeEmbedding(value: Float32Array): Float32Array {
  let sumSquares = 0;
  for (const component of value) sumSquares += component * component;
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return new Float32Array(value);

  const normalized = new Float32Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    normalized[index] = value[index] / magnitude;
  }
  return normalized;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Embedding dimensions must match");
  const left = normalizeEmbedding(a);
  const right = normalizeEmbedding(b);
  let score = 0;
  for (let index = 0; index < left.length; index += 1) score += left[index] * right[index];
  return score;
}
