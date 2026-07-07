/**
 * LaTeX formula → Chinese speech text.
 *
 * Pipeline:
 *   LaTeX → temml.renderToString → MathML → SRE(en, clearspeak) → English
 *        → enToZh → Chinese speech text
 *
 * Lazy loading: temml + SRE + mathmaps total ~1MB (gzip ~220KB). Consumers
 * are encouraged to call `ready()` fire-and-forget at startup so the first
 * `toChinese()` call resolves synchronously.
 *
 * SRE's default locale loader reads from filesystem (Node) or CDN (browser),
 * neither of which is friendly to WebView / offline scenarios. This package
 * bundles `base.json` and `en.json` from speech-rule-engine and feeds them
 * to SRE via a custom loader — no runtime network dependency.
 *
 * @packageDocumentation
 */

import { speechEnToZh } from './enToZh';

type TemmlHandle = typeof import('temml').default;
type SREHandle = typeof import('speech-rule-engine');

/**
 * Bundler CJS/ESM boundary defense. temml is ESM, SRE is CJS; different
 * bundlers (vite dev/prod, webpack, esbuild, rollup) sometimes expose
 * `setupEngine` on either `module.default` or the module namespace itself.
 * Probe both at runtime to find the usable handle.
 */
function pick<T extends object>(
  a: unknown,
  b: unknown,
  probeKey: keyof T,
): T | null {
  const test = (x: unknown): T | null =>
    x && typeof (x as Record<string, unknown>)[probeKey as string] === 'function'
      ? (x as T)
      : null;
  return test(a) ?? test(b);
}

// Module-level lazy-loaded references, cached after first init.
let TemmlLib: TemmlHandle | null = null;
let SRELib: SREHandle | null = null;

/**
 * Singleton init promise. Created on first `ready()` call, reused after.
 * When resolved, `engineReadyFlag` becomes true and `isReady()` returns true.
 */
let readyPromise: Promise<void> | null = null;
let engineReadyFlag = false;

/**
 * LRU cache for conversion results, keyed by `${display ? 'B' : 'I'}\0${latex}`.
 *
 * In streaming scenarios (LLM text output, chunk-by-chunk), the same formula
 * may be reprocessed many times as the accumulator grows. Without caching,
 * each chunk triggers N × M SRE invocations for N formulas and M chunks.
 * With cache, each unique (latex, display) is computed exactly once.
 *
 * 200 entries covers typical multi-turn conversation. LRU eviction prevents
 * unbounded growth on long-running sessions.
 */
const CACHE_LIMIT = 200;
const conversionCache = new Map<string, string>();

/**
 * Options for `configure()` — lets callers customize SRE domain, style,
 * and optionally inject pre-loaded mathmaps data.
 */
export interface ConfigureOptions {
  /**
   * SRE speech domain. Default `'clearspeak'` (natural language, K-12 friendly).
   * Set to `'mathspeak'` for the more precise but verbose blind-reader style.
   */
  domain?: 'clearspeak' | 'mathspeak';
  /**
   * SRE speech style. `'default'` for full phrasing, `'brief'` / `'sbrief'`
   * for shorter output.
   */
  style?: 'default' | 'brief' | 'sbrief';
  /**
   * Pre-loaded mathmaps JSON strings. If not provided, the package will
   * dynamic-import them from `speech-rule-engine/lib/mathmaps/`.
   *
   * Useful for:
   *  - Bundlers that don't handle `?raw` JSON imports well
   *  - Environments that need explicit control over asset loading
   *  - Injecting custom locale data
   */
  mathmaps?: {
    base: string;
    en: string;
  };
}

let userConfig: Required<Pick<ConfigureOptions, 'domain' | 'style'>> & {
  mathmaps: ConfigureOptions['mathmaps'];
} = {
  domain: 'clearspeak',
  style: 'default',
  mathmaps: undefined,
};

/**
 * Optional configuration hook. Must be called **before** `ready()`.
 *
 * @example
 *   configure({ domain: 'clearspeak', style: 'default' });
 *   await ready();
 */
export function configure(options: ConfigureOptions): void {
  if (readyPromise) {
    console.warn(
      '[latex-to-chinese-speech] configure() called after ready(); ignored.',
    );
    return;
  }
  userConfig = {
    domain: options.domain ?? userConfig.domain,
    style: options.style ?? userConfig.style,
    mathmaps: options.mathmaps ?? userConfig.mathmaps,
  };
}

/**
 * Trigger dependency dynamic loading + SRE initialization. Idempotent,
 * multiple calls share the same init.
 *
 * Recommended usage: call fire-and-forget at app startup so the first
 * synchronous `toChinese()` finds `isReady() === true`.
 *
 * @example
 *   // At app boot
 *   void ready();
 *
 *   // Later, in your TTS pipeline
 *   if (isReady()) {
 *     const zh = toChinese(latex, isBlock);
 *   }
 */
