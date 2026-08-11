import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { leadingZeroBits, sha256Hex } from '../src/sha256';

const encoder = new TextEncoder();

describe('sha256', () => {
    it('matches the platform implementation on known vectors', () => {
        for (const input of ['', 'a', 'abc', 'hello world', 'x'.repeat(1000), '日本語']) {
            expect(sha256Hex(encoder.encode(input))).toBe(
                createHash('sha256').update(input).digest('hex'),
            );
        }
    });

    it('matches across the block boundary, where padding is easiest to get wrong', () => {
        for (let length = 50; length <= 130; length++) {
            const input = 'a'.repeat(length);

            expect(sha256Hex(encoder.encode(input))).toBe(
                createHash('sha256').update(input).digest('hex'),
            );
        }
    });

    it('counts leading zero bits', () => {
        expect(leadingZeroBits(new Uint32Array([0xffffffff]))).toBe(0);
        expect(leadingZeroBits(new Uint32Array([0x7fffffff]))).toBe(1);
        expect(leadingZeroBits(new Uint32Array([0x0000ffff]))).toBe(16);
        expect(leadingZeroBits(new Uint32Array([0, 0xffffffff]))).toBe(32);
        expect(leadingZeroBits(new Uint32Array([0, 0]))).toBe(64);
    });
});
