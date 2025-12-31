/**
 * WordPress Astro.js Integration
 * 
 * Fast and better WordPress integration for Astro.js with live loaders,
 * static loaders, client API, and full Gutenberg block support.
 */

// Export live loaders (for defineLiveCollection - runtime fetching)
export {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
} from './loaders';

// Export static loaders (for defineCollection - build-time only)
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
} from './loaders';

export type {
  WordPressLoaderConfig,
  WordPressStaticLoaderConfig,
  PostFilter,
  PageFilter,
  MediaFilter,
  CategoryFilter,
} from './loaders';

// Export schemas
export {
  baseWordPressSchema,
  contentWordPressSchema,
  postSchema,
  pageSchema,
  mediaSchema,
  categorySchema,
  embeddedMediaSchema,
} from './schemas';

export type {
  WordPressBase,
  WordPressContent,
  WordPressPost,
  WordPressPage,
  WordPressMedia,
  WordPressCategory,
  WordPressTag,
  WordPressAuthor,
  WordPressEmbeddedMedia,
} from './schemas';

// Export client
export { WordPressClient, createWordPressClient } from './client';

// Components are imported directly via:
// import { WPImage } from 'wp-astrojs-integration/components/WPImage.astro';
// import { WPContent } from 'wp-astrojs-integration/components/WPContent.astro';
