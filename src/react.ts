'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchImageChallenge, obtainPow } from './index';
import type { ClientOptions, ImageChallenge, PowSolution, SolveOptions } from './index';

export type PowStatus = 'idle' | 'solving' | 'ready' | 'error';

export interface UsePowResult {
    /** Fields to submit: spread into your request body. */
    fields: { pow_token: string; pow_nonce: string } | null;
    solution: PowSolution | null;
    status: PowStatus;
    error: Error | null;
    /** Fetch and solve again — call after a submission, since a token is single use. */
    refresh: () => Promise<void>;
    hashes: number;
}

/**
 * Solve a proof-of-work challenge on mount, and again on demand.
 *
 * A token is single use, so call `refresh()` after every submission whether it
 * succeeded or failed.
 */
export function usePow(options: ClientOptions & SolveOptions = {}): UsePowResult {
    const [solution, setSolution] = useState<PowSolution | null>(null);
    const [status, setStatus] = useState<PowStatus>('idle');
    const [error, setError] = useState<Error | null>(null);
    const [hashes, setHashes] = useState(0);

    // Options usually arrive as a fresh object literal each render; holding them
    // in a ref keeps `refresh` stable so effects do not loop.
    const held = useRef(options);
    held.current = options;

    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        setStatus('solving');
        setError(null);
        setHashes(0);

        try {
            const result = await obtainPow({
                ...held.current,
                onProgress: (count) => {
                    if (mounted.current) {
                        setHashes(count);
                    }
                },
            });

            if (!mounted.current) {
                return;
            }

            setSolution(result);
            setHashes(result.hashes);
            setStatus('ready');
        } catch (thrown) {
            if (!mounted.current) {
                return;
            }

            setSolution(null);
            setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        fields: solution === null ? null : { pow_token: solution.token, pow_nonce: solution.nonce },
        solution,
        status,
        error,
        refresh,
        hashes,
    };
}

export interface UseImageCaptchaResult {
    /** Fields to submit, once the user has typed an answer. */
    fields: { captcha_token: string; captcha: string } | null;
    challenge: ImageChallenge | null;
    answer: string;
    setAnswer: (answer: string) => void;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

/**
 * Fetch an image challenge and hold the user's answer.
 *
 * Render `challenge.url` in an `<img>`; it is a URL rather than a data URI so a
 * strict `img-src 'self'` policy still displays it.
 */
export function useImageCaptcha(
    preset?: string,
    options: ClientOptions = {},
): UseImageCaptchaResult {
    const [challenge, setChallenge] = useState<ImageChallenge | null>(null);
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const held = useRef({ preset, options });
    held.current = { preset, options };

    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        setAnswer('');

        try {
            const next = await fetchImageChallenge(held.current.preset, held.current.options);

            if (mounted.current) {
                setChallenge(next);
            }
        } catch (thrown) {
            if (mounted.current) {
                setChallenge(null);
                setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
            }
        } finally {
            if (mounted.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        fields:
            challenge === null || answer === ''
                ? null
                : { captcha_token: challenge.token, captcha: answer },
        challenge,
        answer,
        setAnswer,
        loading,
        error,
        refresh,
    };
}
