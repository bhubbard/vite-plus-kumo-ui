/**
 * Shared fixtures for the cross-engine parity harness.
 *
 * Every fixture is fed to both the Rust engine and the JavaScript fallback and
 * the full diagnostic arrays must match — ruleId, line, column, message,
 * suggestion and severity. Counts alone are not enough: past regressions
 * changed only the message text, or only the column unit.
 *
 * When you add a rule or change a diagnostic string, add a fixture here.
 */
export const fixtures = [
  // --- dispatch ---------------------------------------------------------
  { name: 'markdown is not linted', file: 'README.md', code: '<button>hi</button> bg-red-500' },
  { name: 'vue is not linted', file: 'Foo.vue', code: '<button>hi</button>' },
  { name: 'json is not linted', file: 'data.json', code: '{"a":"bg-red-500"}' },
  { name: 'svg is not linted', file: 'logo.svg', code: '<path fill="#ff0000" style="x"/>' },
  { name: 'plain ts is not linted', file: 'util.ts', code: 'export const s = "<button> bg-red-500 dark:foo";' },
  { name: 'plain js is not linted', file: 'util.js', code: 'export const s = "<button> bg-red-500 dark:foo";' },
  { name: 'tsx is linted', file: 'util.tsx', code: 'export const s = "<button> bg-red-500 dark:foo";' },
  { name: 'jsx is linted', file: 'util.jsx', code: 'export const s = "<button> bg-red-500";' },

  // --- comments ---------------------------------------------------------
  { name: 'trailing line comment', file: 'a.tsx', code: 'const x = 1; // <button> and bg-red-500' },
  { name: 'url in string is not a comment', file: 'a.tsx', code: '<div className="bg-red-500" data-url="https://example.com/t">ok</div>' },
  { name: 'block comment body', file: 'a.tsx', code: '/*\nconst c = "#ff0000";\nbg-red-500 dark:x\n*/\nexport const ok = 1;' },
  { name: 'props inside line comment', file: 'a.tsx', code: '// <Badge variant="bogus">x</Badge>' },
  { name: 'props inside block comment', file: 'a.tsx', code: '/*\n<Badge variant="bogus">x</Badge>\n*/' },
  { name: 'props after trailing comment', file: 'a.tsx', code: 'const y = 1; // <Badge variant="bogus">' },
  { name: 'apostrophe in jsx text', file: 'a.tsx', code: "<p>Don't</p>\n<div className=\"bg-red-500\">x</div>" },

  // --- unterminated tags (line-number corruption) -----------------------
  { name: 'unterminated tag in string', file: 'a.tsx', code: 'const s = "<Foo";\n<Badge variant="bogus">a</Badge>\n<Badge variant="nope">b</Badge>' },
  { name: 'unterminated tag in template', file: 'a.tsx', code: 'const t = `<Bar`;\n\n\n\n\n<Badge variant="bogus">a</Badge>' },
  { name: 'generic type argument', file: 'a.tsx', code: 'const [w, setW] = useState<WorkerResource | null>(null);\n<Badge variant="bogus">a</Badge>' },

  // --- multi-line tags --------------------------------------------------
  { name: 'multiline component tag', file: 'a.tsx', code: '<Badge\n  variant="bogus"\n>x</Badge>' },
  { name: 'tag with arrow function', file: 'a.tsx', code: '<Badge onClick={() => go()} variant="bogus">x</Badge>' },
  { name: 'multiline raw button', file: 'a.tsx', code: '<button\n  type="button"\n>Click</button>' },
  { name: 'multiline raw anchor', file: 'a.tsx', code: '<a\n  href="/x"\n>Link</a>' },
  { name: 'lookalike tags', file: 'a.tsx', code: '<article><abbr title="x">y</abbr></article><buttonish />' },

  // --- colors -----------------------------------------------------------
  { name: 'hex outside class attribute', file: 'a.tsx', code: 'const BRAND = "#f6821f";' },
  { name: 'seven digit hex is not a color', file: 'a.tsx', code: '<div style={{ color: "#abcdefa" }} />' },
  { name: 'six digit hex', file: 'a.tsx', code: '<div style={{ color: "#abcdef" }} />' },
  { name: 'three digit hex', file: 'a.tsx', code: '<div style={{ color: "#fff" }} />' },
  { name: 'eight digit hex', file: 'a.tsx', code: '<div style={{ color: "#aabbccdd" }} />' },

  // --- columns with non-ASCII -------------------------------------------
  { name: 'bullet before match', file: 'a.tsx', code: '<div className="• bg-red-500">x</div>' },
  { name: 'emoji before match', file: 'a.tsx', code: '<div className="\u{1F4A1} bg-red-500">x</div>' },
  { name: 'multiple non-ascii', file: 'a.tsx', code: '<div className="•••• dark:x">é</div>\n<span className="bg-red-500">ü</span>' },


  // --- imports / controls -----------------------------------------------
  { name: 'forbidden block import', file: 'a.tsx', code: "import { PageHeader, Button } from '@cloudflare/kumo';" },
  { name: 'multiline forbidden block import', file: 'a.tsx', code: "import {\n  PageHeader,\n  Button\n} from '@cloudflare/kumo';" },
  { name: 'multiple raw controls one line', file: 'a.tsx', code: '<div><button>One</button><button>Two</button><input /></div>' },
  { name: 'kumo components are not raw', file: 'a.tsx', code: '<Button variant="primary">x</Button><Input placeholder="p" /><Link href="#">l</Link>' },
  { name: 'local component shadows kumo name', file: 'a.tsx', code: 'function Button() { return null; }\n<Button variant="custom" />' },
  { name: 'aliased kumo component props', file: 'a.tsx', code: 'import { Button as KumoButton } from "@cloudflare/kumo";\n<KumoButton variant="bogus" />' },
  { name: 'namespace kumo component props', file: 'a.tsx', code: 'import * as Kumo from "@cloudflare/kumo";\n<Kumo.Button variant="bogus" />' },

  // --- template literals and regex literals (N-1 … N-3) -----------------
  { name: 'unclosed block comment in template', file: 'a.tsx', code: 'const q = `\n  /* not a comment, just SQL\n`;\n<div className="bg-red-500">x</div>\n<Badge variant="bogus">y</Badge>' },
  { name: 'line comment marker in template', file: 'a.tsx', code: 'const u = `\nhttps://example.com bg-red-500\n`;' },
  { name: 'real comments beside a template', file: 'a.tsx', code: 'const q = `text`;\n// <button> bg-red-500\n/* dark:x */\n<div className="bg-kumo-base">ok</div>' },
  { name: 'template expression is code context', file: 'a.tsx', code: 'const q = `a ${ /* bg-red-500 */ x } b`;\n<div className="bg-kumo-base">ok</div>' },
  { name: 'nested template in expression', file: 'a.tsx', code: 'const q = `a ${ `b ${ c } d` } e`;\n<div className="bg-red-500">x</div>' },
  { name: 'escaped backtick in template', file: 'a.tsx', code: 'const q = `a \\` /* still text */ b`;\n<div className="bg-red-500">x</div>' },
  { name: 'regex with escaped slashes', file: 'a.tsx', code: 'const re = /https:\\/\\//; const c = "#ff0000";' },
  { name: 'division is not a comment', file: 'a.tsx', code: 'const r = a / b; const c = "#ff0000";' },

  // --- string literals vs JSX (N-5) -------------------------------------
  { name: 'jsx in double-quoted string', file: 'a.tsx', code: `const s = "<Badge variant='bogus'>";` },
  { name: 'jsx in single-quoted string', file: 'a.tsx', code: `const s = '<Badge variant="bogus">';` },
  { name: 'jsx in template string', file: 'a.tsx', code: "const s = `<Badge variant='bogus'>`;" },
  { name: 'jsx in call argument', file: 'a.tsx', code: `render("<Badge variant='bogus'>");` },
  { name: 'apostrophe in jsx text keeps tags visible', file: 'a.tsx', code: '<p>Don\'t stop</p>\n<Badge variant="bogus">y</Badge>' },
  { name: 'attribute strings still validated', file: 'a.tsx', code: '<Badge variant="bogus" title="x">y</Badge>' },
  { name: 'expression wrapped static prop', file: 'a.tsx', code: '<Badge variant={"bogus"}>y</Badge>' },
  { name: 'template wrapped static prop', file: 'a.tsx', code: '<Badge variant={`bogus`}>y</Badge>' },
  { name: 'same line component columns', file: 'a.tsx', code: '<Badge variant="primary"/><Badge variant="bogus"/>' },
  { name: 'regex character class comment markers', file: 'a.tsx', code: 'const re = /[/*]/;\n<Badge variant="bogus" />' },
  { name: 'multiline string then tag', file: 'a.tsx', code: 'const s = "unterminated\n<Badge variant="bogus">y</Badge>' },

  // --- css / html -------------------------------------------------------
  { name: 'css missing directives', file: 'index.css', code: 'body { color: red; }' },
  { name: 'css with directives', file: 'index.css', code: '@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";\n@import "@cloudflare/kumo/styles/tailwind";\n@import "tailwindcss";' },
  { name: 'commented css directives do not count', file: 'index.css', code: '/* @source "../node_modules/@cloudflare/kumo/dist/**/*"; @import "@cloudflare/kumo/styles/tailwind"; */' },
  { name: 'css hardcoded hex', file: 'component.css', code: '.card { color: #ff0000; }' },
  { name: 'commented css hex is ignored', file: 'component.css', code: '/* color: #ff0000; */' },
  { name: 'html without theme script', file: 'index.html', code: '<html><head><title>x</title></head><body><div id="root"></div></body></html>' },
  { name: 'html with data-mode only in body', file: 'index.html', code: '<html><head><title>x</title></head><body><div data-mode="dark"></div></body></html>' },
  { name: 'html comment does not satisfy theme script', file: 'index.html', code: '<html><head><!-- document.documentElement.setAttribute("data-mode","dark") --></head></html>' },
  { name: 'unrelated head script does not satisfy theme rule', file: 'index.html', code: '<html><head><script>localStorage.getItem("theme")</script></head></html>' },
  { name: 'html with theme script', file: 'index.html', code: '<html><head><script>document.documentElement.setAttribute("data-mode","dark")</script></head><body></body></html>' },
];

/** Option sets exercised against every fixture. */
export const optionSets = [
  { name: 'defaults', options: {} },
  { name: 'all-off', options: { rawControls: 'off', rawLinks: 'off', hardcodedColors: 'off', invalidProps: 'off', forbiddenImports: 'off', checkFoucScript: 'off', cssDirectives: 'off' } },
  { name: 'all-error', options: { rawControls: 'error', hardcodedColors: 'error', invalidProps: 'error', forbiddenImports: 'error', checkFoucScript: 'error', cssDirectives: 'error' } },
  { name: 'raw-controls-off-links-on', options: { rawControls: 'off', rawLinks: 'error' } },
  { name: 'css-warn', options: { cssDirectives: 'warn' } },
  { name: 'vanilla-mode', options: { stylingMode: 'vanilla' } },
  { name: 'no-tailwind-check', options: { checkTailwindV4: false } },
];
