/**
 * Renders the app-drawn tab bar's four glyphs to PNGs for the Liquid Glass bar.
 *
 * @ref LLP 0003#the-glass-bar-wears-the-brooks-glyphs — `NativeTabs` cannot
 * draw react-native-svg, only SF Symbols, asset-catalog images, or image
 * files, so the glass bar gets the same glyphs as rasters. The geometry below
 * is copied from `src/components/tab-icon.tsx` (slot, sizes, `thicken`) and
 * the sprite paths from `src/components/icons.tsx`. Rerun after editing either:
 *
 *   node tools/tab-icons/render.js
 *
 * Output: `assets/tab-icons/<tab>{,@2x,@3x}.png`, black on transparent. The
 * glass bar renders them as template images, so iOS tints them itself.
 * Rasterized with macOS `sips`, which reads SVG.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const OUT = path.join(__dirname, '../../assets/tab-icons');
/** `TabIcon`'s slot, in points. */
const SLOT = 24;
/** The drawn glyphs' stroke, `STROKE` in tab-icon.tsx. */
const STROKE = 2.2;
const INK = '#000';

/** Verbatim from icons.tsx: viewBox and path of each sprite glyph. */
const SPRITE = {
  search: {
    vb: [18, 18],
    d: 'M8.05732 1.86694C4.64376 1.86694 1.86694 4.64376 1.86694 8.05732C1.86694 11.4699 4.64376 14.2477 8.05732 14.2477C11.4709 14.2477 14.2477 11.4699 14.2477 8.05732C14.2477 4.64376 11.4709 1.86694 8.05732 1.86694ZM16.9675 18.0002C16.6924 18.0002 16.433 17.8931 16.2384 17.6976L12.9762 14.4354C11.5554 15.5339 9.85842 16.1146 8.05732 16.1146C3.61498 16.1146 0 12.4997 0 8.05732C0 3.614 3.61498 0 8.05732 0C12.4997 0 16.1146 3.614 16.1146 8.05732C16.1146 9.83189 15.5202 11.5711 14.4354 12.9762L17.6986 16.2384C18.1005 16.6403 18.1005 17.2957 17.6986 17.6976C17.503 17.8931 17.2446 18.0002 16.9675 18.0002Z',
  },
  cart: {
    vb: [20, 18],
    d: 'M16.493 8.226L18.23 3.29H4.806L5.589 8.226H16.493ZM8.212 13.839C7.418 13.84 6.772 14.484 6.772 15.275C6.772 16.067 7.418 16.712 8.213 16.712C9.008 16.712 9.655 16.067 9.655 15.275C9.655 14.484 9.009 13.84 8.215 13.839H8.212ZM14.259 13.839C13.466 13.84 12.819 14.484 12.819 15.275C12.819 16.067 13.467 16.712 14.261 16.712C15.056 16.712 15.703 16.067 15.703 15.275C15.703 14.484 15.056 13.84 14.263 13.839H14.259ZM14.261 18C12.753 18 11.527 16.778 11.527 15.275C11.527 14.76 11.67 14.266 11.937 13.839H10.537C10.805 14.266 10.947 14.761 10.947 15.275C10.947 16.778 9.721 18 8.213 18C6.705 18 5.48 16.778 5.48 15.275C5.48 14.76 5.622 14.266 5.889 13.839H5.631C5.203 13.839 4.854 13.534 4.854 13.161L2.956 1.451H0V0H3.592C3.939 0 4.21 0.294 4.338 0.547L4.524 1.839H19.223C19.537 1.839 19.705 2.005 19.816 2.116C20 2.299 20 2.576 20 2.709L17.729 9.352L17.68 9.4C17.463 9.616 17.286 9.774 17.087 9.774H5.872L6.269 12.387H17.864V13.839H16.585C16.852 14.266 16.994 14.76 16.994 15.275C16.994 16.778 15.768 18 14.261 18Z',
  },
  account: {
    vb: [16, 18],
    d: 'M8.00001 1.396C6.19001 1.396 4.71801 2.943 4.71801 4.845C4.71801 6.746 6.19001 8.293 8.00001 8.293C9.81101 8.293 11.282 6.746 11.282 4.845C11.282 2.943 9.81101 1.396 8.00001 1.396ZM14.543 16.453C14.206 11.084 10.141 9.653 8.00001 9.653C5.85901 9.653 1.79401 11.084 1.45701 16.453H14.543ZM0.717008 18C0.322008 18 8.07034e-06 17.678 8.07034e-06 17.283C-0.00599193 11.591 3.33501 9.512 5.28301 8.785C4.08401 7.874 3.36101 6.423 3.36101 4.868C3.36101 2.184 5.44201 0 8.00001 0C10.558 0 12.639 2.184 12.639 4.868C12.639 6.424 11.916 7.874 10.718 8.785C12.665 9.512 16.007 11.591 16 17.282C16 17.678 15.678 18 15.283 18H0.717008Z',
  },
};

/**
 * A sprite glyph as `BrooksIcon` draws it: scaled so its longer axis is `size`,
 * centered in the slot, with `thicken` points of same-color stroke over the fill.
 */
function sprite(name, size, thicken) {
  const { vb, d } = SPRITE[name];
  const scale = size / Math.max(vb[0], vb[1]);
  const x = (SLOT - vb[0] * scale) / 2;
  const y = (SLOT - vb[1] * scale) / 2;
  const stroke =
    thicken > 0
      ? ` stroke="${INK}" stroke-width="${thicken / scale}" stroke-linejoin="round"`
      : '';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path fill-rule="evenodd" clip-rule="evenodd" fill="${INK}"${stroke} d="${d}"/></g>`;
}

/** A drawn glyph's stroked path, as `Drawn` in tab-icon.tsx draws it. */
function drawn(d) {
  return `<path d="${d}" stroke="${INK}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

/** Tab → glyph, matching `sprite` and `Drawn` in tab-icon.tsx. */
const TABS = {
  home: drawn('M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5'),
  browse: sprite('search', 21, 0),
  cart: sprite('cart', 20, 0.9),
  account: sprite('account', 20, 0.65),
};

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-icons-'));

for (const [tab, body] of Object.entries(TABS)) {
  for (const k of [1, 2, 3]) {
    const px = SLOT * k;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${SLOT} ${SLOT}" fill="none">${body}</svg>`;
    const src = path.join(tmp, `${tab}@${k}x.svg`);
    fs.writeFileSync(src, svg);
    const out = path.join(OUT, k === 1 ? `${tab}.png` : `${tab}@${k}x.png`);
    execFileSync('sips', ['-s', 'format', 'png', src, '--out', out], { stdio: 'ignore' });
    console.log(path.relative(process.cwd(), out));
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
