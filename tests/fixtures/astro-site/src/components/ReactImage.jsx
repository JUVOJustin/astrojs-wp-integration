import { resolveWordPressImage } from '../../../../../src/components/image';

/**
 * React component that renders a WordPress image using resolveWordPressImage.
 * This demonstrates framework-native image rendering with WordPress srcset.
 */
export default function ReactImage({ media, size = 'large', className = '' }) {
  const image = resolveWordPressImage(media, { size });

  return (
    <img
      src={image.src}
      srcSet={image.srcset}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
