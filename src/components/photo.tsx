import { Image, type ImageStyle } from 'expo-image';

import { brooksImage } from '../data/images';
import { motion } from '../theme';
import { placeholderFor } from './shoe-image';

/** Editorial/lifestyle photography: fills its frame, no CDN transparency tricks. */
export function Photo({
  url,
  style,
  width,
  height,
  priority,
}: {
  url: string;
  style?: ImageStyle;
  width: number;
  height: number;
  priority?: 'low' | 'normal' | 'high';
}) {
  return (
    <Image
      source={{ uri: brooksImage(url, { width: width * 2, height: height * 2, fit: 'cut' }) }}
      placeholder={placeholderFor(url)}
      placeholderContentFit="cover"
      style={[{ width: '100%', height: '100%' }, style]}
      contentFit="cover"
      transition={motion.slow}
      priority={priority}
      cachePolicy="memory-disk"
    />
  );
}
