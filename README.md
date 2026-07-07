# latex-to-chinese-speech

> Convert LaTeX math formulas to natural Chinese speech text, ready to feed
> into any TTS engine (Volcano seed-tts, Alibaba, Azure, Google Cloud TTS, ...).
>
> 把 LaTeX 数学公式转成自然的中文口播文本,可以直接喂给任何 TTS 引擎
> (火山 seed-tts / 阿里 / Azure / Google Cloud TTS ...)。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/latex-to-chinese-speech.svg)](https://www.npmjs.com/package/latex-to-chinese-speech)

---

## English

### Why?

Modern LLMs output math in LaTeX (`\frac{1}{2}`, `\int_0^1`, `\sum_{i=1}^{n}`).
Most TTS engines don't understand LaTeX — they'll either skip formulas
entirely, read `\` as "backslash", or produce gibberish like "f r a c one two".

There's an excellent open-source project called
[speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine)
(SRE, forked from Google's ChromeVox) that turns MathML into natural English
speech ("the fraction with numerator 1 and denominator 2"). But SRE doesn't
ship a Chinese locale, and writing one from scratch means 200+ rule files.

This package bridges the gap:

```
LaTeX  →  temml  →  MathML  →  SRE (English clearspeak)  →  Chinese speech
```

The final English-to-Chinese step is a hand-crafted mapping of ~220 phrases
extracted directly from SRE's internal rule set. No external network calls,
no CDN, works in Node and browser (including WebViews).

### Install

```bash
npm install latex-to-chinese-speech
# or
pnpm add latex-to-chinese-speech
# or
yarn add latex-to-chinese-speech
```

`temml` and `speech-rule-engine` are declared as regular dependencies —
they'll be installed automatically.

### Usage

```ts
import { ready, toChinese, isReady } from 'latex-to-chinese-speech';

// Trigger lazy load at app startup (fire-and-forget)
void ready();

// Later, in your TTS pipeline
if (isReady()) {
  const zh = toChinese('\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}', true);
  // → "从 0 到 1 的积分 x 的平方 d x 等于 三分之一"

  const inline = toChinese('a \\neq 0', false);
  // → "a 不等于 0"

  await ttsEngine.speak(zh);
}
```

If you can't wait for lazy load, `await` it:

```ts
await ready();
console.log(toChinese('\\frac{1}{2}', false));
// → "二分之一"
```

### Bundler notes

The package uses `import()` for lazy loading `temml`, `speech-rule-engine`,
and mathmaps JSON. Should work out-of-box with:

- Vite (dev + prod)
- webpack 5+
- Rollup
- esbuild
- Node.js 18+

**Vite users**: if you see `temml` fail to register commands (formulas
render as `\f rac 12`), add `optimizeDeps: { exclude: ['temml'] }` to your
`vite.config.ts`. See [this issue](#) for context.

**Custom mathmaps loading**: if your bundler doesn't support dynamic JSON
imports well, preload the mathmaps yourself:

```ts
import { configure, ready } from 'latex-to-chinese-speech';
import baseJson from 'speech-rule-engine/lib/mathmaps/base.json?raw';
import enJson from 'speech-rule-engine/lib/mathmaps/en.json?raw';

configure({ mathmaps: { base: baseJson, en: enJson } });
await ready();
```

### API

#### `ready(): Promise<void>`

Trigger dependency loading + SRE initialization. Idempotent. Call
fire-and-forget at app startup.

#### `isReady(): boolean`

Synchronous probe. Returns `true` after `ready()` resolves.

#### `toChinese(latex: string, display: boolean): string`

Convert a LaTeX formula to Chinese speech text.

- `latex` — LaTeX source (without `$` / `$$` delimiters).
- `display` — `true` for block-level formulas (`$$..$$` equivalent),
  `false` for inline (`$..$`).
- **Returns**: Chinese speech text, or empty string on failure / not ready.

LRU-cached (200 entries), so calling repeatedly with the same formula is O(1).

#### `configure(options: ConfigureOptions): void`

Optional configuration. Must be called **before** `ready()`.

```ts
interface ConfigureOptions {
  domain?: 'clearspeak' | 'mathspeak';  // default: 'clearspeak'
  style?: 'default' | 'brief' | 'sbrief'; // default: 'default'
  mathmaps?: { base: string; en: string }; // preload SRE data
}
```

#### `clearCache(): void`

Clear the LRU cache. Rarely needed.

#### `speechEnToZh(speech: string): string`

Low-level: translate an English speech string (from SRE) to Chinese.
Exported for advanced users who want to combine with their own SRE setup.

#### `findUntranslated(zh: string): string[]`

Diagnostic: return English words in the output that likely need new rules.
Excludes single-letter variables (a/b/x/y/...).

### Examples

| LaTeX | Chinese speech |
|---|---|
| `\frac{1}{2}` | 二分之一 |
| `x^2 + y^2 = r^2` | x 的平方 加 y 的平方 等于 r 的平方 |
| `\sin^2\theta + \cos^2\theta = 1` | 正弦 的平方 西塔 加 余弦 的平方 西塔 等于 1 |
| `\int_0^1 x^2 \, dx = \frac{1}{3}` | 从 0 到 1 的积分 x 的平方 d x 等于 三分之一 |
| `\sum_{i=1}^{n} i = \frac{n(n+1)}{2}` | 从 i 等于 1 到 n 求和 i 等于 n 乘以 左括号 n 加 1 右括号 除以 2 |
| `\lim_{x \to 0} \frac{\sin x}{x} = 1` | 当 x 趋近 0 时的极限 正弦 x 除以 x 等于 1 |
| `a \neq 0` | a 不等于 0 |
| `\forall x \in \mathbb{R}` | 对任意 x 属于 实数集 |
| `\sqrt[3]{27} = 3` | 立方根 27 等于 3 |
| `25\%` | 百分之 25 |
| `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` | 2 行 2 列矩阵 第 1 行 a b 第 2 行 c d |

### Coverage

The mapping table covers **~220 clearspeak phrases** extracted from SRE
4.1.4 internal rules, plus **50 function names** (sine/cosine/log/...),
plus common Greek letters, number sets, and math operators. In real-world
K-12 through university-level math text, we observe zero untranslated
English words on our test corpus (30+ formulas).

If you find an untranslated formula, please
[open an issue](https://github.com/zlaong/latex-to-chinese-speech/issues)
with the LaTeX input and expected Chinese output.

---

## 中文

### 为什么需要这个？

大模型 (LLM) 输出的数学内容是 LaTeX 格式 (`\frac{1}{2}`, `\int_0^1`,
`\sum_{i=1}^{n}`),但主流 TTS 引擎不认 LaTeX ——要么整段公式静音,要么把
反斜杠读成 "backslash",要么念出 "f r a c one two" 这种字面天书。

有一个 Google 开源的
[speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine)
(SRE, ChromeVox 的 fork) 能把 MathML 转成自然英文口播 ("the fraction with
numerator 1 and denominator 2"),但 **SRE 官方不带中文 locale**,自己从头
写完整的中文 mathmaps 得两三天。

这个包补齐这条中文链路:

```
LaTeX  →  temml  →  MathML  →  SRE(英文 clearspeak)  →  中文口播
```

最后一步的英文-中文映射表是**从 SRE 内部规则里直接抽取**的 220 条短语
+ 50 个函数名,零网络请求、零 CDN 依赖,Node / 浏览器 / iOS WebView 全能跑。

### 安装

```bash
npm install latex-to-chinese-speech
```

### 用法

```ts
import { ready, toChinese, isReady } from 'latex-to-chinese-speech';

// 应用启动时 fire-and-forget 触发懒加载
void ready();

// TTS 流程里
if (isReady()) {
  const zh = toChinese('\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}', true);
  // → "从 0 到 1 的积分 x 的平方 d x 等于 三分之一"

  await ttsEngine.speak(zh);
}
```

### 打包工具说明

**Vite**: 如果发现 temml 无法识别命令 (公式变成 `\f rac 12`),在
`vite.config.ts` 里加:

```ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['temml'],
  },
});
```

原因: temml 依赖顶层 `defineFunction` 副作用,vite dev 的 esbuild 预打包
可能会打乱求值顺序。加 exclude 让 vite 直接 ESM 加载即可。

**iOS 15 WebView**: 完全兼容,mathmaps 数据预打包进 bundle,无需运行时 CDN。

### 示例对照表

同上面英文部分的表格。

### 覆盖度

映射表包含 **~220 条 clearspeak 短语** (从 SRE 4.1.4 内部规则里抽出来的)
+ 50 个数学函数名 + 常用希腊字母、数集、运算符。在真实 K-12 到大学层次
的数学文本上,测试语料 (30+ 公式) 零英文残留。

发现漏翻的公式请
[开 issue](https://github.com/zlaong/latex-to-chinese-speech/issues)
附上 LaTeX 输入和期望的中文输出。

---

## Contributing

PRs welcome. Please add a test case in `test/mathspeak.test.ts` for any
new rules.

```bash
npm install
npm test          # run tests
npm run typecheck # verify types
npm run build     # build dist
```

## License

MIT. See [LICENSE](./LICENSE).

This package depends on
[speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine)
(Apache-2.0) and [temml](https://github.com/ronkok/Temml) (MIT). See
[NOTICE](./NOTICE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
for attribution.

The Chinese phrase mapping in `src/enToZh.ts` was authored by extracting
the enumeration of literal English strings from SRE's internal rule files
and hand-translating each to Chinese. This is factual extraction + original
translation; the code contains no copyrighted source from SRE.
