import { CaptchaRequestError, PowGaveUpError } from './errors';
import { leadingZeroBits, sha256Words } from './sha256';
import type { ClientOptions, ImageChallenge, PowChallenge, PowSolution } from './types';

export { CaptchaRequestError, PowGaveUpError } from './errors';
export { leadingZeroBits, sha256Hex, sha256Words } from './sha256';
export type { ClientOptions, ImageChallenge, PowChallenge, PowSolution } from './types';

const encoder = new TextEncoder();

function endpoint(path: string, options: ClientOptions = {}): string {
    const base = (options.baseUrl ?? '').replace(/\/+$/, '');
    const prefix = (options.prefix ?? 'api/captcha').replace(/^\/+|\/+$/g, '');

    return `${base}/${prefix}${path}`;
}

async function getJson<T>(url: string, options: ClientOptions): Promise<T> {
    // Built through Headers so a caller may pass its own in any accepted shape —
    // record, entries array or Headers — without the merge losing entries.
    const headers = new Headers(options.fetchOptions?.headers);
    headers.set('Accept', 'application/json');

    const response = await fetch(url, { ...options.fetchOptions, headers });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            body !== null && typeof body === 'object' && 'message' in body
                ? String(body.message)
                : `Request to ${url} failed`;

        throw new CaptchaRequestError(message, response.status, body);
    }

    return body as T;
}

/** Ask for a proof-of-work challenge. */
export function fetchPowChallenge(options: ClientOptions = {}): Promise<PowChallenge> {
    return getJson<PowChallenge>(endpoint('/pow', options), options);
}

/** Ask for an image challenge. */
export function fetchImageChallenge(
    preset?: string,
    options: ClientOptions = {},
): Promise<ImageChallenge> {
    const query = preset === undefined ? '' : `?preset=${encodeURIComponent(preset)}`;

    return getJson<ImageChallenge>(endpoint(query, options), options);
}

export interface SolveOptions {
    /**
     * Abandon after this many hashes.
     *
     * Solve time is geometric, not fixed: an unlucky attempt legitimately takes
     * several times the average, so this ceiling is deliberately generous. It
     * exists to fail loudly on a misconfigured difficulty rather than to hang.
     */
    maxHashes?: number;

    /** Called with the running hash count, for a progress indicator. */
    onProgress?: (hashes: number) => void;

    /** How many hashes between progress reports, and between yields when async. */
    chunkSize?: number;

    /** Abort a solve in progress — a component unmounting, for instance. */
    signal?: AbortSignal;
}

const DEFAULT_MAX_HASHES = 300_000_000;
const DEFAULT_CHUNK = 25_000;

/**
 * Search a slice of the nonce space.
 *
 * Returns the winning nonce, or null if this slice found nothing.
 */
function searchSlice(
    salt: Uint8Array,
    difficulty: number,
    from: number,
    to: number,
    buffer: Uint8Array,
): number | null {
    for (let nonce = from; nonce < to; nonce++) {
        const digits = encoder.encode(String(nonce));

        buffer.set(digits, salt.length);

        if (
            leadingZeroBits(sha256Words(buffer.subarray(0, salt.length + digits.length))) >=
            difficulty
        ) {
            return nonce;
        }
    }

    return null;
}

/**
 * Find a nonce whose digest opens with `challenge.difficulty` zero bits.
 *
 * Synchronous and CPU-bound. At difficulty 16 it takes roughly 45ms, which is
 * imperceptible; the work doubles with every extra bit, so above about 20 prefer
 * `solvePowAsync`, which keeps the interface responsive.
 */
export function solvePow(challenge: PowChallenge, options: SolveOptions = {}): PowSolution {
    const maxHashes = options.maxHashes ?? DEFAULT_MAX_HASHES;
    const salt = encoder.encode(challenge.salt);
    const buffer = new Uint8Array(salt.length + 24);
    const started = Date.now();

    buffer.set(salt);

    const nonce = searchSlice(salt, challenge.difficulty, 0, maxHashes, buffer);

    if (nonce === null) {
        throw new PowGaveUpError(challenge.difficulty, maxHashes);
    }

    return {
        token: challenge.token,
        nonce: String(nonce),
        hashes: nonce + 1,
        ms: Date.now() - started,
    };
}

/**
 * Solve in slices, yielding between them.
 *
 * Same work as `solvePow`, but the event loop gets a turn every `chunkSize`
 * hashes, so animations keep running and the tab stays responsive. Use it when
 * difficulty is high, when your users are on slow devices, or whenever you would
 * rather not risk a visible freeze.
 */
export async function solvePowAsync(
    challenge: PowChallenge,
    options: SolveOptions = {},
): Promise<PowSolution> {
    const maxHashes = options.maxHashes ?? DEFAULT_MAX_HASHES;
    const chunk = Math.max(1_000, options.chunkSize ?? DEFAULT_CHUNK);
    const salt = encoder.encode(challenge.salt);
    const buffer = new Uint8Array(salt.length + 24);
    const started = Date.now();

    buffer.set(salt);

    for (let from = 0; from < maxHashes; from += chunk) {
        if (options.signal?.aborted === true) {
            throw new DOMException('Proof of work aborted', 'AbortError');
        }

        const nonce = searchSlice(
            salt,
            challenge.difficulty,
            from,
            Math.min(from + chunk, maxHashes),
            buffer,
        );

        if (nonce !== null) {
            return {
                token: challenge.token,
                nonce: String(nonce),
                hashes: nonce + 1,
                ms: Date.now() - started,
            };
        }

        options.onProgress?.(from + chunk);

        // Hand the thread back before the next slice.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    throw new PowGaveUpError(challenge.difficulty, maxHashes);
}

/**
 * Fetch a challenge and solve it — the one call most callers need.
 *
 * Yields between slices by default, on the assumption that a frozen tab is worse
 * than a few milliseconds of scheduling overhead.
 */
export async function obtainPow(
    options: ClientOptions & SolveOptions & { sync?: boolean } = {},
): Promise<PowSolution> {
    const challenge = await fetchPowChallenge(options);

    return options.sync === true ? solvePow(challenge, options) : solvePowAsync(challenge, options);
}
