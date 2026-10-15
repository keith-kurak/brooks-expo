import { Image, type ImageStyle } from 'expo-image';

import { blurhashFor } from '../data/catalog';
import { brooksImage } from '../data/images';
import { motion } from '../theme';

/**
 * Product photography, always sized through the Brooks CDN so a 170pt tile
 * fetches a ~340px image rather than the 2500px master.
 */
export function ShoeImage({
  url,
  width,
  height,
  style,
  contentFit = 'contain',
  priority,
  transition = motion.base,
}: {
  url: string;
  width: number;
  height?: number;
  style?: ImageStyle;
  contentFit?: 'contain' | 'cover';
  priority?: 'low' | 'normal' | 'high';
  transition?: number;
}) {
  const h = height ?? width;
  return (
    <Image
      source={{ uri: brooksImage(url, { width: width * 2, height: h * 2 }) }}
      placeholder={placeholderFor(url)}
      placeholderContentFit={contentFit}
      style={[{ width, height: h }, style]}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      cachePolicy="memory-disk"
      recyclingKey={url}
    />
  );
}

/** Blurhash placeholder for a catalog image, or none for live search results. */
export function placeholderFor(url: string) {
  const blurhash = blurhashFor(url);
  return blurhash ? { blurhash } : undefined;
}
