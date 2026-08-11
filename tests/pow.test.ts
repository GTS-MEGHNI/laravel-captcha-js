import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
    CaptchaRequestError,
    PowGaveUpError,
    fetchPowChallenge,
    obtainPow,
    solvePow,
    solvePowAsync,
} from '../src/index';
import type { PowChallenge } from '../src/index';

function challenge(difficulty: number, salt = 'a3f1c09e77b24d5188ff0c1e2b6a9d40'): PowChallenge {
    return {
        token: 'tok_'.padEnd(40, 'x'),
        salt,
        difficulty,
        algorithm: 'sha256',
        expires_in: 120,
        expires_at: '2026-08-10T12:02:00+00:00',
    };
}

/** Verify the way the Laravel package does, so a passing test means it passes there. */
function serverWouldAccept(salt: string, nonce: string, difficulty: number): boolean {
    const hex = createHash('sha256')
        .update(salt + nonce)
        .digest('hex');

    let bits = 0;

    for (const character of hex) {
        const nibble = parseInt(character, 16);

        if (nibble === 0) {
            bits += 4;
            continue;
        }

        bits += nibble < 2 ? 3 : nibble < 4 ? 2 : nibble < 8 ? 1 : 0;
        break;
    }

    return bits >= difficulty;
}

describe('solvePow', () => {
    it('produces a nonce the server accepts', () => {
        const task = challenge(12);
        const solution = solvePow(task);

        expect(serverWouldAccept(task.salt, solution.nonce, task.difficulty)).toBe(true);
        expect(solution.token).toBe(task.token);
        expect(solution.hashes).toBeGreaterThan(0);
    });

    it('gives up loudly rather than hanging on an impossible ceiling', () => {
        expect(() => solvePow(challenge(32), { maxHashes: 500 })).toThrow(PowGaveUpError);
    });

    it('finds a different nonce for a different salt', () => {
        const a = solvePow(challenge(10, 'AAA111'));
        const b = solvePow(challenge(10, 'BBB222'));

        expect(a.nonce).not.toBe(b.nonce);
        expect(serverWouldAccept('BBB222', a.nonce, 10)).toBe(false);
    });
});

describe('solvePowAsync', () => {
    it('agrees with the synchronous solver', async () => {
        const task = challenge(12);

        expect((await solvePowAsync(task, { chunkSize: 1000 })).nonce).toBe(solvePow(task).nonce);
    });

    it('reports progress and can be aborted', async () => {
        const onProgress = vi.fn();
        const controller = new AbortController();

        controller.abort();

        await expect(
            solvePowAsync(challenge(28), {
                chunkSize: 1000,
                onProgress,
                signal: controller.signal,
            }),
        ).rejects.toThrow(/aborted/i);
    });
});

describe('fetching', () => {
    it('asks the configured endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(challenge(16)), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        vi.stubGlobal('fetch', fetchMock);

        await fetchPowChallenge({ baseUrl: 'https://api.example.test/', prefix: '/api/captcha/' });

        expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.test/api/captcha/pow');
    });

    it('turns a throttle into an error that says so', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ message: 'Too Many Attempts.' }), {
                    status: 429,
                }),
            ),
        );

        const error = await fetchPowChallenge().catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(CaptchaRequestError);
        expect((error as CaptchaRequestError).isRateLimited).toBe(true);
        expect((error as CaptchaRequestError).message).toBe('Too Many Attempts.');
    });

    it('fetches and solves in one call', async () => {
        const task = challenge(10);

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response(JSON.stringify(task), { status: 200 })),
        );

        const solution = await obtainPow({ chunkSize: 1000 });

        expect(serverWouldAccept(task.salt, solution.nonce, task.difficulty)).toBe(true);
    });
});
