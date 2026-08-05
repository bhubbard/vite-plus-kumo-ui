import { type Plugin, type ViteDevServer, type ResolvedConfig } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export type Severity = 'error' | 'warn' | 'off';
export type StylingMode = 'tailwind' | 'vanilla' | 'css' | 'none';

export interface KumoPluginOptions {
  /** Severity level for raw native HTML controls (<button>, <input>, etc.). Default: 'warn' */
  rawControls?: Severity;
  /** Severity level for raw native `<a>` anchors. Defaults to `rawControls`. */
  rawLinks?: Severity;
  /**
   * Severity for hardcoded hex colour literals. Default: 'warn'
   *
   * Class-name colour rules — raw Tailwind palette colours, `bg-white`,
   * `dark:` variants, legacy `cf-*` and unknown `*-kumo-*` tokens — are
   * delegated to `eslint-plugin-better-tailwindcss`.
   */
  hardcodedColors?: Severity;
  /** Severity level for invalid Kumo component props. Default: 'warn' */
  invalidProps?: Severity;
  /** Severity level for the CSS entry-point directive rules. Default: 'error' */
  cssDirectives?: Severity;
  /** Check CSS entry points for required Tailwind v4 Kumo directives. Default: true */
  checkTailwindV4?: boolean;
  /** Styling mode: 'tailwind' (default), 'vanilla' (or 'css'), or 'none'. Default: 'tailwind' */
  stylingMode?: StylingMode;
  /** Alias for stylingMode */
  cssMode?: StylingMode;
  /** Severity level for forbidden direct imports of CLI scaffolded blocks from `@cloudflare/kumo`. Default: 'error' */
  forbiddenImports?: Severity;
  /** Severity level for missing blocking dark-mode initialization script in index.html <head>. Default: 'warn' */
  checkFoucScript?: Severity;
  /** Custom CSS entry point path relative to workspace root */
  cssPath?: string;
  /** Custom ignore patterns */
  ignorePatterns?: string[];
}

export interface KumoDiagnostic {
  ruleId: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
  severity: string;
}

export interface LintResult {
  filename: string;
  diagnostics: KumoDiagnostic[];
  formattedReport: string;
  hasErrors: boolean;
}

interface NativeBinding {
  lintCode(filename: string, code: string, optionsJson?: string): LintResult;
  getEngineVersion(): string;
  getRulesetVersion(): string;
}

const EXPECTED_ENGINE_VERSION = '0.1.0';
const EXPECTED_RULESET_VERSION = '2';

interface GeneratedAllowlists {
  componentProps: Record<string, Record<string, string[]>>;
}

// ---------------------------------------------------------------------------
// Diagnostic text.
//
// Duplicated verbatim from the Rust engine
// (`crates/vite-plus-kumo/src/rules/mod.rs`). The parity harness
// (`scripts/kumo-parity-check.mjs`) asserts both engines emit byte-identical
// diagnostics, so any edit here must be mirrored there.
// ---------------------------------------------------------------------------
const MSG_RAW_BUTTON = 'Raw native `<button>` element detected.';
const SUG_RAW_BUTTON = 'Replace with `<Button>` from `@cloudflare/kumo`.';
const MSG_RAW_INPUT = 'Raw native `<input>` element detected.';
const SUG_RAW_INPUT = 'Replace with `<Input>` or `<Checkbox>`/`<Radio>` from `@cloudflare/kumo`.';
const MSG_RAW_SELECT = 'Raw native `<select>` element detected.';
const SUG_RAW_SELECT = 'Replace with `<Select>` or `<Combobox>` from `@cloudflare/kumo`.';
const MSG_RAW_TEXTAREA = 'Raw native `<textarea>` element detected.';
const SUG_RAW_TEXTAREA = 'Replace with `<Textarea>` from `@cloudflare/kumo`.';
const MSG_RAW_ANCHOR = 'Raw native `<a>` element detected in JSX.';
const SUG_RAW_ANCHOR = 'Use `<Link>` from `@cloudflare/kumo` to ensure consistent theme styling and accessibility.';
const SUG_HEX_COLOR = 'Use Kumo semantic color tokens like `bg-kumo-base`, `text-kumo-default`, or `bg-kumo-brand`.';
const MSG_FORBIDDEN_IMPORT = 'Forbidden direct import of scaffolded Kumo UI block from `@cloudflare/kumo`.';
const SUG_FORBIDDEN_IMPORT = "CLI scaffolded blocks (e.g. PageHeader, ResourceList, DeleteResource) must be copied into your project's source directory (e.g. via `npx @cloudflare/kumo add <block>`), not imported directly from `@cloudflare/kumo`.";
const MSG_FOUC = 'No theme initialization script detected in index.html <head>.';
const SUG_FOUC = 'Add an inline script in <head> to read saved theme (e.g. setting `data-mode` on <html>) before initial render to prevent Flash of Unstyled Content (FOUC).';
const MSG_CSS_IMPORT = 'Missing required Kumo CSS stylesheet import in CSS entry point.';
const SUG_CSS_IMPORT = 'Add `@import "@cloudflare/kumo/styles/css";` or `@import "@cloudflare/kumo/styles/theme-kumo.css";` to your CSS file.';
const MSG_TAILWIND_V4 = 'Missing required Kumo Tailwind v4 directives in CSS file.';
const SUG_TAILWIND_V4 = 'Add `@source "../node_modules/@cloudflare/kumo/dist/**/*";` and `@import "@cloudflare/kumo/styles/tailwind";` to your CSS entry point.';

