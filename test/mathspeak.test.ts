import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ready, toChinese, isReady, configure, clearCache } from '../src';
import { speechEnToZh, findUntranslated } from '../src/enToZh';

// Node dynamic import of `speech-rule-engine/lib/mathmaps/*.json` returns
// a parsed object, but SRE's custom loader expects a JSON string. Pre-load
// mathmaps as strings from disk to bypass the round-trip.
const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  const sreDir = join(
    __dirname,
    '..',
    'node_modules',
    'speech-rule-engine',
    'lib',
    'mathmaps',
  );
  const [base, en] = await Promise.all([
    readFile(join(sreDir, 'base.json'), 'utf-8'),
    readFile(join(sreDir, 'en.json'), 'utf-8'),
  ]);
  configure({ mathmaps: { base, en } });
  await ready();
});

describe('ready / isReady', () => {
  it('reports ready after init', () => {
    expect(isReady()).toBe(true);
  });
});

describe('toChinese - core cases', () => {
  const CASES: ReadonlyArray<[string, boolean, RegExp[]]> = [
    // [latex, display, expectedFragments]
    // Each fragment is a RegExp; ALL must match the output.

    // Integrals
    ['\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}', true,
      [/从/, /0/, /1/, /的?积分/, /平方/, /等于/, /三分之一/]],

    // Sums
    ['\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', true,
      [/从/, /求和/, /等于/, /乘以/, /加/, /除以/]],

    // Square root + fraction (quadratic formula numerator/denominator)
    ['\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', true,
      [/分子/, /负/, /正负/, /根号/, /平方/, /减/, /分母/, /分数/]],

    // Not equal
    ['a \\neq 0', false, [/a/, /不等于/, /0/]],

    // Limit
    ['\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', true,
      [/趋近/, /极限/, /正弦/, /除以/, /等于/, /1/]],

    // Trigonometric identity
    ['\\sin^2 \\theta + \\cos^2 \\theta = 1', false,
      [/正弦/, /的平方/, /西塔/, /加/, /余弦/, /等于/]],

    // Euler's identity
    ['e^{i\\pi} + 1 = 0', false,
      [/e/, /派/, /次方/, /加/, /1/, /等于/, /0/]],

    // n-th root
    ['\\sqrt[3]{27} = 3', true, [/立方根/, /27/, /等于/, /3/]],

    // Log base
    ['\\log_2 8 = 3', false, [/以/, /2/, /为底/, /对数/, /8/, /等于/, /3/]],

    // Natural log
    ['\\ln e = 1', false, [/自然对数/, /e/, /等于/, /1/]],

    // Absolute value
    ['|x|', false, [/绝对值/, /x/]],

    // Set
    ['\\{1, 2, 3\\}', false, [/集合/, /1/, /2/, /3/]],

    // For all / exists / element of
    ['\\forall x \\in \\mathbb{R}', false, [/对任意/, /x/, /属于/, /实数集/]],
    ['\\exists x, y', false, [/存在/, /x/, /y/]],

    // Set operations
    ['A \\cap B', false, [/A/, /交/, /B/]],
    ['A \\cup B', false, [/A/, /并/, /B/]],
    ['\\emptyset', false, [/空集/]],

    // Percent (with number reordering)
    ['25\\%', false, [/百分之/, /25/]],

    // Mixed number
    ['2\\frac{1}{3}', false, [/2/, /又三分之一/]],

    // Complex limit + n-th root + sum-like
    [
      '\\lim_{n \\to \\infty} \\sqrt[n]{a_1^n + a_2^n + \\cdots + a_k^n}',
      true,
      [/趋近/, /无穷/, /极限/, /次方根/, /下标/, /等等/],
    ],

    // Matrix
    [
      '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
      true,
      [/2/, /行/, /列/, /矩阵/, /a/, /b/, /c/, /d/],
    ],

    // Sup with subscript (SRE outputs raw "sup" — covered by TOKEN_MAP)
    ['\\sup_{x \\in \\mathbb{R}} f(x)', true,
      [/上确界/, /x/, /属于/, /实数集/, /f/]],

    // gcd (SRE outputs raw "gcd" — covered by TOKEN_MAP)
    ['\\gcd(a,b)', false, [/最大公约数/, /a/, /b/]],
  ];

  for (const [latex, display, fragments] of CASES) {
    it(`translates: ${latex}`, () => {
      const zh = toChinese(latex, display);
      expect(zh).toBeTruthy();
      for (const frag of fragments) {
        expect(zh).toMatch(frag);
      }
    });
  }
});

describe('no untranslated English words', () => {
  const CASES = [
    '\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}',
    '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
    '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
    '\\sin^2 \\theta + \\cos^2 \\theta = 1',
    'e^{i\\pi} + 1 = 0',
    '\\sqrt[3]{27} = 3',
    '\\log_2 8 = 3',
    '\\ln e = 1',
    '\\forall x \\in \\mathbb{R}',
    '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    '\\lim_{n \\to \\infty} \\sqrt[n]{a_1^n + a_2^n + \\cdots + a_k^n}',
    '\\sup_{x \\in \\mathbb{R}} f(x)',
    '\\gcd(a,b)',
    '25\\%',
    '2\\frac{1}{3}',
  ];

  for (const latex of CASES) {
    it(`no leftover for: ${latex}`, () => {
      const zh = toChinese(latex, true);
      const missing = findUntranslated(zh);
      expect(missing).toEqual([]);
    });
  }
});

describe('edge cases', () => {
  it('empty input returns empty string', () => {
    expect(toChinese('', false)).toBe('');
    expect(toChinese('   ', false)).toBe('');
  });

  it('non-latex text passes through relatively unchanged', () => {
    // Simple text with no LaTeX commands still parses fine
    const zh = toChinese('x + y', false);
    expect(zh).toContain('x');
    expect(zh).toContain('y');
    expect(zh).toMatch(/加/);
  });

  it('cache hit returns identical result', () => {
    const zh1 = toChinese('\\frac{1}{2}', false);
    const zh2 = toChinese('\\frac{1}{2}', false);
    expect(zh1).toBe(zh2);
  });

  it('clearCache does not break subsequent calls', () => {
    const zh1 = toChinese('\\frac{1}{2}', false);
    clearCache();
    const zh2 = toChinese('\\frac{1}{2}', false);
    expect(zh1).toBe(zh2);
  });
});

describe('speechEnToZh direct', () => {
  it('translates known SRE phrases', () => {
    expect(speechEnToZh('one half')).toContain('二分之一');
    expect(speechEnToZh('the square root of x')).toContain('根号');
    expect(speechEnToZh('x squared')).toContain('平方');
    expect(speechEnToZh('a is not equal to b')).toContain('不等于');
  });

  it('preserves single-letter variables', () => {
    const out = speechEnToZh('a plus b equals c');
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain('c');
    expect(out).toContain('加');
    expect(out).toContain('等于');
  });
});

describe('findUntranslated', () => {
  it('reports untranslated multi-letter words', () => {
    expect(findUntranslated('a plus b')).toContain('plus');
  });

  it('ignores single-letter variables', () => {
    expect(findUntranslated('a b c d x y z')).toEqual([]);
  });

  it('deduplicates', () => {
    const out = findUntranslated('foo bar foo bar');
    expect(out).toEqual(['foo', 'bar']);
  });
});
