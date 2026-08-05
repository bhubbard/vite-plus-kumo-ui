import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCode, loadKumoConfig, isNativeEngine } from '../packages/vite-plus-kumo/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.resolve(rootDir, 'scripts/kumo-drift-baseline.json');

// Same options the Vite plugin and the CLI use, so a severity set in
// kumo-lint.config.json applies to the drift baseline too.
const lintOptions = loadKumoConfig(rootDir);
const cssEntryCandidates = ['src/index.css', 'src/app.css', 'src/styles.css', 'src/main.css', 'index.css'];

function resolveCssEntry() {
  if (lintOptions.cssPath) {
    return path.resolve(rootDir, lintOptions.cssPath);
  }

  for (const candidate of cssEntryCandidates) {
    const candidatePath = path.resolve(rootDir, candidate);
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

const isUpdate = process.argv.includes('--update');

function getSourceFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files = files.concat(getSourceFiles(fullPath));
      }
    } else if (/\.(tsx|ts|jsx|js|css|html)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const filesToLint = getSourceFiles(path.resolve(rootDir, 'src'));
const htmlPath = path.resolve(rootDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  filesToLint.push(htmlPath);
}

const ruleKeyMap = {
  'kumo/no-raw-controls': 'rawControls',
  'kumo/no-raw-links': 'rawLinks',
  'kumo/no-hardcoded-colors': 'hardcodedColors',
  'kumo/no-forbidden-imports': 'forbiddenImports',
  'kumo/validate-kumo-props': 'invalidKumoProps',
  'kumo/check-tailwind-v4-kumo-source': 'cssDirectives',
  'kumo/check-kumo-css-import': 'cssDirectives',
  'kumo/check-fouc-script': 'foucScript',
};

// Which engine produced these numbers matters: the baseline is only
// comparable across machines while both engines agree (see
// scripts/kumo-parity-check.mjs).
console.log(`[kumo-drift] Engine: ${isNativeEngine() ? 'native (Rust)' : 'JavaScript fallback'}`);

const currentCounts = {};

for (const filePath of filesToLint.sort()) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const code = fs.readFileSync(filePath, 'utf8');

  const res = lintCode(filePath, code, optionsForFile(filePath));
  const fileCounts = {
    rawControls: 0,
    rawLinks: 0,
    hardcodedColors: 0,
    forbiddenImports: 0,
    invalidKumoProps: 0,
  };

  let hasDiagnostics = false;

  for (const diag of res.diagnostics) {
    const key = ruleKeyMap[diag.ruleId] || diag.ruleId;
    fileCounts[key] = (fileCounts[key] || 0) + 1;
    hasDiagnostics = true;
  }

  if (hasDiagnostics) {
    currentCounts[relativePath] = fileCounts;
  }
}

if (isUpdate) {
  fs.writeFileSync(baselinePath, JSON.stringify(currentCounts, null, 2) + '\n');
  console.log(`Updated baseline saved to ${baselinePath}`);
  console.log(JSON.stringify(currentCounts, null, 2));
  process.exit(0);
}

// Compare against baseline
let baselineData = {};
if (fs.existsSync(baselinePath)) {
  try {
    baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading baseline file at ${baselinePath}:`, err);
    process.exit(1);
  }
}

let driftFound = false;

// The baseline is an exact snapshot. Increases prevent new debt, while reductions
// must be ratcheted into the baseline so resolved debt cannot silently return.
const allFiles = new Set([...Object.keys(baselineData), ...Object.keys(currentCounts)]);
for (const file of [...allFiles].sort()) {
  const baselineFile = baselineData[file];
  const currentFile = currentCounts[file];

  if (!baselineFile || !currentFile) {
    const reason = !fs.existsSync(path.resolve(rootDir, file))
      ? 'baseline entry exists for a file that no longer exists'
      : baselineFile
        ? 'diagnostics were reduced or removed'
        : 'file has new diagnostics';
    console.error(`[BASELINE MISMATCH] ${file}: ${reason}.`);
    driftFound = true;
    continue;
  }

  const allRules = new Set([...Object.keys(baselineFile), ...Object.keys(currentFile)]);
  for (const rule of [...allRules].sort()) {
    const baselineCount = baselineFile[rule] || 0;
    const currentCount = currentFile[rule] || 0;
    if (currentCount !== baselineCount) {
      console.error(`[BASELINE MISMATCH] ${file}: rule '${rule}' has ${currentCount} issues (baseline has ${baselineCount})`);
      driftFound = true;
    }
  }
}

if (driftFound) {
  console.error('\nKumo design system drift check failed. Run "npm run lint:kumo:update" to accept the current counts, including intentional reductions.');
  process.exit(1);
} else {
  console.log('Kumo design system drift check passed. No unbaselined drift detected.');
  process.exit(0);
}
