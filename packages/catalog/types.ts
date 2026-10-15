/**
 * The Brooks catalog schema.
 *
 * @ref LLP 0002#normalized-schema — Shaped around what the real Brooks endpoints
 * actually return, not around what a shopping UI wishes it returned. The two
 * notable consequences: stock lives per (colorway, size) because Brooks tracks
 * it there, and image URLs are stored bare so any consumer can size them via
 * the Demandware CDN's `sw`/`sh` query params.
 */

export type Gender = 'mens' | 'womens' | 'unisex';
export type ProductType = 'Shoes' | 'Apparel' | 'Other';

/** Brooks's own cushioning vocabulary, from the `spec_FeelUnderFootTitle` facet. */
export type Cushion = 'Plush' | 'Balanced' | 'Responsive' | string;

export interface Size {
  /** Variation value used by Brooks, e.g. "9.5" or "M". */
  value: string;
  label: string;
  /** Derived from SFCC `selectable`: false means this size is out of stock. */
  available: boolean;
}

export interface Width {
  /** e.g. "1D", "2E". */
  value: string;
  /** e.g. "Medium (1D)". */
  label: string;
  available: boolean;
}

export interface ProductImage {
  /**
   * Bare CDN URL with no query string. Size it at the call site — the Brooks
   * Demandware CDN resizes on demand, so one URL serves every density.
   */
  url: string;
  alt: string;
  /**
   * Blurred stand-in shown while the photo loads. Added by
   * `tools/harvest/harvest-blurhash.js`; absent if the CDN refused the sample.
   */
  blurhash?: string;
}

/** One customer review from Brooks's TurnTo-backed PDP endpoint. */
export interface ProductReview {
  id: number;
  publishedDate: string;
  title: string;
  text: string;
  rating: number;
  author: string;
  badge: string | null;
}

export interface ReviewDimension {
  label: string;
  /** Zero-based average across the ordered values below. */
  average: number;
  values: string[];
}

export interface ProductReviews {
  averageRating: number | null;
  reviewCount: number;
  dimensions: ReviewDimension[];
  recent: ProductReview[];
}

export interface ReviewsSnapshot {
  harvestedAt: string;
  source: string;
  products: Record<string, ProductReviews>;
}

export interface Colorway {
  /** Brooks color code, e.g. "197". Combines with the style id to form a variant. */
  code: string;
  /** e.g. "White/Cyber Yellow/Black". */
  name: string;
  images: ProductImage[];
  price: number | null;
  listPrice: number | null;
  /** Which variation attribute the sizes belong to (`size_Shoe` vs `size_Apparel`). */
  sizeAttrId?: string;
  sizes: Size[];
  widths: Width[];
  soldOut: boolean;
}

export interface Product {
  /** Brooks style number, e.g. "110498". */
  id: string;
  name: string;
  gender: Gender | null;
  productType: ProductType;
  /** Brooks franchise, e.g. "Ghost", "Glycerin", "Hyperion". */
  franchise: string | null;
  price: number | null;
  listPrice: number | null;
  onSale: boolean;
  description: string;
  /** e.g. ["Long runs", "Daily training"]. */
  bestFor: string[];
  features: string[];
  cushion: Cushion | null;
  /** e.g. "neutral_support", "max_support". */
  support: string | null;
  /** e.g. "speed", "cushion". */
  experience: string | null;
  rating: number | null;
  reviewCount: number;
  /** e.g. "New Style". */
  badge: string | null;
  /** Constructor.io group ids this product belongs to. */
  groups: string[];
  colors: Colorway[];
  url: string;
}

export interface Category {
  id: string;
  label: string;
  productIds: string[];
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface Facet {
  name: string;
  display_name: string;
  options: FacetOption[];
}

export interface Catalog {
  harvestedAt: string;
  source: string;
  counts: {
    products: number;
    shoes: number;
    apparel: number;
    colorways: number;
  };
  categories: Category[];
  facets: Facet[];
  products: Product[];
}

/** A line in the cart. Identified by the Brooks variant id. */
export interface CartLine {
  /** Brooks variant id, e.g. "1104981D197.090" (style + width + color + size). */
  variantId: string;
  productId: string;
  colorCode: string;
  size: string;
  width: string;
  quantity: number;
}
