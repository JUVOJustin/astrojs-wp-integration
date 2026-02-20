/**
 * WordPress Loaders for Astro Content Collections
 * 
 * Live loaders: Use with defineLiveCollection for SSR/real-time data
 * Static loaders: Use with defineCollection for build-time static generation
 */

// Re-export types
export type {
  WordPressLoaderConfig,
  WordPressStaticLoaderConfig,
  PostFilter,
  PageFilter,
  MediaFilter,
  CategoryFilter,
  UserFilter,
} from './types';

// Re-export live loaders
export {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
  wordPressUserLoader,
} from './live';

export { wordPressCustomPostLoader } from './custom-live';

// Re-export static loaders
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressUserStaticLoader,
} from './static';

export { wordPressCustomPostStaticLoader } from './custom-static';
