#!/usr/bin/env node
/**
 * Cross-engine parity harness.
 *
 * The plugin ships two rule engines — a Rust native binding and a JavaScript
 * fallback — and picks whichever is available at runtime. Developers on a
 * platform with a prebuilt binding therefore get different results from CI,
 * which runs the fallback. `kumo-drift-check.mjs` compares diagnostic *counts*
 * against a baseline, so any divergence turns into a CI failure nobody can
 * reproduce locally.
 *
 * This harness runs every fixture through both engines in separate child
 * processes and requires the complete diagnostic arrays to match — ruleId,
 * line, column, message, suggestion and severity.
 *
 * Usage:
 *   node scripts/kumo-parity-check.mjs
 *
 * Exits 0 when the engines agree, 1 when they diverge, and 2 when the native
 * binding could not be loaded at all (nothing to compare — build it first with
 * `npm --prefix packages/vite-plus-kumo run build`).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtures, optionSets } from './kumo-parity-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pluginEntry = path.resolve(rootDir, 'packages/vite-plus-kumo/dist/index.js');

const RUNNER = `
import { lintCode, isNativeEngine } from ${JSON.stringify(pluginEntry)};
import { fixtures, optionSets } from ${JSON.stringify(path.resolve(__dirname, 'kumo-parity-fixtures.mjs'))};
const out = { native: isNativeEngine(), results: {} };
for (const set of optionSets) {
  for (const f of fixtures) {
    out.results[set.name + ' :: ' + f.name] = lintCode(f.file, f.code, set.options).diagnostics;
  }
}
process.stdout.write(JSON.stringify(out));
`;

function run(env) {
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', RUNNER], {
    cwd: rootDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

let nativeRun;
try {
  nativeRun = run({ VITE_PLUS_KUMO_NO_NATIVE: '0' });
} catch (err) {
  console.error('[parity] Failed to run the native engine:', err.message);
  process.exit(2);
}

if (!nativeRun.native) {
  console.error('[parity] Native binding not loaded — nothing to compare against.');
  console.error('[parity] Build it first: npm --prefix packages/vite-plus-kumo run build');
  process.exit(2);
}

const jsRun = run({ VITE_PLUS_KUMO_NO_NATIVE: '1' });
if (jsRun.native) {
  console.error('[parity] VITE_PLUS_KUMO_NO_NATIVE=1 did not disable the native engine.');
  process.exit(2);
}

const keys = Object.keys(nativeRun.results);
const failures = [];

for (const key of keys) {
  const a = nativeRun.results[key];
  const b = jsRun.results[key];
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    failures.push({ key, rust: a, js: b });
  }
}

if (failures.length === 0) {
  console.log(`[parity] OK — ${keys.length} engine comparisons agree (${fixtures.length} fixtures x ${optionSets.length} option sets).`);
  process.exit(0);
}

console.error(`[parity] FAILED — ${failures.length} of ${keys.length} comparisons diverge.\n`);
for (const { key, rust, js } of failures) {
  console.error(`  ${key}`);
  const max = Math.max(rust.length, js.length);
  for (let i = 0; i < max; i++) {
    const r = rust[i];
    const j = js[i];
    if (JSON.stringify(r) === JSON.stringify(j)) continue;
    console.error(`    [${i}] rust: ${r ? JSON.stringify(r) : '(none)'}`);
    console.error(`    [${i}] js  : ${j ? JSON.stringify(j) : '(none)'}`);
  }
  console.error('');
}
process.exit(1);
