/**
 * The catalog snapshot, bundled with the app.
 *
 * @ref LLP 0002#why-a-snapshot — brooksrunning.com is behind Akamai Bot Manager,
 * which 403s every non-browser client, so the app cannot fetch products at
 * runtime. `tools/harvest` drives a real browser session to capture the live
 * catalog and writes it here. Photography and search stay live: the Brooks image
 * CDN and Constructor.io are both reachable from the device.
 */
import raw from '../../assets/catalog.json';
import type { Catalog } from './types';

export const catalog = raw as unknown as Catalog;

export const HOME_CATEGORY = 'featured-new-arrivals';

/** The shop tabs, in the order the Brooks site presents them. */
export const SHOP_SECTIONS = [
  { id: 'featured-new-arrivals', label: 'New Arrivals' },
  { id: 'mens-shoes', label: "Men's Shoes" },
  { id: 'womens-shoes', label: "Women's Shoes" },
  { id: 'mens-apparel', label: "Men's Apparel" },
  { id: 'womens-apparel', label: "Women's Apparel" },
  { id: 'featured-best-sellers', label: 'Best Sellers' },
] as const;

let blurhashes: Map<string, string> | undefined;

/**
 * The harvested blurhash for a catalog image, by its bare or sized CDN url.
 * Images from outside the snapshot (live search results) have none.
 *
 * @ref LLP 0002#image-placeholders — Looked up by url so every `ShoeImage` and
 * `Photo` gets a placeholder without threading hashes through each call site.
 */
export function blurhashFor(url: string): string | undefined {
  if (!blurhashes) {
    blurhashes = new Map();
    for (const product of catalog.products) {
      for (const color of product.colors) {
        for (const image of color.images) {
          if (image.blurhash) blurhashes.set(image.url, image.blurhash);
        }
      }
    }
  }
  return blurhashes.get(url.split('?')[0]);
}
