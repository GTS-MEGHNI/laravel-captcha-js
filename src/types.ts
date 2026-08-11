/** A proof-of-work challenge as `GET /api/captcha/pow` returns it. */
export interface PowChallenge {
    token: string;
    salt: string;
    difficulty: number;
    algorithm: 'sha256';
    expires_in: number;
    expires_at: string;
}

/** An image challenge as `GET /api/captcha` returns it. */
export interface ImageChallenge {
    token: string;
    url: string;
    expires_in: number;
    expires_at: string;
}

/** What solving cost, alongside the answer to submit. */
export interface PowSolution {
    token: string;
    nonce: string;
    hashes: number;
    ms: number;
}

export interface ClientOptions {
    /**
     * Where the Laravel app is. Leave unset for a same-origin request, which is
     * what a Next.js rewrite or a shared domain gives you.
     */
    baseUrl?: string;

    /** Route prefix, matching `captcha.routes.prefix`. */
    prefix?: string;

    /** Passed through to fetch, for credentials, headers or an abort signal. */
    fetchOptions?: RequestInit;
}
