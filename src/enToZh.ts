/**
 * SRE clearspeak (English) speech output → Chinese speech mapping.
 *
 * Data source: extracted from SRE 4.1.4 internal rules
 *   - en/rules/clearspeak_english_actions.min
 *   - en/rules/mathspeak_english_actions.min
 *   - en/functions/*
 * Total: 214 clearspeak phrases + 50 function names + common ops / fractions
 * / number sets / Greek letters.
 *
 * Rule layers (order matters):
 *  1. PHRASE_PATTERNS - Multi-word / order-reordering matches (e.g.
 *     "the integral from X to Y of" → "从 X 到 Y 的积分"). Applied first.
 *  2. TOKEN_MAP       - Simple 1:1 word-level replacements, precompiled to
 *     RegExp array on module load. Applied after phrases.
 *  3. Whitespace cleanup.
 *
 * Named capture groups are avoided for iOS 15 / Safari 15 compatibility;
 * positional groups only.
 */

/**
 * 短语规则:先长模式 / 需要顺序调换的先匹配。
 * 数组顺序 = 应用顺序,后面的规则会看到前面已经翻译过的中间态。
 */
const PHRASE_PATTERNS: Array<[RegExp, string | ((...args: string[]) => string)]> = [
  // ==================== 大型算子:积分 / 求和 / 求积 / 极限 ====================
  //   the integral from X to Y of → 从 X 到 Y 的积分
  //   the sum from X to Y of      → 从 X 到 Y 求和
  //   the product from X to Y of  → 从 X 到 Y 求积
  //   lim over X approaches Y of  → 当 X 趋近 Y 时的极限
  [
    /\bthe (?:definite )?integral from (.+?) to (.+?) of\b/g,
    (_m, from, to) => `从 ${from} 到 ${to} 的积分`,
  ],
  [
    /\bthe sum from (.+?) to (.+?) of\b/g,
    (_m, from, to) => `从 ${from} 到 ${to} 求和`,
  ],
  [
    /\bthe product from (.+?) to (.+?) of\b/g,
    (_m, from, to) => `从 ${from} 到 ${to} 求积`,
  ],
  [
    /\blim over (.+?) (?:right arrow|approaches|to) (.+?) of\b/g,
    (_m, v, target) => `当 ${v} 趋近 ${target} 时的极限`,
  ],
  [
    /\bthe limit as (.+?) (?:approaches|right arrow) (.+?) of\b/g,
    (_m, v, target) => `当 ${v} 趋近 ${target} 时的极限`,
  ],

  // ==================== 对数 ====================
  [/\bthe log base (.+?) of\b/g, (_m, base) => `以 ${base} 为底的对数`],
  [/\blog base (\d+)\b/g, (_m, base) => `以 ${base} 为底的对数`],
  [/\blog base 10\b/g, '常用对数'],
  [/\bthe natural log of\b/g, '自然对数'],
  [/\bnatural log\b/g, '自然对数'],
  [/\bl n\b/g, '自然对数'], // SRE 有时把 \ln 逐字符输出

  // ==================== 分数 ====================
  //   the fraction with numerator X and denominator Y → X 分之 Y 的分数
  [
    /\bthe fraction with numerator (.+?) and denominator (.+?)(?=\s+(?:equals|plus|minus|times|divided by|of\b|,|$))/g,
    (_m, num, den) => `分子是 ${num} 分母是 ${den} 的分数`,
  ],
  [/\bfraction with numerator\b/g, '分子是'],
  [/\band denominator\b/g, '分母是'],
  [/\bthe fraction\b/g, '分数'],

  // ==================== 根号 / 幂 ====================
  [/\bthe square root of\b/g, '根号'],
  [/\bthe cube root of\b/g, '立方根'],
  [/\bthe negative square root of\b/g, '负平方根'],
  [/\bthe positive square root of\b/g, '正平方根'],
  [/\bthe (\d+)(?:st|nd|rd|th) root of\b/g, (_m, n) => `${n} 次方根`],
  [/\bthe (.+?)-th root of\b/g, (_m, n) => `${n} 次方根`],
  [/\broot of\b/g, '的方根'],
  [/\bend root\b/g, '根号结束'],
  //   raised to the X power / to the X-th power
  [
    /\braised to the (?:exponent|power)\b/g,
    '的指数为',
  ],
  [
    /\braised to the (.+?)(?:st|nd|rd|th)? power\b/g,
    (_m, p) => `的 ${p} 次方`,
  ],
  [
    /\bto the (?:(\d+)(?:st|nd|rd|th)|(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)|(.+?)-th) power\b/g,
    (_m, num, ord, letter) => {
      const p = num ?? letter ?? ord;
      return `的 ${p} 次方`;
    },
  ],
  [/\bpower of\b/g, '次方'],
  [/\bend exponent\b/g, '指数结束'],
  [/\bsquared\b/g, '的平方'],
  [/\bcubed\b/g, '的立方'],

  // ==================== 下标 / 上标 ====================
  [/\bsub (.+?)(?=\s|$)/g, (_m, s) => `下标 ${s}`],
  [/\bleft sub\b/g, '左下标'],
  [/\bright sub\b/g, '右下标'],
  [/\bleft super\b/g, '左上标'],
  [/\bright super\b/g, '右上标'],
  [/\bsubscript\b/g, '下标'],
  [/\bsuperscript\b/g, '上标'],

  // ==================== 括号 / 集合 / 分组 ====================
  [/\bopen paren\b/g, '左括号'],
  [/\bclose paren\b/g, '右括号'],
  [/\bopen bracket\b/g, '左中括号'],
  [/\bclose bracket\b/g, '右中括号'],
  [/\bopen brace\b/g, '左花括号'],
  [/\bclose brace\b/g, '右花括号'],
  //   the set / the set of / the set of all / the empty set
  [/\bthe set of all\b/g, '所有的集合'],
  [/\bthe set of\b/g, '集合'],
  [/\bthe empty set\b/g, '空集'],
  [/\bempty set\b/g, '空集'],
  [/\bthe set\b/g, '集合'],
  //   区间 the interval from X to Y (但通常紧跟 "including"/"but not including")
  [/\bthe interval from\b/g, '区间从'],
  [/\bbut not including\b/g, '不包含'],
  [/\bbut including\b/g, '包含'],
  [/\bnot including\b/g, '不包含'],
  [/\bincluding\b/g, '包含'],

  // ==================== 绝对值 / 模 ====================
  [/\bthe absolute value of\b/g, '绝对值'],
  [/\bend absolute value\b/g, '绝对值结束'],
  [/\bthe cardinality of\b/g, '基数'],
  [/\bthe measure of\b/g, '度量'],
  [/\bthe metric of\b/g, '度量'],
  [/\bend metric\b/g, '度量结束'],
  [/\bvertical bar\b/g, '竖线'],
  [/\bhorizontal bar\b/g, '上划线'],
  [/\bover horizontal bar\b/g, '上划线'],
  [/\boverbar\b/g, '上划线'],
  [/\bunderbar\b/g, '下划线'],
  [/\bovertilde\b/g, '上波浪线'],
  [/\bundertilde\b/g, '下波浪线'],

  // ==================== 集合运算 / 关系 ====================
  [/\bis a member of\b/g, '属于'],
  [/\bis an element of\b/g, '属于'],
  [/\bis in\b/g, '属于'],
  [/\bis not a member of\b/g, '不属于'],
  [/\bis not an element of\b/g, '不属于'],
  [/\bis not in\b/g, '不属于'],
  [/\bmember of\b/g, '属于'],
  [/\bnot a member of\b/g, '不属于'],
  [/\bnot an element of\b/g, '不属于'],
  [/\belement of\b/g, '属于'],
  [/\bbelonging to\b/g, '属于'],
  [/\bnot belonging to\b/g, '不属于'],
  [/\bbelongs to\b/g, '属于'],
  [/\bnot in\b/g, '不属于'],
  [/\bdoes not belong to\b/g, '不属于'],
  [/\bintersection\b/g, '交'],
  [/\bunion\b/g, '并'],
  [/\bintersect\b/g, '交'],

  // ==================== 数集 ====================
  [/\bthe real numbers\b/g, '实数集'],
  [/\bthe rational numbers\b/g, '有理数集'],
  [/\bthe integers\b/g, '整数集'],
  [/\bthe natural numbers with zero\b/g, '含零自然数集'],
  [/\bthe natural numbers\b/g, '自然数集'],
  [/\bthe complex numbers\b/g, '复数集'],
  [/\bthe positive integers\b/g, '正整数集'],
  [/\bthe negative integers\b/g, '负整数集'],
  [/\bthe positive rational numbers\b/g, '正有理数集'],
  [/\bthe negative rational numbers\b/g, '负有理数集'],
  [/\bthe complex conjugate of\b/g, '共轭复数'],

  // ==================== 量词 / 蕴含 ====================
  [/\bfor all\b/g, '对任意'],
  [/\bthere exists\b/g, '存在'],
  [/\bthere does not exist\b/g, '不存在'],
  [/\bsuch that\b/g, '使得'],
  [/\bis defined to be\b/g, '定义为'],

  // ==================== 比较 ====================
  [/\bis not equal to\b/g, '不等于'],
  [/\bis less than or equal to\b/g, '小于等于'],
  [/\bis greater than or equal to\b/g, '大于等于'],
  [/\bis less than\b/g, '小于'],
  [/\bis greater than\b/g, '大于'],
  [/\bis approximately equal to\b/g, '约等于'],
  [/\bis approximately\b/g, '约等于'],
  [/\bis (?:congruent|equivalent) to\b/g, '恒等于'],
  [/\bis proportional to\b/g, '正比于'],
  [/\bis similar to\b/g, '相似于'],
  [/\bdivides\b/g, '整除'],

  // ==================== 加减乘正负 ====================
  [/\bplus or minus\b/g, '正负'],
  [/\bminus or plus\b/g, '负正'],

  // ==================== 箭头 ====================
  [/\bright arrow\b/g, '趋向于'],
  [/\bleft arrow\b/g, '来自于'],
  [/\bleft right arrow\b/g, '当且仅当'],
  [/\bimplies\b/g, '推出'],
  [/\bmaps to\b/g, '映射到'],

  // ==================== 三角函数 / 反函数 / 双曲 ====================
  [/\barc cosecant\b/g, '反余割'],
  [/\barc cosine\b/g, '反余弦'],
  [/\barc cotangent\b/g, '反余切'],
  [/\barc secant\b/g, '反正割'],
  [/\barc sine\b/g, '反正弦'],
  [/\barc tangent\b/g, '反正切'],
  [/\barea hyperbolic cosecant\b/g, '反双曲余割'],
  [/\barea hyperbolic cosine\b/g, '反双曲余弦'],
  [/\barea hyperbolic cotangent\b/g, '反双曲余切'],
  [/\barea hyperbolic secant\b/g, '反双曲正割'],
  [/\barea hyperbolic sine\b/g, '反双曲正弦'],
  [/\barea hyperbolic tangent\b/g, '反双曲正切'],
  [/\bhyperbolic cosecant\b/g, '双曲余割'],
  [/\bhyperbolic cosine\b/g, '双曲余弦'],
  [/\bhyperbolic cotangent\b/g, '双曲余切'],
  [/\bhyperbolic secant\b/g, '双曲正割'],
  [/\bhyperbolic sine\b/g, '双曲正弦'],
  [/\bhyperbolic tangent\b/g, '双曲正切'],
  [/\binverse sine\b/g, '反正弦'],
  [/\binverse cosine\b/g, '反余弦'],
  [/\binverse tangent\b/g, '反正切'],

  // ==================== 特殊函数 ====================
  [/\bgreatest common divisor\b/g, '最大公约数'],
  [/\bleast common multiple\b/g, '最小公倍数'],
  [/\breal part\b/g, '实部'],
  [/\bimaginary part\b/g, '虚部'],
  [/\blimit inferior\b/g, '下极限'],
  [/\blimit superior\b/g, '上极限'],
  [/\bprojective limit\b/g, '射影极限'],
  [/\blimit\b/g, '极限'],
  [/\bcolimit\b/g, '余极限'],
  [/\bsupremum\b/g, '上确界'],
  [/\binfimum\b/g, '下确界'],
  [/\bmaximum\b/g, '最大值'],
  [/\bminimum\b/g, '最小值'],
  [/\bthe maximum of\b/g, '最大值'],
  [/\bthe minimum of\b/g, '最小值'],
  [/\bmax of\b/g, '最大值'],
  [/\bmin of\b/g, '最小值'],
  [/\bmodulo\b/g, '模'],
  [/\bdimension\b/g, '维度'],
  [/\bhomomorphism\b/g, '同态'],
  [/\bkernel\b/g, '核'],
  [/\btrace\b/g, '迹'],
  [/\bdeterminant\b/g, '行列式'],
  [/\bthe determinant of the\b/g, '行列式'],
  [/\bthe determinant of\b/g, '行列式'],
  [/\bend determinant\b/g, '行列式结束'],
  [/\bprobability\b/g, '概率'],
  [/\bexponential\b/g, '指数函数'],
  [/\bargument\b/g, '幅角'],

  // ==================== 数字装饰 / 带分数 / 常用分数 ====================
  [/(\d+) and one half\b/g, '$1 又二分之一'],
  [/(\d+) and one third\b/g, '$1 又三分之一'],
  [/(\d+) and two thirds\b/g, '$1 又三分之二'],
  [/(\d+) and one fourth\b/g, '$1 又四分之一'],
  [/(\d+) and three fourths\b/g, '$1 又四分之三'],
  [/(\d+) and one fifth\b/g, '$1 又五分之一'],
  [/\bone half\b/g, '二分之一'],
  [/\bone third\b/g, '三分之一'],
  [/\btwo thirds\b/g, '三分之二'],
  [/\bone fourth\b/g, '四分之一'],
  [/\bone quarter\b/g, '四分之一'],
  [/\btwo fourths\b/g, '四分之二'],
  [/\bthree fourths\b/g, '四分之三'],
  [/\bthree quarters\b/g, '四分之三'],
  [/\bone fifth\b/g, '五分之一'],
  [/\btwo fifths\b/g, '五分之二'],
  [/\bthree fifths\b/g, '五分之三'],
  [/\bfour fifths\b/g, '五分之四'],
  [/\bone sixth\b/g, '六分之一'],
  [/\bfive sixths\b/g, '六分之五'],
  [/\bone seventh\b/g, '七分之一'],
  [/\bone eighth\b/g, '八分之一'],
  [/\bone ninth\b/g, '九分之一'],
  [/\bone tenth\b/g, '十分之一'],

  // ==================== 百分号 / 度 / 阶乘 / 组合 ====================
  [/(\d+(?:\.\d+)?)\s+percent sign\b/g, '百分之 $1'],
  [/(\d+(?:\.\d+)?)\s+percent\b/g, '百分之 $1'],
  [/\bpercent sign\b/g, '百分号'],
  [/\bpercent\b/g, '百分之'],
  [/\bdegrees\b/g, '度'],
  [/\bdegree\b/g, '度'],
  [/\bfactorial\b/g, '的阶乘'],
  [/\bchoose\b/g, '选取'],
  [/\bpermute\b/g, '排列'],
  [/\breciprocal\b/g, '倒数'],
  [/\bthe inverse\b/g, '逆'],
  [/\binverse\b/g, '逆'],

  // ==================== 矩阵 / 向量 ====================
  [/\bthe (\d+) by (\d+) column matrix\b/g, (_m, r, c) => `${r} 行 ${c} 列列矩阵`],
  [/\bthe (\d+) by (\d+) row matrix\b/g, (_m, r, c) => `${r} 行 ${c} 列行矩阵`],
  [/\bthe (\d+) by (\d+) matrix\b/g, (_m, r, c) => `${r} 行 ${c} 列矩阵`],
  [/\bthe 1 by 1 matrix with entry\b/g, '1 行 1 列矩阵,元素为'],
  [/\bcolumn matrix\b/g, '列矩阵'],
  [/\brow matrix\b/g, '行矩阵'],
  [/\bcolumn vector\b/g, '列向量'],
  [/\brow vector\b/g, '行向量'],
  [/\bmatrix\b/g, '矩阵'],
  [/\bend matrix\b/g, '矩阵结束'],
  [/\bend vector\b/g, '向量结束'],
  [/\bRow (\d+):/g, (_m, k) => `第 ${k} 行:`],
  [/\bColumn (\d+):/g, (_m, k) => `第 ${k} 列:`],

  // ==================== 省略号 / 语气词 ====================
  [/\bdot dot dot\b/g, '等等'],
  [/\bellipsis\b/g, '等等'],
  [/\band so on up to\b/g, '一直到'],
  [/\band so on\b/g, '等等'],

  // ==================== 特殊布局 / 几何 ====================
  [/\bthe line segment\b/g, '线段'],
  [/\bthe point with coordinates\b/g, '点坐标'],
  [/\bthe repeating decimal\b/g, '循环小数'],
  [/\bfollowed by repeating digits?\b/g, '接循环节'],
  [/\bpoint followed by repeating digits?\b/g, '小数点后循环节'],

  // ==================== StartFraction / EndFraction (mathspeak fallback) ====================
  // 某些复杂表达式 SRE 会输出 mathspeak 风格关键字,兜底翻译成可听懂的中文
  [/\bStartFraction\b/g, '分数开始'],
  [/\bEndFraction\b/g, '分数结束'],
  [/\bStartRoot\b/g, '根号'],
  [/\bEndRoot\b/g, '根号结束'],
  [/\bStartFrac\b/g, '分数'],
  [/\bEndFrac\b/g, '分数结束'],
  [/\bStartAbsoluteValue\b/g, '绝对值'],
  [/\bEndAbsoluteValue\b/g, '绝对值结束'],
  [/\bStartSet\b/g, '集合'],
  [/\bEndSet\b/g, '集合结束'],
  [/\bStartLayout\b/g, '布局'],
  [/\bEndLayout\b/g, '布局结束'],
  [/\bStartMatrix\b/g, '矩阵'],
  [/\bEndMatrix\b/g, '矩阵结束'],
  [/\bBaseline\b/g, '基线'],
  [/\bBase\b/g, '底'],
  [/\bNumber\b/g, '数'],
  [/\bNum\b/g, '分子'],
  [/\bOver\b/g, '除以'],
  [/\bSubscript\b/g, '下标'],
  [/\bSuperscript\b/g, '上标'],
  [/\bSub\b/g, '下'],
  [/\bSup\b/g, '上'],

  // ==================== 复合结构末尾 ====================
  [/\bend fraction\b/g, '分数结束'],
  [/\bend enclosed\b/g, '包围结束'],
  [/\bend crossout\b/g, '划除结束'],
  [/\bcrossed out with\b/g, '划除'],
  [/\bcrossed out\b/g, '划除'],
  [/\bevaluated at\b/g, '在此取值'],
  [/\bminus the same expression evaluated at\b/g, '减去同一表达式在此取值'],
  [/\bwith conclusion\b/g, '得出'],
  [/\bwith Label\b/g, '标注为'],
  [/\bwith label\b/g, '标注为'],

  // ==================== 其它零散 ====================
  [/\barc\b/g, '弧'],
  [/\bprime\b/g, '撇'],
  [/\bblank\b/g, '空白'],
  [/\bcolon-equals\b/g, '定义为'],
  [/\bendfrac\b/g, '分数结束'],
];

