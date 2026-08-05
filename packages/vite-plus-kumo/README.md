# vite-plus-kumo ⚡🦀

Rust-powered plugin for Vite and `vite-plus` enforcing **Cloudflare Kumo UI** design system standards, component prop validation, semantic light/dark mode color rules, and Tailwind CSS v4 setup.

## Rules

| Rule | What it catches |
|---|---|
| `kumo/no-raw-controls` | Native `<button>`, `<input>`, `<select>`, `<textarea>` elements |
| `kumo/no-raw-links` | Native `<a>` anchors (use `<Link>`) |
| `kumo/no-hardcoded-colors` | Hex colour literals (`#ffffff`) in `style` props and constants |
| `kumo/validate-kumo-props` | Invalid variant/size props on Kumo components |
| `kumo/no-forbidden-imports` | Scaffolded blocks imported directly from `@cloudflare/kumo` |
| `kumo/check-fouc-script` | Missing blocking theme-init script in `<head>` |
| `kumo/check-tailwind-v4-kumo-source` | Missing `@source` / `@import` directives in the CSS entry point (Tailwind mode) |
| `kumo/check-kumo-css-import` | Missing Kumo stylesheet import in the CSS entry point (vanilla mode) |

Component prop allowlists are generated from `@cloudflare/kumo` when this plugin is released. The package declares a compatible Kumo peer range and invalid configurations or unsupported option values fail with an actionable error instead of silently weakening enforcement.

### Class-name rules are not this plugin's job