function loadGeneratedAllowlists(): GeneratedAllowlists | null {
  const allowlistPaths = [
    path.resolve(__dirname, 'generated_allowlists.json'),
    path.resolve(__dirname, '../generated_allowlists.json'),
    path.resolve(process.cwd(), 'packages/vite-plus-kumo/generated_allowlists.json'),
  ];
  for (const p of allowlistPaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        // continue
      }
    }
  }
  return null;
}

const allowlists = loadGeneratedAllowlists();
if (!allowlists) {
  console.warn('[vite-plus-kumo] Warning: Generated allowlists (generated_allowlists.json) not found. Component prop validation will be skipped.');
}

const nativeLoadErrors: string[] = [];

function platformPackageName(): string | null {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') return 'vite-plus-kumo-darwin-arm64';
    if (process.arch === 'x64') return 'vite-plus-kumo-darwin-x64';
  }

  if (process.platform === 'linux' && (process.arch === 'x64' || process.arch === 'arm64')) {
    try {
      const report = process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined;
      if (!report?.header?.glibcVersionRuntime) return null;
    } catch {
      return null;
    }
    return process.arch === 'x64' ? 'vite-plus-kumo-linux-x64-gnu' : 'vite-plus-kumo-linux-arm64-gnu';
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'vite-plus-kumo-win32-x64-msvc';
  }

  return null;
}

function validateNativeBinding(mod: any, source: string): NativeBinding | null {
  if (
    !mod ||
    typeof mod.lintCode !== 'function' ||
    typeof mod.getEngineVersion !== 'function' ||
    typeof mod.getRulesetVersion !== 'function'
  ) {
    nativeLoadErrors.push(`${source}: native binding does not expose the required version handshake`);
    return null;
  }

  const engineVersion = mod.getEngineVersion();
  const rulesetVersion = mod.getRulesetVersion();
  if (engineVersion !== EXPECTED_ENGINE_VERSION || rulesetVersion !== EXPECTED_RULESET_VERSION) {
    nativeLoadErrors.push(
      `${source}: incompatible native engine ${engineVersion}/ruleset ${rulesetVersion}; expected ${EXPECTED_ENGINE_VERSION}/ruleset ${EXPECTED_RULESET_VERSION}`,
    );
    return null;
  }

  return mod as NativeBinding;
}

function loadNativeBinding(): NativeBinding | null {
  if (process.env.VITE_PLUS_KUMO_NO_NATIVE === '1') {
    return null;
  }
  const customPath = process.env.VITE_PLUS_KUMO_BINDING;
  const cwd = process.cwd();

  const candidatePaths = [
    ...(customPath ? [customPath] : []),
    // A `crates/` target directory only exists when working inside this
    // repository, never in an installed package — so preferring it is safe,
    // and it stops a packaged binary from shadowing a fresh local build.
    path.resolve(__dirname, '../../../crates/vite-plus-kumo/target/release/vite_plus_kumo.node'),
    path.resolve(__dirname, '../../crates/vite-plus-kumo/target/release/vite_plus_kumo.node'),
    path.resolve(cwd, 'crates/vite-plus-kumo/target/release/vite_plus_kumo.node'),
    path.resolve(__dirname, 'vite_plus_kumo.node'),
    path.resolve(__dirname, '../vite_plus_kumo.node'),
    path.resolve(__dirname, 'libvite_plus_kumo.dylib'),
    path.resolve(__dirname, 'libvite_plus_kumo.so'),
    path.resolve(__dirname, 'vite_plus_kumo.dll'),
    path.resolve(__dirname, '../dist/libvite_plus_kumo.dylib'),
    path.resolve(__dirname, '../../../crates/vite-plus-kumo/target/release/libvite_plus_kumo.dylib'),
    path.resolve(__dirname, '../../crates/vite-plus-kumo/target/release/libvite_plus_kumo.dylib'),
    path.resolve(cwd, 'crates/vite-plus-kumo/target/release/libvite_plus_kumo.dylib'),
    path.resolve(cwd, 'packages/vite-plus-kumo/vite_plus_kumo.node'),
  ];

  for (const p of candidatePaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const binding = validateNativeBinding(require(p), p);
      if (binding) return binding;
    } catch (err: any) {
      nativeLoadErrors.push(`${p}: ${err?.message || err}`);
    }
  }

  const packageName = platformPackageName();
  if (packageName) {
    try {
      return validateNativeBinding(require(packageName), packageName);
    } catch (err: any) {
      nativeLoadErrors.push(`${packageName}: ${err?.message || err}`);
    }
  }

  return null;
}

