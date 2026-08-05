#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCode, loadKumoConfig } from '../dist/index.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
vite-plus-kumo CLI - High-performance Cloudflare Kumo UI linter

Usage:
  npx vite-plus-kumo [command] [target-path] [options]

Commands:
  lint [path]    Lint target directory or file (default: src/)

Options:
  --help, -h     Show this help message
  --version, -v  Show version
  --strict       Treat warnings as errors
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  console.log(`vite-plus-kumo v${pkg.version}`);
  process.exit(0);
}

let targetPath = 'src';

const positionalArgs = args.filter((a) => !a.startsWith('-'));

if (positionalArgs.length > 0) {
  if (positionalArgs[0] === 'lint') {
    targetPath = positionalArgs[1] || 'src';
  } else {
    targetPath = positionalArgs[0];
  }
}

const isStrict = args.includes('--strict');
const cwd = process.cwd();
const absoluteTarget = path.resolve(cwd, targetPath);

function getFilesToLint(dirOrFile) {
  if (!fs.existsSync(dirOrFile)) {
    console.error(`Error: Target path '${dirOrFile}' does not exist.`);
    process.exit(1);
  }

  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) {
    return [dirOrFile];
  }

  let results = [];
  const entries = fs.readdirSync(dirOrFile, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dirOrFile, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
        results = results.concat(getFilesToLint(full));
      }
    } else if (/\.(tsx|ts|jsx|js|css|html)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Same options the Vite plugin and the drift check use.
const lintOptions = loadKumoConfig(cwd);
const cssEntryCandidates = ['src/index.css', 'src/app.css', 'src/styles.css', 'src/main.css', 'index.css'];

function resolveCssEntry() {
  if (lintOptions.cssPath) {
    return path.resolve(cwd, lintOptions.cssPath);
  }

  for (const candidate of cssEntryCandidates) {
    const candidatePath = path.resolve(cwd, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

const cssEntryPath = resolveCssEntry();

function optionsForFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.css') {
    return lintOptions;
  }

  if (cssEntryPath && path.resolve(filePath) === cssEntryPath) {
    return lintOptions;
  }

  return { ...lintOptions, stylingMode: 'none', cssMode: 'none' };
}

const files = getFilesToLint(absoluteTarget);
let totalErrors = 0;
let totalWarnings = 0;
let totalFilesWithIssues = 0;

console.log(`Scanning ${files.length} file(s) for Cloudflare Kumo UI compliance...\n`);

for (const filePath of files) {
  const relativePath = path.relative(cwd, filePath).replace(/\\/g, '/');
  const code = fs.readFileSync(filePath, 'utf8');
  const res = lintCode(filePath, code, optionsForFile(filePath));

  if (res.diagnostics.length > 0) {
    totalFilesWithIssues++;
    console.log(`\x1b[4m${relativePath}\x1b[0m`);

    for (const diag of res.diagnostics) {
      const isError = diag.severity === 'error' || isStrict;
      if (isError) totalErrors++;
      else totalWarnings++;

      const severityTag = isError ? '\x1b[31merror\x1b[0m' : '\x1b[33mwarning\x1b[0m';
      console.log(`  ${diag.line}:${diag.column}  ${severityTag}  ${diag.message}  \x1b[90m${diag.ruleId}\x1b[0m`);
      if (diag.suggestion) {
        console.log(`    \x1b[36m➜ ${diag.suggestion}\x1b[0m`);
      }
    }
    console.log('');
  }
}

if (totalFilesWithIssues === 0) {
  console.log('\x1b[32m✔ No Kumo UI design system violations found.\x1b[0m');
  process.exit(0);
} else {
  console.log(`Summary: ${totalErrors} error(s), ${totalWarnings} warning(s) across ${totalFilesWithIssues} file(s).`);
  if (totalErrors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
