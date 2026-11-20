// Seeded randomness: the same seed always gives the same road and the same traffic

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Mixes several integers into one seed (FNV-1a style)
export function hashSeed(...parts) {
    let h = 2166136261;
    for (const part of parts) {
        h = Math.imul(h ^ (part >>> 0), 16777619);
        h ^= h >>> 13;
    }
    return h >>> 0;
}

// Normal distribution (mean 0, deviation 1), Box-Muller transform
export function gaussian(rand = Math.random) {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
