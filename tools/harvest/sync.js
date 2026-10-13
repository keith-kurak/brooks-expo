/**
 * Copies the catalog snapshot and the shared data layer from packages/catalog
 * into the app.
 *
 * @ref LLP 0002#sharing-boundary — Copying rather than symlinking or workspace-
 * linking is deliberate. Metro resolves outside the project root only with
 * extra configuration, and a demo that fails to bundle on a strange machine is
 * worth far less than a duplicated file. packages/catalog stays the source of
 * truth; src/data holds the generated copies.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'packages', 'catalog');

const TARGET = {
  name: 'app',
  data: path.join(ROOT, 'assets'),
  lib: path.join(ROOT, 'src', 'data'),
  libFiles: ['types.ts', 'query.ts', 'images.ts', 'constructor.ts', 'search-query.ts', 'search-results.ts'],
};

const catalog = path.join(SRC, 'catalog.json');
if (!fs.existsSync(catalog)) {
  console.error('No catalog.json. Run `npm run harvest` first.');
  process.exit(1);
}

const reviews = path.join(SRC, 'reviews.json');

fs.mkdirSync(TARGET.data, { recursive: true });
fs.copyFileSync(catalog, path.join(TARGET.data, 'catalog.json'));
console.log(`✓ ${TARGET.name}: catalog.json -> ${path.relative(ROOT, TARGET.data)}`);
if (fs.existsSync(reviews)) {
  fs.copyFileSync(reviews, path.join(TARGET.data, 'reviews.json'));
  console.log(`✓ ${TARGET.name}: reviews.json -> ${path.relative(ROOT, TARGET.data)}`);
}

fs.mkdirSync(TARGET.lib, { recursive: true });
for (const f of TARGET.libFiles) {
  fs.copyFileSync(path.join(SRC, f), path.join(TARGET.lib, f));
}
console.log(`✓ ${TARGET.name}: ${TARGET.libFiles.join(', ')} -> ${path.relative(ROOT, TARGET.lib)}`);
