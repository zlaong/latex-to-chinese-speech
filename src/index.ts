/**
 * latex-to-chinese-speech
 *
 * Convert LaTeX math formulas to Chinese speech text, suitable for
 * feeding into any TTS engine (Volcano seed-tts, Alibaba, Azure, etc.).
 *
 * Pipeline: LaTeX → temml (MathML) → speech-rule-engine (English clearspeak)
 *        → built-in en→zh mapping → Chinese speech text
 *
 * @example
 *   import { ready, toChinese, isReady } from 'latex-to-chinese-speech';
 *
 *   // At app startup
 *   void ready();
 *
 *   // Later, in your TTS pipeline
 *   if (isReady()) {
 *     const zh = toChinese('\\frac{1}{2}', false);
 *     // → "二分之一"
 *   }
 *
 * @packageDocumentation
 */

export {
  ready,
  isReady,
  toChinese,
  configure,
  clearCache,
  type ConfigureOptions,
} from './mathspeak';

export { speechEnToZh, findUntranslated } from './enToZh';
