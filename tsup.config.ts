import { defineConfig, type Options } from 'tsup';

const shared: Options = {
    format: ['esm', 'cjs'],
    dts: true,
    treeshake: true,
    // The solver is hot: keep it readable in stack traces but small on the wire.
    minify: false,
    target: 'es2022',
};

// Two passes rather than one, because `'use client'` belongs on the React entry
// alone — putting it on the core would pull the solver into a client bundle for
// callers who never touch the hooks.
export default defineConfig([
    {
        ...shared,
        entry: { index: 'src/index.ts' },
        clean: true,
    },
    {
        ...shared,
        entry: { react: 'src/react.ts' },
        clean: false,
        // Rollup, which is what `treeshake` runs, drops module-level directives,
        // and `'use client'` has to reach the published file or importing the
        // hooks from a Next.js app router page fails. esbuild keeps it, and its
        // own elimination is enough here: the entry is two hooks.
        treeshake: false,
    },
]);