const nativeBinding = loadNativeBinding();
let warnedFallback = false;

/**
 * Column number (1-based) in **Unicode scalar values**, not UTF-16 code units.
 *
 * The Rust engine reports the same unit, so a `•` earlier in the line cannot
 * shift the two engines apart.
 */
function colAt(haystack: string, utf16Index: number): number {
  return Array.from(haystack.slice(0, utf16Index)).length + 1;
}

function positionAt(content: string, utf16Index: number): { line: number; column: number } {
  const before = content.slice(0, utf16Index);
  const line = before.split('\n').length;
  const lineStart = before.lastIndexOf('\n') + 1;
  return { line, column: colAt(content.slice(lineStart), utf16Index - lineStart) };
}

/** Lexer state that must survive across line boundaries. */
interface MaskState {
  /** Inside an unterminated `/* … *\/`. */
  inBlock: boolean;
  /**
   * One entry per open template literal; the value is how many `${` blocks are
   * currently open inside it. A trailing `0` means "in template text".
   *
   * Tracking this across lines is what stops a `/*` or `//` sitting in the body
   * of a multi-line template literal from opening a comment — which previously
   * blanked the rest of the file.
   */
  templates: number[];
}

/**
 * Blank out comment content, replacing every commented character with a space.
 *
 * One character in, one character out, so line and column numbers — and the
 * offsets every rule reports — are unchanged. Single and double quote state
 * resets per line (those literals cannot span lines); block-comment and
 * template-literal state carry across lines via `state`.
 */
