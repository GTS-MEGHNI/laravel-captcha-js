import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', react: 'src/react.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    treeshake: true,
    // The solver is hot: keep it readable in stack traces but small on the wire.
    minify: false,
    target: 'es2022',
});