/**
 * 单 token 映射:1:1 简单替换,用 word-boundary 严格匹配。
 * 覆盖 SRE 输出里最常见的单词级 token。
 */
const TOKEN_MAP: Readonly<Record<string, string>> = {
  // ============ 基础运算 ============
  plus: '加',
  minus: '减',
  times: '乘以',
  'divided by': '除以',
  over: '除以',
  per: '每',
  by: '乘',
  equals: '等于',
  of: '的',
  and: '与',
  or: '或',
  with: '与',
  from: '从',
  to: '到',
  in: '在',
  under: '在下面',
  the: '',
  comma: '逗号',
  negative: '负',
  positive: '正',
  zero: '零',
  point: '点',

  // ============ 希腊字母(全大小写) ============
  alpha: '阿尔法', beta: '贝塔', gamma: '伽马', delta: '德尔塔',
  epsilon: '艾普西龙', zeta: '泽塔', eta: '伊塔', theta: '西塔',
  iota: '约塔', kappa: '卡帕', lambda: '拉姆达', mu: '缪',
  nu: '纽', xi: '克西', omicron: '奥米克戎', pi: '派',
  rho: '柔', sigma: '西格玛', tau: '陶', upsilon: '宇普西龙',
  phi: '斐', chi: '希', psi: '普赛', omega: '欧米伽',
  Alpha: '大阿尔法', Beta: '大贝塔', Gamma: '大伽马', Delta: '大德尔塔',
  Theta: '大西塔', Lambda: '大拉姆达', Xi: '大克西', Pi: '大派',
  Sigma: '大西格玛', Phi: '大斐', Psi: '大普赛', Omega: '大欧米伽',

  // ============ 常用函数 ============
  sine: '正弦',
  cosine: '余弦',
  tangent: '正切',
  cotangent: '余切',
  secant: '正割',
  cosecant: '余割',
  logarithm: '对数',
  log: '对数',
  ln: '自然对数',
  exp: '指数',
  infinity: '无穷',
  // SRE 有些函数会直接输出原始 LaTeX 命令名(没转成 english),补齐常见的
  sup: '上确界',
  inf: '下确界',
  min: '最小值',
  max: '最大值',
  gcd: '最大公约数',
  lcm: '最小公倍数',
  det: '行列式',
  dim: '维度',
  ker: '核',
  arg: '幅角',
  Re: '实部',
  Im: '虚部',
  mod: '模',
  sgn: '符号',
  csc: '余割',
  sec: '正割',
  cot: '余切',
  tan: '正切',
  sin: '正弦',
  cos: '余弦',
  lg: '常用对数',
  arccos: '反余弦',
  arcsin: '反正弦',
  arctan: '反正切',
  sinh: '双曲正弦',
  cosh: '双曲余弦',
  tanh: '双曲正切',
  coth: '双曲余切',

  // ============ 布尔 ============
  not: '非',
  true: '真',
  false: '假',
  approximately: '约',

  // ============ SRE 输出的辅助词 ============
  power: '次方',
  base: '底',
  square: '平方',
  cubic: '立方',
  th: '第',
  given: '给定',
  number: '数',
  operator: '运算符',
  cases: '情形',
  lines: '行',
  rows: '行',
  steps: '步',
  elements: '个元素',
  premise: '前提',
  premises: '前提',
  axiom: '公理',
  label: '标注',
  Layout: '布局',
  identifier: '标识符',
  unit: '单位',
};

