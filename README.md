# latex-to-chinese-speech

> 把 LaTeX 数学公式转成自然的中文口播文本,可以直接喂给任何 TTS 引擎
> (火山 seed-tts / 阿里 / Azure / Google Cloud TTS ...)。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/latex-to-chinese-speech.svg)](https://www.npmjs.com/package/latex-to-chinese-speech)

---

## 为什么需要这个

大模型 (LLM) 输出的数学内容都是 LaTeX 格式,比如 `\frac{1}{2}`、
`\int_0^1`、`\sum_{i=1}^{n}`。但主流 TTS 引擎不认 LaTeX ——要么整段公式
静音,要么把反斜杠念成 "backslash",要么读出 "f r a c one two" 这种字面
天书。

社区有个 Google 开源的
[speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine)
(SRE, ChromeVox 的 fork) 能把 MathML 转成自然英文口播 ("the fraction
with numerator 1 and denominator 2"),但 **SRE 官方不带中文 locale**,
自己从头写完整中文 mathmaps 得两三天,而且照搬 mathspeak 风格中文化后
听起来又太生硬。

这个包补齐中文这条路:

```
LaTeX → temml → MathML → SRE(英文 clearspeak) → 中文口播
```

最后一步的英中映射表是**从 SRE 内部规则里直接抽取字面短语再逐条翻译**
的 ~220 条短语 + 50 个函数名,零网络请求、零 CDN 依赖,Node / 浏览器 /
iOS WebView 全能跑。

---

## 安装

```bash
npm install latex-to-chinese-speech
# 或
pnpm add latex-to-chinese-speech
# 或
yarn add latex-to-chinese-speech
```

`temml` 与 `speech-rule-engine` 已声明为 dependencies,会随本包自动安装。

---

## 用法

### 基础用法(推荐)

```ts
import { ready, toChinese, isReady } from 'latex-to-chinese-speech';

// 应用启动时 fire-and-forget 触发懒加载,让首次真正朗读时同步命中
void ready();

// TTS 流程里同步判断
if (isReady()) {
  const zh = toChinese('\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}', true);
  // → "从 0 到 1 的积分 x 的平方 d x 等于 三分之一"

  const inline = toChinese('a \\neq 0', false);
  // → "a 不等于 0"

  await ttsEngine.speak(zh);
}
```

### 直接 await 用法

场景不允许等待懒加载时,直接 await:

```ts
await ready();
console.log(toChinese('\\frac{1}{2}', false));
// → "二分之一"
```

---

## 打包工具说明

本包用 `import()` 动态加载 `temml` / `speech-rule-engine` / mathmaps JSON,
以下环境都能开箱运行:

- Vite (dev + prod)
- webpack 5+
- Rollup
- esbuild
- Node.js 18+

### Vite 注意事项

如果发现 temml 无法识别命令(公式渲染成 `\f rac 12` 这种鬼样),在
`vite.config.ts` 里加 `optimizeDeps.exclude`:

```ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['temml'],
  },
});
```

原因: temml 依赖大量顶层 `defineFunction` 副作用来注册 LaTeX 命令
(`\frac` `\int` `\sqrt` ...)。vite dev 的 esbuild 预打包会打乱这些
副作用的求值顺序,导致命令注册失败。加 exclude 后 vite 直接以 ESM
加载 `dist/temml.mjs`,保持原文件求值顺序,命令能正确注册。

生产构建 (`vite build`) 不受此配置影响。

### iOS 15 WebView 兼容

完全兼容。mathmaps 数据是**运行时动态 import** 但打进独立 chunk,
不走网络,iOS WebView / 离线环境都能用。

### 自定义 mathmaps 加载

某些 bundler 对动态 JSON import 不友好时,可以预加载 mathmaps 数据
自己塞给包:

```ts
import { configure, ready } from 'latex-to-chinese-speech';
import baseJson from 'speech-rule-engine/lib/mathmaps/base.json?raw';
import enJson from 'speech-rule-engine/lib/mathmaps/en.json?raw';

configure({ mathmaps: { base: baseJson, en: enJson } });
await ready();
```

`configure()` 必须在 `ready()` 之前调用,之后调用会被忽略并打警告。

---

## API 参考

### `ready(): Promise<void>`

触发依赖动态加载 + SRE 初始化。幂等,多次调用共享同一份初始化。

- 推荐在应用启动时 fire-and-forget 触发 (`void ready()`)
- 手动朗读入口这类"用户主动动作"可以 `await ready()`,让首次点击就
  用上完整功能

### `isReady(): boolean`

同步探针。`ready()` resolve 后返回 `true`,之前返回 `false`。

TTS 流式场景推荐用法:

```ts
if (isReady()) {
  const zh = toChinese(latex, isBlock);
  // 本轮走完整中文转换
} else {
  // 本轮降级到原文透传,同时触发懒加载
  void ready();
}
```

### `toChinese(latex: string, display: boolean): string`

把一条 LaTeX 公式转成中文口播文本。

- `latex` —— LaTeX 源文(**不含** `$` / `$$` 分隔符)
- `display` —— `true` 表示块级公式(等价于 `$$..$$`),`false` 表示
  行内公式(`$..$`)。会影响 temml 的 `displayMode` 选项
- **返回**: 中文口播文本;失败或未就绪时返回空串

内置 200 条 LRU 缓存,同一 `(latex, display)` 反复调用为 O(1)。
LLM 流式场景下每收到一个 chunk 都会重新扫整段 accumulator,缓存
让相同公式的 SRE 转换只跑一次。

### `configure(options: ConfigureOptions): void`

可选配置。必须在 `ready()` 之前调用。

```ts
interface ConfigureOptions {
  /**
   * SRE 语音风格。默认 'clearspeak'(自然英语,K-12 教学友好)。
   * 'mathspeak' 是屏幕阅读器风格,更精确但更啰嗦。
   */
  domain?: 'clearspeak' | 'mathspeak';

  /**
   * 简写档位。'default' 完整词汇;'brief' / 'sbrief' 越来越短。
   */
  style?: 'default' | 'brief' | 'sbrief';

  /**
   * 预加载的 mathmaps JSON 字符串。不传则由包内动态 import 加载。
   * 用于绕过 bundler 对动态 JSON import 的限制。
   */
  mathmaps?: {
    base: string;
    en: string;
  };
}
```

### `clearCache(): void`

清空内部 LRU 缓存。一般用不上,`configure()` 后想强制重新计算时
可以用。

### `speechEnToZh(speech: string): string`

底层接口:直接把 SRE 输出的英文语音字符串翻成中文。给已经自己
接了 SRE 的高级用户用,不需要 temml 参与。

### `findUntranslated(zh: string): string[]`

诊断辅助:扫描输出里剩余的多字母英文单词,通常表示需要补规则。
自动排除 a/b/x/y/... 这种单字母变量。

```ts
const zh = toChinese(latex, true);
const missing = findUntranslated(zh);
if (missing.length) console.warn('未翻译:', missing);
```

---

## 示例对照表

| LaTeX | 中文口播 |
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
| `\log_2 8 = 3` | 以 2 为底的对数 8 等于 3 |
| `25\%` | 百分之 25 |
| `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` | 2 行 2 列矩阵 第 1 行 a b 第 2 行 c d |

---

## 覆盖度

映射表内含:

- **~220 条 clearspeak 短语**(从 SRE 4.1.4 内部规则 `en/rules/*.min`
  的 Action 字段里 `[t] "字面文本"` 位置抽出来的完整枚举)
- **50 个数学函数名**(sine / cosine / logarithm / limit inferior /
  greatest common divisor 等 SRE 官方函数命名)
- **34 个 LaTeX 命令简写**(sup / inf / min / max / gcd / lcm / det /
  dim / ker / arg / sinh / cosh / tanh 等,SRE 有时不翻译直接原样
  输出,补齐兜底)
- **常用希腊字母、数集、运算符、比较关系、量词、箭头**

真实 K-12 到大学层次的数学文本,测试语料(30+ 公式)零英文残留。

发现漏翻的公式请
[开 issue](https://github.com/zlaong/latex-to-chinese-speech/issues)
附上 LaTeX 输入和你期望的中文输出,补规则很简单。

---

## 贡献

```bash
npm install
npm test          # 跑测试
npm run typecheck # TypeScript 类型检查
npm run build     # 产出 dist/(ESM + CJS + .d.ts)
```

新增规则时请在 `test/mathspeak.test.ts` 加一条对应的测试用例。

---

## 许可证

本包采用 **MIT** 协议,见 [LICENSE](./LICENSE)。

本包运行时依赖:
- [speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine) (Apache-2.0)
- [temml](https://github.com/ronkok/Temml) (MIT)

第三方依赖的版权归属声明见 [NOTICE](./NOTICE) 与
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

**中英映射表原创性说明**: `src/enToZh.ts` 里的英中翻译表是通过
遍历 SRE 内部规则文件的字面短语枚举 + 逐条中文翻译得到的。抽取
仅涉及"SRE 会输出哪些英文短语"这个事实性列表,不包含 SRE 的
版权源码;中文翻译由本包作者原创。这属于 Apache License 2.0 允许
的独立作品(interfaces + factual data 层面的 fair use)。若 SRE
上游作者有不同意见,请
[开 issue](https://github.com/zlaong/latex-to-chinese-speech/issues)
沟通,我们可以把映射表改成 Apache-2.0 以保持上游兼容。
