/**
 * Thrown when the server declines to issue a challenge.
 *
 * `status` matters: 429 means the endpoint throttle was hit and the caller should
 * back off rather than retry immediately, and 422 means the preset was rejected.
 */
export class CaptchaRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly body: unknown = null,
    ) {
        super(message);
        this.name = 'CaptchaRequestError';
    }

    get isRateLimited(): boolean {
        return this.status === 429;
    }
}

/** Thrown when a challenge cannot be solved within the configured ceiling. */
export class PowGaveUpError extends Error {
    constructor(
        readonly difficulty: number,
        readonly hashes: number,
    ) {
        super(
            `Gave up on a difficulty ${difficulty} challenge after ${hashes} hashes. ` +
                'Either the difficulty is set too high for a browser, or maxHashes is too low.',
        );
        this.name = 'PowGaveUpError';
    }
}
