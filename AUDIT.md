# Linter Architecture Change — class-name rules moved to `better-tailwindcss`

**Date:** 2026-08-05
**Why:** two consecutive audit rounds produced findings that were *all* hand-rolled lexing failures — template literals, regex literals, string context, comment masking. The parity harness could not catch any of them, because both engines share one design and fail together. Validating class names against a resolved Tailwind config removes that entire bug class rather than fixing instances of it.
**Constraint honoured:** oxlint only, no ESLint, Vite+ standard `.oxlintrc.json`.

---

## Verification

| Check | Result |
|---|---|
| `cargo test` | **35 passed**, 0 failed |
| `npm run lint:kumo:parity` | **378 comparisons agree** (54 fixtures × 7 option sets) |
| `npm run typecheck` | PASS |
| `npm run lint:kumo` (native / fallback) | PASS / PASS |
| `npm run lint:kumo:cli` (native / fallback) | PASS / PASS |
| `better-tailwindcss` rule behaviour | validated against this codebase — see below |
| `npm run lint` (oxlint + JS plugin) | **could not execute here** — see limitation |

---

## What moved

| Was (hand-rolled regex) | Now |
|---|---|
| `kumo/valid-kumo-colors` | `better-tailwindcss/no-unknown-classes` |
| `kumo/no-dark-prefix` | `better-tailwindcss/no-restricted-classes` (`^dark:`) |
| `kumo/no-legacy-classes` | `better-tailwindcss/no-restricted-classes` (`^cf-`) |
| raw palette colours + `bg-white`/`text-black` half of `kumo/no-hardcoded-colors` | `better-tailwindcss/no-restricted-classes` |
| — | `no-conflicting-classes`, `no-concatenated-classes`, `no-duplicate-classes`, `no-deprecated-classes`, `no-unnecessary-whitespace` *(new capability)* |

`kumo/no-hardcoded-colors` still owns **hex literals** — `style={{ color: '#f6821f' }}` is not a class name, so no class-aware linter sees it.

### What that removed from the engines

- 6 of 14 regexes, including `CLASS_ATTR_REGEX` — the hand-rolled `class`/`className` attribute-value parser that handled `"…"`, `'…'`, `` {`…`} ``, `{"…"}` and `{'…'}`. That parser was pure lexer surface and is now gone.
- The colour-token allowlist generation: `generate-allowlists.mjs` no longer scrapes `--color-kumo-*` / `--text-color-kumo-*` out of `theme-kumo.css`, and `generated_allowlists.json` is down to a single `componentProps` key. The scraped-token approach is exactly what `no-unknown-classes` replaces with a real resolve.
- Three plugin options (`validateKumoColors`, `darkPrefix`, `legacyClasses`) and their diagnostic strings.

---

## Evidence the replacement is not a downgrade

Run against this repo through the plugin's own API:

**Accepts every Kumo token used here** — `bg-kumo-base`, `text-kumo-default`, `border-kumo-line`, `bg-kumo-tint`, `text-kumo-success`, `bg-kumo-danger-tint`, `hover:text-kumo-brand`, `divide-kumo-hairline` → all clean.

**Catches everything the old rule caught, plus more:**

| Input | Result |
|---|---|
| `bg-kumo-invalid` | `no-unknown-classes: Unknown class detected` |
| `text-kumo-fake` | `no-unknown-classes: Unknown class detected` |
| `bg-kumo-default` (text-only token) | `no-unknown-classes` — the case the old rule needed a special-cased token split for |
| `totally-not-a-class` | caught — the old rule only inspected `*-kumo-*` |
| `p-4 p-8` | `no-conflicting-classes` — new |
| `flex flex` | `no-duplicate-classes` — new |
| `bg-red-500`, `text-blue-600` | `no-restricted-classes` |
| `bg-white`, `text-black` | `no-restricted-classes` |
| `dark:bg-gray-900` | `no-restricted-classes` |
| `cf-legacy-card` | `no-restricted-classes` **and** `no-unknown-classes` |

**No churn:** all four `src/**/*.tsx` files report zero messages.

---

## ⚠️ Limitation: the oxlint JS-plugin runtime could not be executed here

`npx oxlint` aborts as soon as `jsPlugins` is enabled:

```
thread 'tokio-rt-worker' panicked at crates/oxc_allocator/src/pool/fixed_size.rs:112:67
```

This reproduces with a **trivial no-op local plugin**, so it is oxlint's alpha JS-plugin machinery in this sandbox, not the config or `better-tailwindcss`. No env escape hatch exists. What I could verify instead:

1. **The config parses and the rule names route correctly.** Running the same file with `jsPlugins` removed gives `Plugin 'better-tailwindcss' not found` — oxlint recognises the rules as belonging to a plugin and looks for it in exactly the place `jsPlugins` provides.
2. **Every rule's behaviour**, through the plugin's own ESLint-compatible API, against this codebase — the table above.
3. **oxlint itself is healthy**: without `jsPlugins`, 0 warnings across 13 files with 103 rules.

**Please run `npm run lint` once on your machine.** If it aborts the same way, remove `jsPlugins` from `.oxlintrc.json` and the class-name rules simply don't run — `vite-plus-kumo` is unaffected. This caveat is in both READMEs.

---

## Files changed

```
.oxlintrc.json                           jsPlugins, settings.entryPoint, 7 rules
package.json                             + eslint-plugin-better-tailwindcss (devDependency)
kumo-lint.config.json                    dropped the three delegated options
crates/…/src/rules/mod.rs                6 regexes and 3 rules removed; 35 tests
crates/…/src/config.rs                   3 options removed
scripts/generate-allowlists.mjs          no longer generates colour tokens
crates/…/src/rules/generated_allowlists.rs   regenerated (props only)
packages/vite-plus-kumo/generated_allowlists.json  regenerated (props only)
packages/vite-plus-kumo/index.ts         same removals mirrored
packages/vite-plus-kumo/dist/index.js    recompiled
scripts/kumo-drift-check.mjs             ruleKeyMap trimmed
scripts/kumo-parity-fixtures.mjs         fixtures for removed rules dropped
README.md, packages/vite-plus-kumo/README.md   split of responsibilities documented
```

Class-order and line-wrapping rules are **off** in `.oxlintrc.json`: enabling them rewrites every `className` in the repo in one autofix. Flip them on when you want that diff.

---

## Still open

**Rebuild the native binding on macOS** — `npm --prefix packages/vite-plus-kumo run build`. The committed `.node` files predate all recent work; `npm run lint:kumo:parity` fails until you do.

Carried-forward Low findings, unchanged: `Table.Cell` flex layout (`App.tsx:321`, `:343`), the "Active Workers" count (`:237`), committed macOS-only binaries and packaging fields, the unanchored `target` in `.gitignore`, and the module-level `warnedFallback` guard.