/**
 * TOKEN_MAP 预编译:模块加载期一次性生成 (RegExp, replacement) 数组,
 * 避免每次 speechEnToZh 调用都 new RegExp × N 次。
 */
const TOKEN_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = Object.entries(
  TOKEN_MAP,
).map(([en, zh]) => {
  const source = en.includes(' ')
    ? '\\b' + en.replace(/ +/g, '\\s+') + '\\b'
    : '\\b' + en + '\\b';
  return [new RegExp(source, 'g'), zh] as const;
});

/**
 * Single-letter allow-list for `findUntranslated()`. Variable names like
 * x/y/z and constants like e/i should stay as raw letters in Chinese speech
 * output (they're spoken letter-by-letter by TTS), not flagged as unhandled.
 */
const SINGLE_LETTERS = new Set([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]);

/**
 * Convert SRE clearspeak English speech output to Chinese speech text.
 *
 * @param speech - English speech output from `SRE.toSpeech(mathml)`
 * @returns Chinese speech text
 */
export function speechEnToZh(speech: string): string {
  if (!speech) return '';
  let s = ' ' + speech + ' ';

  // 1) Phrase-level patterns (long → short, order-sensitive)
  for (const [re, rep] of PHRASE_PATTERNS) {
    s =
      typeof rep === 'string'
        ? s.replace(re, rep)
        : s.replace(re, rep as (...args: string[]) => string);
  }

  // 2) Single-token replacements (word-boundary, precompiled)
  for (const [re, zh] of TOKEN_PATTERNS) {
    s = s.replace(re, zh);
  }

  // 3) Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ').trim();

  return s;
}

/**
 * Diagnostic helper: scans translated speech for lingering English words
 * that likely indicate missing rules. Single-letter variables (a/b/x/y/...)
 * are excluded from the returned list.
 *
 * Useful during development to identify SRE outputs that need new rules.
 *
 * @example
 *   const zh = speechEnToZh(en);
 *   const missing = findUntranslated(zh);
 *   if (missing.length) console.warn('untranslated:', missing);
 */
export function findUntranslated(zh: string): string[] {
  if (!zh) return [];
  const matches = zh.match(/[A-Za-z]+/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of matches) {
    if (SINGLE_LETTERS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}
