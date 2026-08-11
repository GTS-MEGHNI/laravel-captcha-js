<div align="center">
    <h1>Laravel Captcha JS</h1>
</div>

<p align="center">
    <a href="https://www.npmjs.com/package/@gts-meghni/laravel-captcha"><img src="https://img.shields.io/npm/v/@gts-meghni/laravel-captcha.svg?style=flat-square" alt="npm"></a>
    <a href="https://www.npmjs.com/package/@gts-meghni/laravel-captcha"><img src="https://img.shields.io/node/v/@gts-meghni/laravel-captcha.svg?style=flat-square" alt="Node from npm"></a>
    <a href="https://github.com/GTS-MEGHNI/laravel-captcha-js/actions"><img alt="GitHub Workflow Status (main)" src="https://img.shields.io/github/actions/workflow/status/GTS-MEGHNI/laravel-captcha-js/tests.yml?branch=main&label=Tests&style=flat-square"></a>
    <a href="https://www.npmjs.com/package/@gts-meghni/laravel-captcha"><img src="https://img.shields.io/npm/dm/@gts-meghni/laravel-captcha.svg?style=flat-square" alt="Downloads"></a>
</p>

Browser client for [`gts-meghni/laravel-captcha`](https://github.com/GTS-MEGHNI/laravel-captcha),
with React and Next.js hooks included.

Invisible proof of work plus an optional image challenge. Nothing is inlined as a
`data:` URI, so a strict `img-src 'self'` policy still renders the image.

The core is `fetch` and Web Crypto and nothing else — React is an optional peer
dependency behind the `/react` entry point, so Vue, Svelte and plain scripts use
the same package. Laravel is the reference server, not a requirement: see
[Works with any backend](#works-with-any-backend).

```bash
npm install @gts-meghni/laravel-captcha
```

## Proof of work, invisibly

```tsx
'use client';

import { usePow } from '@gts-meghni/laravel-captcha/react';

export function LoginForm() {
    const pow = usePow();

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pow.fields === null) return;

        await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, ...pow.fields }),
        });

        // A token is single use, so always take a fresh one.
        await pow.refresh();
    }

    return (
        <form onSubmit={submit}>
            {/* nothing to show the user */}
            <button disabled={pow.status !== 'ready'}>Sign in</button>
        </form>
    );
}
```

The hook solves on mount, typically in about 45 ms, and exposes `status`
(`idle` / `solving` / `ready` / `error`), `hashes` for a progress indicator, and
`refresh()` to take a new challenge after each submission.

## The image challenge, when you want one

```tsx
'use client';

import { useImageCaptcha } from '@gts-meghni/laravel-captcha/react';

export function Challenge() {
    const captcha = useImageCaptcha();

    return (
        <>
            {captcha.challenge && <img src={captcha.challenge.url} alt="Captcha" />}
            <input
                value={captcha.answer}
                onChange={(event) => captcha.setAnswer(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
            />
            <button type="button" onClick={() => void captcha.refresh()}>
                New image
            </button>
        </>
    );
}
```

`captcha.fields` gives `{ captcha_token, captcha }` once an answer is typed.

## Without React

```ts
import { obtainPow, fetchImageChallenge, solvePow } from '@gts-meghni/laravel-captcha';

const { token, nonce, hashes, ms } = await obtainPow();
```

| Export                                        | Purpose                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `obtainPow(options)`                          | Fetch a challenge and solve it. Yields between slices by default.        |
| `solvePow(challenge, options)`                | Solve synchronously. Blocks the thread; fine at difficulty 16.           |
| `solvePowAsync(challenge, options)`           | Solve in slices, yielding between them. Takes `onProgress` and `signal`. |
| `fetchPowChallenge(options)`                  | Fetch only.                                                              |
| `fetchImageChallenge(preset?, options)`       | Fetch an image challenge.                                                |
| `sha256Words`, `sha256Hex`, `leadingZeroBits` | The primitives, exported for tests.                                      |

## Options

```ts
{
    baseUrl: 'https://api.example.test',  // omit for same-origin
    prefix: 'api/captcha',                // matches captcha.routes.prefix
    fetchOptions: { credentials: 'include' },
    chunkSize: 25_000,                    // hashes between yields
    maxHashes: 300_000_000,               // fail loudly rather than hang
    onProgress: (hashes) => {},
    signal: controller.signal,
}
```

A failed request throws `CaptchaRequestError`, carrying `status` and
`isRateLimited` — the endpoint is throttled, so a 429 means back off rather than
retry. A challenge that cannot be solved within `maxHashes` throws
`PowGaveUpError`, which means the server difficulty is set too high for a browser.

## Works with any backend

Nothing here imports Laravel or PHP. What the client assumes is a wire contract,
which [`gts-meghni/laravel-captcha`](https://github.com/GTS-MEGHNI/laravel-captcha)
implements and any server can:

| Request                          | Response                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `GET {baseUrl}/{prefix}/pow`     | `{ token, salt, difficulty, algorithm: 'sha256', expires_in, expires_at }` |
| `GET {baseUrl}/{prefix}?preset=` | `{ token, url, expires_in, expires_at }`                                   |

`baseUrl` and `prefix` are both options, so the paths are yours to place. The
proof of work is `sha256(salt + nonce)` counting **leading zero bits**, not zero
characters, and the server is expected to verify the submitted `{ pow_token,
pow_nonce }` pair with a single hash. The image answer submits as
`{ captcha_token, captcha }`.

Field names are the contract. Changing them is a change to both halves at once,
so this package deliberately ships no response-mapping layer.

## Why SHA-256 is implemented here

`crypto.subtle.digest()` is asynchronous. One promise per hash caps throughput
near 50k/s, where this loop reaches roughly a million — at difficulty 16 that is
the difference between five seconds and a fifth of one. The implementation is
checked against Node's `crypto` on known vectors and across every message length
from 50 to 130 bytes, because block-boundary padding is the easiest part to get
wrong.

## Notes for Next.js

Both hooks are client-side (`'use client'` is declared in the package). Point
`baseUrl` at the Laravel origin, or add a rewrite so the endpoints are
same-origin:

```js
// next.config.js
async rewrites() {
    return [{ source: '/api/captcha/:path*', destination: 'https://api.example.test/api/captcha/:path*' }];
}
```

## Development

```bash
npm run check     # typecheck, lint, format check, tests
npm run build     # dist/, ESM + CJS + types
```

TypeScript runs with `strict`, `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`; ESLint runs `strictTypeChecked` and
`stylisticTypeChecked` plus the React hooks rules.

## License

MIT
