/**
 * WordPress Astro.js Integration Components
 *
 * Export Astro components for WordPress content rendering
 */

export type {
  OptimizeMode,
  ResolveWordPressImageForAstroOptions,
  WPImageImgProps,
  WPImageRenderProps,
  WPImageSource,
} from './astro-image';
export { resolveWordPressImageForAstro } from './astro-image';
export type {
  ResolvedWordPressImage,
  ResolveWordPressImageOptions,
  WPImageFrameworkProps,
  WPImageOutputFormat,
} from './image';
export { resolveWordPressImage } from './image';
export { default as WPContent } from './WPContent.astro';
// Re-export components for named imports
export { default as WPImage } from './WPImage.astro';
