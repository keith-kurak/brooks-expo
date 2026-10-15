/**
 * Adds a blurhash to every catalog product image, so the app can paint a blurred
 * stand-in while the real photograph loads.
 *
 * @ref LLP 0002#image-placeholders — Hashes are computed here, once, and
 * bundled with the snapshot. Decoding a 16px blurhash on device is cheap;
 * fetching the photograph to derive one at runtime would defeat the purpose.
 *
 * Resumable: images that already carry a hash are skipped, and progress is
 * written back every few hundred images. Pass `--refresh` to recompute all.
 *
 * Uses Node's fetch on purpose. The CDN serves Node's TLS client but returns
 * `403 text/html` to curl and Bun (observed 2026-10-15).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { encode } = require('blurhash');

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG = path.join(ROOT, 'packages', 'catalog', 'catalog.json');
const REFRESH = process.argv.includes('--refresh');

/** Small enough to fetch fast; blurhash keeps only a few low frequencies anyway. */
const SAMPLE_PX = 32;
/** 4×4 suits square product shots: ~28 characters per image. */
const COMPONENTS = 4;
const CONCURRENCY = 6;
const SAVE_EVERY = 250;
const REQUEST_TIMEOUT_MS = 15_000;

// Same request shape as packages/catalog/images.ts `brooksImage`, so the hash
// matches the framing and near-white background the app actually shows.
function sampleUrl(bareUrl) {
  const q = new URLSearchParams({
    sw: String(SAMPLE_PX),
    sh: String(SAMPLE_PX),
    sm: 'fit',
    sfrm: 'png',
    strip: 'false',
    bgcolor: 'F8F8F8',
  });
  return `${bareUrl.split('?')[0]}?${q}`;
}

async function hashOf(bareUrl) {
  const res = await fetch(sampleUrl(bareUrl), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.startsWith('image/')) {
    throw new Error(`${res.status} ${type}`);
  }
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .flatten({ background: '#F8F8F8' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, COMPONENTS, COMPONENTS);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const save = () => fs.writeFileSync(CATALOG, JSON.stringify(catalog));

  // One CDN request per unique URL; several colorways can share an image.
  const byUrl = new Map();
  for (const product of catalog.products) {
    for (const color of product.colors) {
      for (const image of color.images) {
        if (!REFRESH && image.blurhash) continue;
        const list = byUrl.get(image.url) ?? [];
        list.push(image);
        byUrl.set(image.url, list);
      }
    }
  }

  const queue = [...byUrl.keys()];
  const total = queue.length;
  console.log(`${total} image(s) to hash`);
  let done = 0;
  const failed = [];

  async function worker() {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const hash = await hashOf(url);
        for (const image of byUrl.get(url)) image.blurhash = hash;
      } catch (err) {
        failed.push(`${url} — ${err.message}`);
      }
      done += 1;
      if (done % SAVE_EVERY === 0) {
        save();
        console.log(`  ${done}/${total} (${failed.length} failed)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();
  console.log(`✓ hashed ${total - failed.length}/${total} -> ${path.relative(ROOT, CATALOG)}`);
  if (failed.length) {
    // Missing hashes are harmless: the app falls back to a plain background.
    console.warn(`${failed.length} image(s) left without a hash:`);
    for (const line of failed.slice(0, 20)) console.warn(`  ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
