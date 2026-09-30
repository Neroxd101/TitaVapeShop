// Read-only source checks; does not load application configuration or call APIs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

const frontend = files('frontend');
const backend = files('backend');
const entrypoints = ['main.js', 'netlify/functions/app.js'];
const javascript = [...frontend, ...backend, ...entrypoints].filter(file => file.endsWith('.js'));
const stylesheets = frontend.filter(file => file.endsWith('.css'));
const errors = [];
const parserContext = {};
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'], parserContext);
const parser = parserContext.acorn;
const trees = new Map();

for (const file of javascript) {
  try {
    trees.set(file, parser.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest' }));
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

// Check comments, strings, braces, parentheses and attribute-selector brackets.
for (const file of stylesheets) {
  const source = fs.readFileSync(file, 'utf8');
  const stack = [];
  let line = 1;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\n') line++;
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) { errors.push(`${file}:${line}: unclosed comment`); break; }
      line += (source.slice(index, end + 2).match(/\n/g) || []).length;
      index = end + 1;
      continue;
    }
    if (character === '"' || character === "'") {
      let closed = false;
      while (++index < source.length) {
        if (source[index] === '\\') { index++; continue; }
        if (source[index] === character) { closed = true; break; }
        if (source[index] === '\n') line++;
      }
      if (!closed) errors.push(`${file}:${line}: unclosed string`);
      continue;
    }
    if (character === '*' && source[index + 1] === '/') errors.push(`${file}:${line}: unexpected comment end`);
    if ('{(['.includes(character)) stack.push({ character, line });
    if ('})]'.includes(character)) {
      const opening = stack.pop();
      if (!opening || '{(['.indexOf(opening.character) !== '})]'.indexOf(character)) {
        errors.push(`${file}:${line}: unexpected ${character}`);
      }
    }
  }
  if (stack.length) errors.push(`${file}: unclosed delimiters at ${stack.map(item => item.line).join(', ')}`);
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

let referenceCount = 0;
function verifyAsset(file, url) {
  if (/^(?:https?:|\/\/|data:|#)/.test(url)) return;
  const asset = url.split(/[?#]/)[0];
  if (!/\.(?:js|css|html)$/.test(asset)) return;
  referenceCount++;
  const target = asset.startsWith('/') ? path.join('frontend', asset) : path.resolve(path.dirname(file), asset);
  if (!fs.existsSync(target)) errors.push(`${file}: missing asset ${url}`);
}

for (const file of frontend) {
  if (!/\.(?:html|css|js)$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const match of source.matchAll(/<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      verifyAsset(file, match[1]);
    }
  }
  if (file.endsWith('.css')) {
    for (const match of source.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) verifyAsset(file, match[1]);
  }
  if (file.endsWith('.js')) {
    walk(trees.get(file), node => {
      if (node.type === 'CallExpression' && node.callee.name === 'fetch' &&
          typeof node.arguments[0]?.value === 'string' && node.arguments[0].value.startsWith('/')) {
        verifyAsset(file, node.arguments[0].value);
      }
    });
  }
}

const graph = new Map();
const usedPackages = new Set();
for (const file of [...backend, ...entrypoints].filter(file => file.endsWith('.js'))) {
  const imports = [];
  walk(trees.get(file), node => {
    if (node.type !== 'CallExpression' || node.callee.name !== 'require' || typeof node.arguments[0]?.value !== 'string') return;
    const name = node.arguments[0].value;
    if (!name.startsWith('.')) { usedPackages.add(name); return; }
    const base = path.resolve(path.dirname(file), name);
    const target = [base, `${base}.js`, path.join(base, 'index.js')].find(candidate =>
      fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (target) imports.push(target);
    else errors.push(`${file}: missing import ${name}`);
  });
  graph.set(path.resolve(file), imports);
}
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  (graph.get(file) || []).forEach(visit);
}
entrypoints.map(file => path.resolve(file)).forEach(visit);
for (const file of backend.filter(file => file.endsWith('.js'))) {
  if (!reachable.has(path.resolve(file))) errors.push(`${file}: unreachable backend module`);
}

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
if (JSON.stringify(manifest.dependencies) !== JSON.stringify(lock.packages[''].dependencies)) errors.push('Dependency manifest differs from lockfile');
for (const name of Object.keys(manifest.dependencies)) {
  if (!usedPackages.has(name)) errors.push(`Dependency has no application import: ${name}`);
  try { require.resolve(name); } catch { errors.push(`Dependency is not installed: ${name}`); }
}

console.log(JSON.stringify({ javascriptFiles: javascript.length, cssFiles: stylesheets.length,
  localAssetReferences: referenceCount, backendModules: backend.length,
  directDependencies: Object.keys(manifest.dependencies).length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
