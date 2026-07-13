// Aléatoire déterministe et reproductible — le cœur du plugin doit produire le
// MÊME match-script pour la même graine (tests + regénération raccord). Pur.

/** Générateur pseudo-aléatoire déterministe (mulberry32). Renvoie [0,1). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hache une chaîne en entier 32 bits (pour dériver une graine du nom des équipes). */
export function seedFromString(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Tire un élément selon des poids (> 0). Déterministe pour un `rng` donné. */
export function weightedPick<T>(rng: () => number, items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [value, w] of items) {
    r -= w
    if (r < 0) return value
  }
  return items[items.length - 1][0]
}
