# Vite + Kumo UI (`vite-plus-kumo-ui`)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-code.brandonhubbard.com-brightgreen?logo=github)](https://code.brandonhubbard.com/vite-plus-kumo-ui/)

A modern React 19 + TypeScript + Vite project integrated with Cloudflare's **Kumo UI** design system (`@cloudflare/kumo`) and powered by a custom **high-performance Rust Vite / Vite-Plus linter plugin** (`vite-plus-kumo`).

> 🎮 **Live Interactive Visualizer & Demo:** [vite-plus-kumo-ui on code.brandonhubbard.com](https://code.brandonhubbard.com/vite-plus-kumo-ui/)

---

## Workspace Architecture

```
vite-plus-kumo-ui/
├── src/                          # React application demonstration using Kumo UI
│   ├── App.tsx                   # Main dashboard (Edge Infrastructure, Analytics, WAF, Settings)
│   ├── components/kumo/          # Scaffolded Kumo UI blocks (PageHeader, DeleteResource)
│   └── index.css                 # Tailwind CSS v4 & Kumo UI theme integration
├── packages/vite-plus-kumo/      # Vite / Vite-Plus plugin package (@cloudflare/kumo compliance)
│   ├── index.ts                  # Plugin implementation with Vite logger & WebSocket HMR notifications
│   ├── generated_allowlists.json # JS fallback allowlist data
│   └── dist/                     # Compiled JS module and native binding (.node)
├── crates/vite-plus-kumo/        # High-performance Rust static analysis engine
│   ├── build.rs                  # Optional, explicitly gated allowlist generation
│   └── src/
│       ├── config.rs             # Plugin options schema & Serde severity defaults
│       ├── lib.rs                # N-API native bindings for Node.js
│       └── rules/                # Linter rules engine & generated Rust allowlists
├── scripts/                      # Developer tooling & CI verification
│   ├── generate-allowlists.mjs   # Parses @cloudflare/kumo CSS & component registry to generate allowlists
│   ├── kumo-drift-check.mjs      # Enforces baseline design system drift rules
│   ├── kumo-drift-baseline.json  # Baselined diagnostic counts per source file
│   ├── kumo-parity-check.mjs     # Asserts the Rust and JS engines agree exactly
│   └── kumo-parity-fixtures.mjs  # Shared fixtures for the parity harness
├── .github/workflows/ci.yml      # Rust tests, engine parity, type-check, lint, build
├── kumo.json                     # Kumo UI CLI configuration for block scaffolding
├── kumo-lint.config.json         # Shared linter severities (plugin + CLI + drift check)
└── AUDIT.md                      # Complete codebase audit report
```

---

## Features & Enforcement Rules

The `vite-plus-kumo` plugin automatically enforces Cloudflare Kumo UI standards:

Enforcement is split between two linters, each doing what it is actually good at.

#### `vite-plus-kumo` — structure and API correctness

- **Raw HTML Control Detection (`kumo/no-raw-controls`)**: Flags native `<button>`, `<input>`, `<select>`, `<textarea>` elements in favor of Kumo primitives (`<Button>`, `<Input>`, `<Select>`, `<Textarea>`).
- **Raw Link Detection (`kumo/no-raw-links`)**: Flags native `<a>` tags in favor of `<Link>`. Configurable separately via `rawLinks`; inherits `rawControls` when unset.
- **Hardcoded Hex Colors (`kumo/no-hardcoded-colors`)**: Flags hex literals such as `#ffffff` in `style` props and constants — values that are not class names, so no class-aware linter sees them.
- **Component Prop Validation (`kumo/validate-kumo-props`)**: Validates JSX prop variants against Kumo's machine-readable `component-registry.json`. Multi-line tags and tags containing arrow functions are handled.
- **Forbidden Block Direct Imports (`kumo/no-forbidden-imports`)**: Prevents importing scaffolded blocks directly from `@cloudflare/kumo`.
- **FOUC Prevention (`kumo/check-fouc-script`)**: Verifies an inline theme initialization script inside `<head>` in `index.html`.
- **Tailwind v4 Kumo Directives (`kumo/check-tailwind-v4-kumo-source`)**: Enforces `@source` and `@import` directives in CSS entry points.
- **Kumo CSS Import (`kumo/check-kumo-css-import`)**: Enforces the Kumo stylesheet import when `stylingMode` is `vanilla` / `css`.

JSX rules apply to `.tsx` and `.jsx` files only, and all source is comment-masked before analysis, so commented-out markup is never flagged.

#### `eslint-plugin-better-tailwindcss` — everything about class names

Run through **oxlint** via `jsPlugins` (see `.oxlintrc.json`) — no ESLint, no second linter in CI.

- **`no-unknown-classes`**: any class Tailwind cannot generate, including misspelled Kumo tokens such as `bg-kumo-invalid` or `text-kumo-fake`.
- **`no-conflicting-classes`**: classes that set the same CSS property (`p-4 p-8`).
- **`no-concatenated-classes`**, **`no-duplicate-classes`**, **`no-deprecated-classes`**, **`no-unnecessary-whitespace`**.
- **`no-restricted-classes`**: raw Tailwind palette colors (`bg-red-500`), non-themeable `bg-white` / `text-black`, `dark:` variants, and legacy `cf-*` classes.

These used to be hand-rolled regex rules inside `vite-plus-kumo`. They resolve the **real Tailwind config** from `src/index.css` instead of pattern-matching source text, which is both stricter — it validates every utility, not just `*-kumo-*` — and immune to the lexing bugs that repeatedly affected the regex versions.

Class-order and line-wrapping rules are deliberately **off**: enabling them rewrites every `className` in the repo in a single autofix. Turn them on in `.oxlintrc.json` when you want that diff.

### Configuration

`vite-plus-kumo` severities live in **`kumo-lint.config.json`** at the repo root. The Vite plugin, the standalone CLI and the drift check all load it through `loadKumoConfig()`, so one file configures every entry point.

Class-name rules are configured in **`.oxlintrc.json`** and run via `npm run lint`.

> **Note:** oxlint's JS plugin support is currently **alpha**. If `npm run lint` fails to start, remove `jsPlugins` from `.oxlintrc.json` to fall back to oxlint's built-in rules only — the `vite-plus-kumo` rules are unaffected either way.

### Two engines, held identical

The plugin runs a Rust engine when a native binding is available for the current platform and an equivalent JavaScript engine when it is not. `npm run lint:kumo:parity` runs every fixture through both and requires byte-identical diagnostics — ruleId, line, column, message, suggestion and severity. CI runs it on every push.

---

## Available Scripts

### Development & Build
- `npm run dev` — Launch Vite dev server with HMR.
- `npm run build` — Compile TypeScript and build production bundle.
- `npm run preview` — Preview production build.

### Testing & Quality Assurance
- `npm run test` — Run Rust unit tests, the full type-check, and native/fallback parity.
- `npm run typecheck` — Type-check `src/`, `vite.config.ts` **and** the plugin package.
- `npm run lint` — Run Oxlint code linter.
- `npm run lint:kumo` — Run Kumo design system drift check against baseline.
- `npm run lint:kumo:cli` — Run the standalone Kumo CLI linter over `src/`.
- `npm run lint:kumo:parity` — Assert the Rust and JavaScript engines produce identical diagnostics.
- `npm run lint:kumo:update` — Re-baseline Kumo design system drift counts after approved changes.
- `npm run generate:allowlists` — Regenerate the color/prop allowlists from the installed `@cloudflare/kumo`.

### Plugin Build
- `npm --prefix packages/vite-plus-kumo run build` — Compile release Rust binary (`vite_plus_kumo.node`), run TypeScript compiler (`tsc`), and package the plugin.

---

## License

MIT © Brandon Hubbard
