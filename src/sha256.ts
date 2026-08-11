/**
 * SHA-256 over bytes, returning the digest as eight 32-bit words.
 *
 * Implemented here rather than through `crypto.subtle` because `subtle.digest()`
 * is asynchronous: one promise per hash caps throughput near 50k/s, where this
 * loop reaches roughly a million. At difficulty 16 that is the difference between
 * five seconds and a fifth of one.
 */

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const W = new Uint32Array(64);

export function sha256Words(bytes: Uint8Array): Uint32Array {
    const length = bytes.length;

    // The message needs its length byte plus eight length bytes, rounded up to a
    // whole 64-byte block. Rounding with `+ 63` matters: computing it as
    // `((length + 9) >> 6) + 1` allocates a spare block whenever length + 9 is an
    // exact multiple of 64 — lengths 55, 119, 183 — and an extra block of zeros
    // changes the digest.
    const padded = ((length + 9 + 63) >> 6) << 6;
    const block = new Uint8Array(padded);

    block.set(bytes);
    block[length] = 0x80;

    const bits = length * 8;
    block[padded - 4] = (bits >>> 24) & 0xff;
    block[padded - 3] = (bits >>> 16) & 0xff;
    block[padded - 2] = (bits >>> 8) & 0xff;
    block[padded - 1] = bits & 0xff;

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    for (let offset = 0; offset < padded; offset += 64) {
        for (let i = 0; i < 16; i++) {
            const j = offset + i * 4;

            W[i] =
                ((block[j] as number) << 24) |
                ((block[j + 1] as number) << 16) |
                ((block[j + 2] as number) << 8) |
                (block[j + 3] as number);
        }

        for (let i = 16; i < 64; i++) {
            const a = W[i - 15] as number;
            const b = W[i - 2] as number;
            const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
            const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);

            W[i] = ((W[i - 16] as number) + s0 + (W[i - 7] as number) + s1) | 0;
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;
        let f = h5;
        let g = h6;
        let h = h7;

        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + (K[i] as number) + (W[i] as number)) | 0;
            const S0 =
                ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;

            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }

        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
        h5 = (h5 + f) | 0;
        h6 = (h6 + g) | 0;
        h7 = (h7 + h) | 0;
    }

    return new Uint32Array([h0, h1, h2, h3, h4, h5, h6, h7]);
}

/** How many zero bits the digest opens with. */
export function leadingZeroBits(words: Uint32Array): number {
    let bits = 0;

    for (const word of words) {
        if (word === 0) {
            bits += 32;
            continue;
        }

        return bits + Math.clz32(word >>> 0);
    }

    return bits;
}

/** Hex digest, for tests and debugging. Never needed on the hot path. */
export function sha256Hex(bytes: Uint8Array): string {
    return Array.from(sha256Words(bytes))
        .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
        .join('');
}