function maskCommentsLine(line: string, state: MaskState): string {
  const chars = Array.from(line);
  const n = chars.length;
  let out = '';

  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inRegex = false;
  let regexCharClass = false;
  let prevCode: string | null = null;

  while (i < n) {
    const c = chars[i];

    if (state.inBlock) {
      if (c === '*' && i + 1 < n && chars[i + 1] === '/') {
        out += '  ';
        i += 2;
        state.inBlock = false;
      } else {
        out += ' ';
        i += 1;
      }
      continue;
    }

    // Template literal *text* — everything here is data, not code, so no
    // comment may start. Only the closing backtick and `${` matter.
    if (!inSingle && !inDouble && state.templates.length > 0 && state.templates[state.templates.length - 1] === 0) {
      if (c === '\\' && i + 1 < n) {
        out += c + chars[i + 1];
        i += 2;
      } else if (c === '`') {
        state.templates.pop();
        out += c;
        i += 1;
      } else if (c === '$' && i + 1 < n && chars[i + 1] === '{') {
        state.templates[state.templates.length - 1] += 1;
        out += '${';
        i += 2;
      } else {
        out += c;
        i += 1;
      }
      continue;
    }

    // Comment-looking text inside a regex literal is inert, notably `/[/*]/`.
    if (inRegex) {
      if (c === '\\' && i + 1 < n) {
        out += c + chars[i + 1];
        i += 2;
        continue;
      }
      if (c === '[') regexCharClass = true;
      else if (c === ']') regexCharClass = false;
      else if (c === '/' && !regexCharClass) inRegex = false;
      out += c;
      i += 1;
      continue;
    }

    // Code context: top level, or inside a `${ … }` expression.
    if (!inSingle && !inDouble && c === '/' && i + 1 < n) {
      if (chars[i + 1] === '/') {
        out += ' '.repeat(n - i);
        break;
      }
      if (chars[i + 1] === '*') {
        out += '  ';
        i += 2;
        state.inBlock = true;
        continue;
      }
      if (prevCode === null || '=([{,:;!?&|'.includes(prevCode)) {
        inRegex = true;
        regexCharClass = false;
        out += c;
        i += 1;
        continue;
      }
    }

    if ((inSingle || inDouble) && c === '\\' && i + 1 < n) {
      out += c + chars[i + 1];
      i += 2;
      continue;
    }

    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (c === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (c === '`' && !inSingle && !inDouble) {
      state.templates.push(0);
    } else if (!inSingle && !inDouble && state.templates.length > 0) {
      // Track `${ … }` nesting so the closing brace returns us to template
      // text rather than leaving us in code context forever.
      const top = state.templates.length - 1;
      if (state.templates[top] > 0) {
        if (c === '{') {
          state.templates[top] += 1;
        } else if (c === '}') {
          state.templates[top] -= 1;
        }
      }
    }

    if (!/\s/.test(c)) prevCode = c;
    out += c;
    i += 1;
  }

  return out;
}

/** Mask every comment in `content`, preserving line and column structure. */
export function maskComments(content: string): string {
  const state: MaskState = { inBlock: false, templates: [] };
  return content
    .split('\n')
    .map((l) => maskCommentsLine(l, state))
    .join('\n');
}

interface JsxTagMatch {
  compName: string;
  attrs: string;
  line: number;
  column: number;
}

interface KumoBindings {
  named: Map<string, string>;
  namespaces: Set<string>;
  locals: Set<string>;
}

function collectKumoBindings(content: string): KumoBindings {
  const bindings: KumoBindings = {
    named: new Map(),
    namespaces: new Set(),
    locals: new Set(),
  };

  for (const match of content.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_$]*)\b/g)) {
    bindings.locals.add(match[1]);
  }
  for (const match of content.matchAll(/\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:,|\s+from\s+['"])/g)) {
    bindings.locals.add(match[1]);
  }
  for (const match of content.matchAll(/\bimport\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, local, source] = match;
    bindings.locals.add(local);
    if (source === '@cloudflare/kumo') bindings.namespaces.add(local);
  }
  for (const match of content.matchAll(/\bimport\s+\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gs)) {
    const [, specifiers, source] = match;
    for (const specifier of specifiers.split(',')) {
      const parts = specifier.trim().split(/\s+/);
      const imported = parts[0];
      if (!imported || imported === 'type') continue;
      const local = parts[1] === 'as' && parts[2] ? parts[2] : imported;
      bindings.locals.add(local);
      if (source === '@cloudflare/kumo') bindings.named.set(local, imported);
    }
  }
  return bindings;
}

function resolveKumoComponent(bindings: KumoBindings, tagName: string): string | null {
  const named = bindings.named.get(tagName);
  if (named) return named;

  const segments = tagName.split('.');
  if (segments.length === 2 && bindings.namespaces.has(segments[0])) return segments[1];
  if (/^[A-Z]/.test(tagName) && !bindings.locals.has(tagName)) return tagName;
  return null;
}

/**
 * Upper bound on how far the scanner will look for a tag's closing `>`.
 *
 * Real JSX tags are far shorter than this. The bound matters because a `<`
 * followed by an uppercase letter that never closes — a generic, a comparison,
 * a fragment inside a string — makes the scanner rewind and re-enter the same
 * region, which is quadratic without a cap.
 */
const MAX_TAG_SCAN_CHARS = 4096;


function findJsxTags(content: string): JsxTagMatch[] {
  const results: JsxTagMatch[] = [];
  const chars = Array.from(content);
  const n = chars.length;

  let lineNum = 1;
  let colNum = 1;

  let k = 0;
  while (k < n) {
    const c = chars[k];

    if (c === '\n') {
      lineNum++;
      colNum = 1;
      k++;
      continue;
    }

    // Skip over string and template literals in code position, so markup held
    // in a string — `const s = "<Badge variant='x'>"` — is not mistaken for
    // real JSX.
    const apostropheInText = c === "'" && k > 0 && k + 1 < n && /[A-Za-z0-9]/.test(chars[k - 1]) && /[A-Za-z0-9]/.test(chars[k + 1]);
    if (c === '"' || c === '`' || (c === "'" && !apostropheInText)) {
      const quote = c;
      let j = k + 1;
      colNum += 1;
      while (j < n) {
        const jc = chars[j];
        if (jc === '\\' && j + 1 < n) {
          if (chars[j + 1] === '\n') {
            lineNum++;
            colNum = 1;
          } else {
            colNum += 2;
          }
          j += 2;
          continue;
        }
        if (jc === '\n') {
          lineNum++;
          colNum = 1;
          j += 1;
          // A single- or double-quoted literal cannot span lines; treat the
          // newline as the end of it.
          if (quote !== '`') break;
          continue;
        }
        colNum += 1;
        j += 1;
        if (jc === quote) break;
      }
      k = j;
      continue;
    }

    if (c === '<' && k + 1 < n && /[A-Za-z]/.test(chars[k + 1])) {
      const startLine = lineNum;
      const startCol = colNum;

      const nameStart = k + 1;
      let nameEnd = nameStart;
      while (nameEnd < n && /[A-Za-z0-9._-]/.test(chars[nameEnd])) {
        nameEnd++;
      }

      if (nameEnd > nameStart) {
        // The inner scan advances the counters as it walks. If it never finds a
        // closing `>` it must not leave them at EOF, or every later diagnostic
        // reports a line that does not exist.
        const savedLine = lineNum;
        const savedCol = colNum;

        let j = nameEnd;
        colNum += nameEnd - k;
        let braceDepth = 0;
        let inSingle = false;
        let inDouble = false;
        let inBacktick = false;
        let tagEnd: number | null = null;
        const scanLimit = Math.min(n, nameEnd + MAX_TAG_SCAN_CHARS);

        while (j < scanLimit) {
          const jc = chars[j];
          if (jc === "'" && !inDouble && !inBacktick) {
            inSingle = !inSingle;
          } else if (jc === '"' && !inSingle && !inBacktick) {
            inDouble = !inDouble;
          } else if (jc === '`' && !inSingle && !inDouble) {
            inBacktick = !inBacktick;
          } else if (!inSingle && !inDouble && !inBacktick) {
            if (jc === '{') {
              braceDepth++;
            } else if (jc === '}') {
              if (braceDepth > 0) braceDepth--;
            } else if (braceDepth === 0 && jc === '>') {
              tagEnd = j;
              break;
            }
          }

          if (jc === '\n') {
            lineNum++;
            colNum = 1;
          } else {
            colNum++;
          }
          j++;
        }

        if (tagEnd !== null) {
          results.push({
            compName: chars.slice(nameStart, nameEnd).join(''),
            attrs: chars.slice(nameEnd, tagEnd).join(''),
            line: startLine,
            column: startCol,
          });
          k = tagEnd + 1;
          colNum++;
          continue;
        }

        // Unterminated tag: rewind the counters and treat `<` as text.
        lineNum = savedLine;
        colNum = savedCol;
      }
    }

    colNum++;
    k++;
  }

  return results;
}


function lintCodeFallback(filename: string, code: string, options: KumoPluginOptions): LintResult {
  const diagnostics: KumoDiagnostic[] = [];
  const ignorePatterns = options.ignorePatterns || ['node_modules', 'dist', '.git'];
  const normFile = filename.replace(/\\/g, '/');

  const empty = (): LintResult => ({ filename, diagnostics: [], formattedReport: '', hasErrors: false });

  for (const pattern of ignorePatterns) {
    const pat = pattern.replace(/^\/|\/$/g, '');
    if (!pat) continue;
    const matched = normFile.split('/').some((seg) => seg === pat) || (pattern.includes('/') && normFile.includes(pat));
    if (matched) {
      return empty();
    }
  }

  const stylingMode = options.stylingMode || options.cssMode || 'tailwind';
  const cssDirectives = options.cssDirectives || 'error';
  // `rawLinks` inherits `rawControls` so one knob still turns both off.
  const rawLinks = options.rawLinks ?? options.rawControls ?? 'warn';

  // Mirrors `analyze_file` in the Rust engine: JSX rules run over JSX files
  // only, and unknown extensions are not linted at all.
  const isJsx = filename.endsWith('.tsx') || filename.endsWith('.jsx');
  const isCss = filename.endsWith('.css') || filename.endsWith('.scss');
  const isHtml = filename.endsWith('.html');

  if (isHtml) {
    if (options.checkFoucScript !== 'off') {
      const uncommented = code.replace(/<!--[\s\S]*?-->/gi, '');
      const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(uncommented)?.[1] ?? '';
      const hasFoucScript = Array.from(head.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)).some((match) =>
        /(?:setAttribute\s*\(\s*['"]data-mode['"]\s*,|\.dataset\s*\.\s*mode\s*=)/i.test(maskComments(match[1] ?? '')),
      );
      if (!hasFoucScript) {
        diagnostics.push({
          ruleId: 'kumo/check-fouc-script',
          line: 1,
          column: 1,
          message: MSG_FOUC,
          suggestion: SUG_FOUC,
          severity: options.checkFoucScript || 'warn',
        });
      }
    }
  } else if (isCss) {
    const maskedCss = maskComments(code);
    if (options.hardcodedColors !== 'off') {
      const hexRegex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
      let match: RegExpExecArray | null;
      while ((match = hexRegex.exec(maskedCss)) !== null) {
        diagnostics.push({
          ruleId: 'kumo/no-hardcoded-colors',
          ...positionAt(maskedCss, match.index),
          message: `Hardcoded hex color '${match[0]}' detected.`,
          suggestion: SUG_HEX_COLOR,
          severity: options.hardcodedColors || 'warn',
        });
      }
    }

    if (stylingMode !== 'none' && cssDirectives !== 'off') {
      if (stylingMode === 'vanilla' || stylingMode === 'css') {
        const hasKumoCssImport = /^\s*@import\s+(?:url\(\s*)?["']@cloudflare\/kumo\/styles(?:\/css|\/theme-kumo(?:\.css)?)?["']\s*\)?/im.test(maskedCss);
        if (!hasKumoCssImport) {
          diagnostics.push({
            ruleId: 'kumo/check-kumo-css-import',
            line: 1,
            column: 1,
            message: MSG_CSS_IMPORT,
            suggestion: SUG_CSS_IMPORT,
            severity: cssDirectives,
          });
        }
      } else if (options.checkTailwindV4 !== false) {
        const hasSource = /^\s*@source\s+["'][^"']*(?:node_modules\/)?@cloudflare\/kumo\/dist\/(?:\*\*\/\*|[^"']+)["']/im.test(maskedCss);
        const hasImport = /^\s*@import\s+(?:url\(\s*)?["']@cloudflare\/kumo\/styles\/tailwind["']\s*\)?/im.test(maskedCss);
        if (!hasSource || !hasImport) {
          diagnostics.push({
            ruleId: 'kumo/check-tailwind-v4-kumo-source',
            line: 1,
            column: 1,
            message: MSG_TAILWIND_V4,
            suggestion: SUG_TAILWIND_V4,
            severity: cssDirectives,
          });
        }
      }
    }
  } else if (isJsx) {
    // Every rule runs against comment-masked source, so neither the line-based
    // rules nor the multi-line tag scanner can fire inside a comment.
    const masked = maskComments(code);
    const lines = masked.split('\n');

    if (options.forbiddenImports !== 'off') {
      const forbiddenRegex = /\bimport\s+(?:type\s+)?\{[^}]*\b(?:PageHeader|ResourceList|DeleteResource|LayerCard|CommandPalette|TableOfContents)\b[^}]*\}\s*from\s*['"]@cloudflare\/kumo['"]/gs;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = forbiddenRegex.exec(masked)) !== null) {
        diagnostics.push({
          ruleId: 'kumo/no-forbidden-imports',
          ...positionAt(masked, importMatch.index),
          message: MSG_FORBIDDEN_IMPORT,
          suggestion: SUG_FORBIDDEN_IMPORT,
          severity: options.forbiddenImports || 'error',
        });
      }
    }

    const tags = findJsxTags(masked);
    const bindings = collectKumoBindings(masked);
    for (const tag of tags) {
      const rawControl = tag.compName === 'button'
        ? [MSG_RAW_BUTTON, SUG_RAW_BUTTON]
        : tag.compName === 'input'
          ? [MSG_RAW_INPUT, SUG_RAW_INPUT]
          : tag.compName === 'select'
            ? [MSG_RAW_SELECT, SUG_RAW_SELECT]
            : tag.compName === 'textarea'
              ? [MSG_RAW_TEXTAREA, SUG_RAW_TEXTAREA]
              : null;
      if (rawControl && options.rawControls !== 'off') {
        diagnostics.push({
          ruleId: 'kumo/no-raw-controls',
          line: tag.line,
          column: tag.column,
          message: rawControl[0],
          suggestion: rawControl[1],
          severity: options.rawControls || 'warn',
        });
      }
      if (tag.compName === 'a' && rawLinks !== 'off') {
        diagnostics.push({
          ruleId: 'kumo/no-raw-links',
          line: tag.line,
          column: tag.column,
          message: MSG_RAW_ANCHOR,
          suggestion: SUG_RAW_ANCHOR,
          severity: rawLinks,
        });
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      let m: RegExpExecArray | null;


      // 2. Hardcoded hex colors.
      //
      // Class-name colour rules live in `better-tailwindcss`; a hex literal in
      // a `style` prop or a constant is not a class, so it stays here.
      if (options.hardcodedColors !== 'off') {
        const hexRegex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
        while ((m = hexRegex.exec(line)) !== null) {
          diagnostics.push({
            ruleId: 'kumo/no-hardcoded-colors',
            line: lineNum,
            column: colAt(line, m.index),
            message: `Hardcoded hex color '${m[0]}' detected.`,
            suggestion: SUG_HEX_COLOR,
            severity: options.hardcodedColors || 'warn',
          });
        }
      }
    }

    // 6. Component Prop Validation (multiline & expression aware)
    if (options.invalidProps !== 'off' && allowlists) {
      for (const tagMatch of tags) {
        const canonicalName = resolveKumoComponent(bindings, tagMatch.compName);
        if (!canonicalName) continue;
        const compRules = allowlists.componentProps[canonicalName];
        if (!compRules) continue;
        const attrRegex = /\b([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\})/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(tagMatch.attrs)) !== null) {
          const propName = attrMatch[1];
          const propVal = attrMatch.slice(2).find((value) => value !== undefined) ?? '';
          const validValues = compRules[propName];
          if (validValues && !validValues.includes(propVal)) {
            const formattedValid = [...validValues].sort().map((v) => `'${v}'`).join(', ');
            diagnostics.push({
              ruleId: 'kumo/validate-kumo-props',
              line: tagMatch.line,
              column: tagMatch.column,
              message: `Invalid ${propName} '${propVal}' passed to <${tagMatch.compName}>.`,
              suggestion: `Valid ${propName} values for <${tagMatch.compName}> are: ${formattedValid}.`,
              severity: options.invalidProps || 'warn',
            });
          }
        }
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const formattedReport = diagnostics.length > 0
    ? `\n[vite-plus-kumo] ${filename}\n` + diagnostics.map((d) => `  L${d.line}:${d.column} [${d.severity.toUpperCase()}] ${d.message} (${d.suggestion})`).join('\n')
    : '';

  return {
    filename,
    diagnostics,
    formattedReport,
    hasErrors,
  };
}

/** True when the native Rust engine is in use, false when the JS fallback is. */
export function isNativeEngine(): boolean {
  return nativeBinding !== null;
}

const CONFIG_FILENAMES = ['kumo-lint.config.json', 'kumo-lint.json'];
const CONFIG_KEYS = new Set<keyof KumoPluginOptions>([
  'rawControls',
  'rawLinks',
  'hardcodedColors',
  'invalidProps',
  'cssDirectives',
  'checkTailwindV4',
  'stylingMode',
  'cssMode',
  'forbiddenImports',
  'checkFoucScript',
  'cssPath',
  'ignorePatterns',
]);
const SEVERITY_KEYS: ReadonlyArray<keyof KumoPluginOptions> = [
  'rawControls',
  'rawLinks',
  'hardcodedColors',
  'invalidProps',
  'cssDirectives',
  'forbiddenImports',
  'checkFoucScript',
];

function validateKumoOptions(value: unknown, source = 'vite-plus-kumo options'): KumoPluginOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${source} must be a JSON object.`);
  }

  const options = value as Record<string, unknown>;
  for (const key of Object.keys(options)) {
    if (!CONFIG_KEYS.has(key as keyof KumoPluginOptions)) {
      throw new TypeError(`${source} contains unknown option '${key}'.`);
    }
  }
  for (const key of SEVERITY_KEYS) {
    const setting = options[key];
    if (setting !== undefined && setting !== 'error' && setting !== 'warn' && setting !== 'off') {
      throw new TypeError(`${source}.${key} must be 'error', 'warn', or 'off'.`);
    }
  }
  for (const key of ['stylingMode', 'cssMode'] as const) {
    const setting = options[key];
    if (setting !== undefined && setting !== 'tailwind' && setting !== 'vanilla' && setting !== 'css' && setting !== 'none') {
      throw new TypeError(`${source}.${key} must be 'tailwind', 'vanilla', 'css', or 'none'.`);
    }
  }
  if (options.checkTailwindV4 !== undefined && typeof options.checkTailwindV4 !== 'boolean') {
    throw new TypeError(`${source}.checkTailwindV4 must be a boolean.`);
  }
  if (options.cssPath !== undefined && typeof options.cssPath !== 'string') {
    throw new TypeError(`${source}.cssPath must be a string.`);
  }
  if (
    options.ignorePatterns !== undefined &&
    (!Array.isArray(options.ignorePatterns) || options.ignorePatterns.some((pattern) => typeof pattern !== 'string'))
  ) {
    throw new TypeError(`${source}.ignorePatterns must be an array of strings.`);
  }
  return options as KumoPluginOptions;
}

/**
 * Load shared plugin options from disk.
 *
 * The Vite plugin, the standalone CLI and the drift check all read the same
 * file, so a severity set in one place applies everywhere. Without this the
 * CLI and drift check ran under hard-coded defaults while `vite.config.ts`
 * configured only the dev/build path.
 */
export function loadKumoConfig(rootDir: string = process.cwd()): KumoPluginOptions {
  for (const name of CONFIG_FILENAMES) {
    const configPath = path.resolve(rootDir, name);
    if (!fs.existsSync(configPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const { $schema: _schema, '//': _comment, ...opts } = parsed ?? {};
      return validateKumoOptions(opts, configPath);
    } catch (err: any) {
      throw new Error(`[vite-plus-kumo] Invalid ${name}: ${err?.message || err}`);
    }
  }
  return {};
}

export function lintCode(filename: string, code: string, options: KumoPluginOptions = {}): LintResult {
  const validatedOptions = validateKumoOptions(options);
  const serializedOptions = JSON.stringify(validatedOptions);
  return nativeBinding
    ? nativeBinding.lintCode(filename, code, serializedOptions)
    : lintCodeFallback(filename, code, validatedOptions);
}

export function kumoUiPlugin(options: KumoPluginOptions = {}): Plugin {
  const validatedOptions = validateKumoOptions(options);
  options = validatedOptions;
  let server: ViteDevServer | undefined;
  let rootDir = process.cwd();
  let logger: ResolvedConfig['logger'] | undefined;
  let isBuild = false;
  let warnedFallbackHere = false;
  const serializedOptions = JSON.stringify(validatedOptions);

  const logReport = (report: string) => {
    if (logger) {
      logger.info(report);
    } else {
      console.log(report);
    }
  };

  const logWarn = (msg: string) => {
    if (logger) {
      logger.warn(msg);
    } else {
      console.warn(msg);
    }
  };

  return {
    name: 'vite-plus-kumo',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      rootDir = config.root || process.cwd();
      logger = config.logger;
      isBuild = config.command === 'build';
    },

    configureServer(devServer) {
      server = devServer;
    },

    buildStart() {
      let resolvedCssPath: string | null = null;

      if (options.cssPath) {
        resolvedCssPath = path.resolve(rootDir, options.cssPath);
      } else {
        const candidates = ['src/index.css', 'src/app.css', 'src/styles.css', 'src/main.css', 'index.css'];
        for (const candidate of candidates) {
          const fullPath = path.resolve(rootDir, candidate);
          if (fs.existsSync(fullPath)) {
            resolvedCssPath = fullPath;
            break;
          }
        }
      }

      if (resolvedCssPath && fs.existsSync(resolvedCssPath)) {
        const cssContent = fs.readFileSync(resolvedCssPath, 'utf-8');
        const res = nativeBinding
          ? nativeBinding.lintCode(resolvedCssPath, cssContent, serializedOptions)
          : lintCodeFallback(resolvedCssPath, cssContent, options);

        if (res && res.formattedReport) {
          logReport(res.formattedReport);
          if (res.hasErrors && isBuild) {
            this.error('Kumo UI compliance checks failed during build.');
          }
        }
      }

      const htmlPath = path.resolve(rootDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        const res = nativeBinding
          ? nativeBinding.lintCode(htmlPath, htmlContent, serializedOptions)
          : lintCodeFallback(htmlPath, htmlContent, options);

        if (res && res.formattedReport) {
          logReport(res.formattedReport);
          if (res.hasErrors && isBuild) {
            this.error('Kumo UI HTML compliance checks failed during build.');
          }
        }
      }
    },

    transform(code: string, id: string) {
      if (id.includes('node_modules')) {
        return null;
      }

      const cleanId = id.split('?')[0];

      if (!cleanId.endsWith('.tsx') && !cleanId.endsWith('.jsx')) {
        return null;
      }

      if (!nativeBinding && !warnedFallbackHere && !warnedFallback) {
        warnedFallbackHere = true;
        warnedFallback = true;
        logWarn(
          '[vite-plus-kumo] Native Rust linter binding not found. Operating with JS fallback linter.\n' +
          (nativeLoadErrors.length > 0 ? `  Load attempts failed:\n    ${nativeLoadErrors.join('\n    ')}\n` : '')
        );
      }

      const res = nativeBinding
        ? nativeBinding.lintCode(cleanId, code, serializedOptions)
        : lintCodeFallback(cleanId, code, options);

      if (res && res.diagnostics.length > 0) {
        if (res.formattedReport) {
          logReport(res.formattedReport);
        }

        if (server) {
          server.ws.send({
            type: 'custom',
            event: 'kumo:diagnostics',
            data: res.diagnostics,
          });
        }

        if (res.hasErrors && isBuild) {
          this.error(`Kumo UI compliance error in ${cleanId}`);
        }
      }

      return null;
    },
  };
}

export default kumoUiPlugin;
