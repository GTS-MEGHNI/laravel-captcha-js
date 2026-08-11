# Release Notes

## [Unreleased](https://github.com/GTS-MEGHNI/laravel-captcha-js/compare/v1.0.0...main)

## [v1.0.0](https://github.com/GTS-MEGHNI/laravel-captcha-js/releases/tag/v1.0.0) - 2026-08-11

Initial release. The browser half of
[`gts-meghni/laravel-captcha`](https://github.com/GTS-MEGHNI/laravel-captcha).

### Added

- `obtainPow()`, fetching a proof-of-work challenge and solving it, so the common
  case is one call.
- `solvePow()` and `solvePowAsync()`, the latter yielding between slices with
  `onProgress` and `signal`, so a long solve does not freeze the tab.
- `fetchPowChallenge()` and `fetchImageChallenge()` for callers driving the flow
  themselves.
- `usePow()` and `useImageCaptcha()` React hooks behind the `/react` entry point,
  with `'use client'` declared for Next.js. React is an optional peer dependency,
  so the core stays usable from Vue, Svelte or a plain script.
- SHA-256 implemented in the package rather than through `crypto.subtle.digest()`.
  One promise per hash caps throughput near 50k/s where this loop reaches roughly
  a million, which at difficulty 16 is five seconds against a fifth of one. It is
  checked against Node's `crypto` on known vectors and across every message length
  from 50 to 130 bytes, because block-boundary padding is the easiest part to get
  wrong.
- `CaptchaRequestError` carrying `status` and `isRateLimited`, because the
  endpoints are throttled and a 429 means back off rather than retry.
- `PowGaveUpError` past `maxHashes`, so a server difficulty set too high for a
  browser fails loudly instead of hanging.
- `baseUrl` and `prefix` options, covering both a separate API origin and a
  Next.js rewrite onto the same one.

### Notes

- ESM, CJS and type declarations are published; Node 20 or newer.
- The client talks to a documented wire contract rather than to Laravel itself.
  The Laravel package is the reference implementation, and any server matching
  the contract works.
