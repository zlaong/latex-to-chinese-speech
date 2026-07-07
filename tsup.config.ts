import { defineConfig } from 'tsup';

/**
 * Build config: emits ESM + CJS + .d.ts.
 *
 * `speech-rule-engine` and `temml` are marked external — the package expects
 * users to install them as peers (declared as regular deps, so npm/pnpm/yarn
 * resolve them automatically).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  external: ['speech-rule-engine', 'temml'],
});