Validating Tailwind class names — unknown tokens, raw palette colours, `dark:`
variants, legacy `cf-*` prefixes — needs the resolved Tailwind config, not
pattern matching over source text. Use
[`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss),
which runs under **oxlint** via `jsPlugins`:

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["eslint-plugin-better-tailwindcss"],
  "settings": { "better-tailwindcss": { "entryPoint": "src/index.css" } },
  "rules": {
    "better-tailwindcss/no-unknown-classes": "error",
    "better-tailwindcss/no-conflicting-classes": "error",
    "better-tailwindcss/no-restricted-classes": ["error", {
      "restrict": [
        { "pattern": "^dark:", "message": "Kumo switches theme via data-mode." },
        { "pattern": "^cf-", "message": "Legacy class — migrate to kumo- tokens." }
      ]
    }]
  }
}
```

`no-unknown-classes` covers everything the removed `kumo/valid-kumo-colors`
rule did — including text-only tokens such as `bg-kumo-default` — and every
other utility besides.

JSX rules run over `.tsx` and `.jsx` files only. CSS directive rules run only on the configured or auto-discovered `.css` entry point, and the FOUC check runs over `.html`. Comments are masked before analysis, so commented-out markup is never flagged.

## Platform support

The generic `vite-plus-kumo` package contains the JavaScript implementation and installs the matching native binding as an optional dependency when one is available:

| Platform | Architecture | Native package |
|---|---|---|
| macOS | ARM64 | `vite-plus-kumo-darwin-arm64` |
| macOS | x64 | `vite-plus-kumo-darwin-x64` |
| Linux (glibc) | ARM64 | `vite-plus-kumo-linux-arm64-gnu` |
| Linux (glibc) | x64 | `vite-plus-kumo-linux-x64-gnu` |
| Windows (MSVC) | x64 | `vite-plus-kumo-win32-x64-msvc` |

The generic tarball does not contain a native binary. Package managers use each optional package's `os`, `cpu`, and, on Linux, `libc` metadata to install only the compatible binding. The loader verifies the native engine and ruleset versions before using it.

**When the optional package is unavailable, omitted, fails to load, or fails the version handshake, the plugin safely falls back to the equivalent JavaScript implementation** — same rules, same diagnostics, slower on large codebases. The two engines are held byte-identical by a parity harness in CI; see `scripts/kumo-parity-check.mjs`.

To force the fallback (useful when debugging), set `VITE_PLUS_KUMO_NO_NATIVE=1`. To point at a binding you built yourself, set `VITE_PLUS_KUMO_BINDING=/path/to/vite_plus_kumo.node`. Local repository builds continue to load `packages/vite-plus-kumo/vite_plus_kumo.node` before trying an optional package.

## Installation

Install the plugin alongside its `@cloudflare/kumo` and Vite peers:

```bash
npm install -D vite-plus-kumo @cloudflare/kumo vite
# or
pnpm add -D vite-plus-kumo @cloudflare/kumo vite
```

## Usage

Add `kumoUiPlugin()` to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { kumoUiPlugin } from 'vite-plus-kumo';

export default defineConfig({
  plugins: [
    react(),
    kumoUiPlugin({
      rawControls: 'warn',
      hardcodedColors: 'error',
      invalidProps: 'error',
      stylingMode: 'tailwind',
    }),
  ],
});
```

### Shared configuration

Passing options inline configures the Vite plugin only. If you also run the CLI
or a drift check, put the options in `kumo-lint.config.json` at your project
root and load them once, so every entry point enforces the same severities:

```typescript
import { kumoUiPlugin, loadKumoConfig } from 'vite-plus-kumo';

export default defineConfig({
  plugins: [kumoUiPlugin(loadKumoConfig())],
});
```

```jsonc
// kumo-lint.config.json
{
  "rawControls": "warn",
  "hardcodedColors": "error",
  "invalidProps": "error",
  "stylingMode": "tailwind"
}
```

`loadKumoConfig(rootDir?)` also reads `kumo-lint.json`. It returns `{}` when no
config file exists, and throws an actionable error for malformed files, unknown
options, invalid severities, or incorrect value types.

## Plugin Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `rawControls` | `'error' \| 'warn' \| 'off'` | `'warn'` | Severity for native HTML form controls |
| `rawLinks` | `'error' \| 'warn' \| 'off'` | inherits `rawControls` | Severity for native `<a>` anchors |
| `hardcodedColors` | `'error' \| 'warn' \| 'off'` | `'warn'` | Severity for hex colour literals |
| `invalidProps` | `'error' \| 'warn' \| 'off'` | `'warn'` | Severity for invalid Kumo component props |
| `forbiddenImports` | `'error' \| 'warn' \| 'off'` | `'error'` | Severity for direct imports of scaffolded blocks |
| `checkFoucScript` | `'error' \| 'warn' \| 'off'` | `'warn'` | Severity for a missing theme-init script in `<head>` |
| `cssDirectives` | `'error' \| 'warn' \| 'off'` | `'error'` | Severity for the CSS entry-point directive rules |
| `checkTailwindV4` | `boolean` | `true` | Enable the Tailwind v4 `@source` / `@import` check |
| `stylingMode` | `'tailwind' \| 'vanilla' \| 'css' \| 'none'` | `'tailwind'` | Which CSS rule set applies |
| `cssMode` | same as `stylingMode` | — | Alias for `stylingMode` |
| `cssPath` | `string` | auto-detected | Sole CSS entry point checked for directives, relative to the project/Vite root |
| `ignorePatterns` | `string[]` | `['node_modules', 'dist', '.git']` | Path segments to skip |

Without `cssPath`, the first existing path in `src/index.css`, `src/app.css`,
`src/styles.css`, `src/main.css`, or `index.css` is the CSS entry point. Other CSS
files do not receive entry-point directive diagnostics.

Ignore patterns are compared per path **segment**, so `ignorePatterns: ['dist']`
skips `src/dist/x.tsx` but not `src/distributed/x.tsx`.

## CLI

```bash
npx vite-plus-kumo lint src        # lint a directory or file
npx vite-plus-kumo lint src --strict   # treat warnings as errors
```

The CLI reads `kumo-lint.config.json` or `kumo-lint.json` from the working directory.

## License

[MIT](./LICENSE)
