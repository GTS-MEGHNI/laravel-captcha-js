# Contribution Guide

Thank you for considering contributing to Laravel Captcha JS! Please review the following guidelines before submitting a pull request.

For significant changes, please open an issue first so we can discuss the approach.

## Process

1. Fork the project
2. Create a new branch
3. Code, test, commit, and push
4. Open a pull request detailing your changes

## Guidelines

- Ensure the coding style passes by running `npm run lint` and `npm run format:check`.
- Send a coherent commit history, making sure each commit in your pull request is meaningful.
- You may need to [rebase](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) to avoid merge conflicts.
- Please remember that we follow [SemVer](http://semver.org/).
- Changes to the request or response shape are a change to the wire contract this
  client shares with [`gts-meghni/laravel-captcha`](https://github.com/GTS-MEGHNI/laravel-captcha).
  Both sides have to move together, so open an issue before proposing one.

## Setup

Clone your fork, then install the dev dependencies:

```bash
npm install
```

## Lint

Lint your code:

```bash
npm run lint:fix
npm run format
```

## Tests

Run all checks:

```bash
npm run check
```
