// Extracts the inline <script> block from each static HTML page into an ES module
// under tests/generated/ so the page logic can be imported and unit tested.
//
// The generated module re-exports every top-level binding it declares, which lets
// tests call the page functions directly and inspect module state.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, '..');
const outDir = join(testsDir, 'generated');

export const PAGES = ['index', 'roster', 'combos'];

const SCRIPT_RE = /<script>([\s\S]*?)<\/script>/g;

export function extractScript(html) {
  const blocks = [];
  for (const match of html.matchAll(SCRIPT_RE)) blocks.push(match[1]);
  if (blocks.length === 0) throw new Error('no inline <script> block found');
  return blocks.join('\n');
}

export function topLevelBindings(source) {
  const names = new Set();
  const patterns = [
    /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm,
    /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm,
  ];
  for (const re of patterns) {
    for (const match of source.matchAll(re)) names.add(match[1]);
  }
  return [...names];
}

export function buildModule(html) {
  const source = extractScript(html);
  const exports = topLevelBindings(source);
  return `${source}\nexport { ${exports.join(', ')} };\n`;
}

export function generate() {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const page of PAGES) {
    const html = readFileSync(join(repoRoot, `${page}.html`), 'utf8');
    const target = join(outDir, `${page}.js`);
    writeFileSync(target, buildModule(html));
    written.push(target);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of generate()) console.log(`generated ${file}`);
}