export function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const [temmlMod, sreMod, base, en] = await Promise.all([
        import('temml'),
        import('speech-rule-engine'),
        userConfig.mathmaps
          ? Promise.resolve(userConfig.mathmaps.base)
          : loadMathmapsJson('base'),
        userConfig.mathmaps
          ? Promise.resolve(userConfig.mathmaps.en)
          : loadMathmapsJson('en'),
      ]);

      TemmlLib = pick<TemmlHandle>(
        (temmlMod as unknown as { default?: unknown }).default,
        temmlMod,
        'renderToString',
      );
      SRELib = pick<SREHandle>(
        (sreMod as unknown as { default?: unknown }).default,
        sreMod,
        'setupEngine',
      );

      if (!TemmlLib || typeof TemmlLib.renderToString !== 'function') {
        throw new Error('temml.renderToString is not available');
      }
      if (!SRELib || typeof SRELib.setupEngine !== 'function') {
        throw new Error('speech-rule-engine setupEngine is not available');
      }
      if (base.length < 1000 || en.length < 1000) {
        throw new Error(
          `mathmaps data too small (base=${base.length}, en=${en.length}); ` +
          `likely a raw JSON import failure`,
        );
      }

      await SRELib.setupEngine({
        locale: 'en',
        domain: userConfig.domain,
        style: userConfig.style,
        modality: 'speech',
        custom: async (locale: string) => {
          if (locale === 'base') return base;
          if (locale === 'en') return en;
          return '{}';
        },
      });
      await SRELib.engineReady();
      engineReadyFlag = true;
    })().catch((err) => {
      // Reset state so retries are possible
      console.error('[latex-to-chinese-speech] init failed:', err);
      readyPromise = null;
      TemmlLib = null;
      SRELib = null;
      engineReadyFlag = false;
    });
  }
  return readyPromise;
}

/**
 * Default mathmaps loader: dynamic-imports the JSON string from SRE's
 * package. Bundlers that support `?raw` (Vite) or `?asset` should still
 * work; others may need to use `configure({ mathmaps })`.
 */
async function loadMathmapsJson(name: 'base' | 'en'): Promise<string> {
  // Try dynamic import first — works in Node and most bundlers.
  //
  // Note: we import the JSON module then re-stringify. This adds a JSON
  // round-trip, but avoids bundler-specific `?raw` syntax that isn't
  // portable. If perf matters, users can pass pre-loaded mathmaps via
  // configure({ mathmaps: { base, en } }).
  const mod = await import(
    /* @vite-ignore */
    `speech-rule-engine/lib/mathmaps/${name}.json`
  );
  const data = (mod as { default?: unknown }).default ?? mod;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * Synchronous probe: whether SRE is fully initialized.
 *
 * Consumers should typically call `ready()` fire-and-forget at boot, then
 * gate `toChinese()` calls on `isReady()` to avoid awaiting per-formula.
 */
export function isReady(): boolean {
  return engineReadyFlag;
}

/**
 * Convert a LaTeX formula to Chinese speech text. LRU-cached.
 *
 * Requires `ready()` to have resolved. Returns an empty string if called
 * before initialization, on conversion failure, or on empty input — callers
 * should decide whether to fallback to raw LaTeX or skip speaking.
 *
 * @param latex   LaTeX source (without `$` / `$$` delimiters)
 * @param display `true` for block-level formulas (equivalent to `$$..$$`),
 *                `false` for inline (`$..$`). Affects temml's displaystyle.
 * @returns       Chinese speech text (e.g. "二分之一"), or empty string
 */
export function toChinese(latex: string, display: boolean): string {
  if (!latex || !latex.trim()) return '';
  if (!TemmlLib || !SRELib || !engineReadyFlag) return '';

  const key = (display ? 'B\0' : 'I\0') + latex;
  const cached = conversionCache.get(key);
  if (cached !== undefined) {
    // LRU: bump to newest position
    conversionCache.delete(key);
    conversionCache.set(key, cached);
    return cached;
  }

  try {
    const mathml = TemmlLib.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      xml: true,
    });
    const speech = SRELib.toSpeech(mathml);
    const zh = speech ? speechEnToZh(speech) : '';

    if (conversionCache.size >= CACHE_LIMIT) {
      const oldest = conversionCache.keys().next().value;
      if (oldest !== undefined) conversionCache.delete(oldest);
    }
    conversionCache.set(key, zh);
    return zh;
  } catch (err) {
    console.warn('[latex-to-chinese-speech] conversion failed:', latex, err);
    return '';
  }
}

/**
 * Escape hatch — clears the internal LRU cache. Useful if `configure()`
 * options changed at runtime (not recommended, but supported).
 */
export function clearCache(): void {
  conversionCache.clear();
}
