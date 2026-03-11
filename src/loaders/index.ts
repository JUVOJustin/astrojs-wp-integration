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
  WordPressContentLoaderConfig,
  WordPressContentStaticLoaderConfig,
  WordPressTermLoaderConfig,
  WordPressTermStaticLoaderConfig,
  ContentFilter,
  PostFilter,
  PageFilter,
  MediaFilter,
  CategoryFilter,
  TagFilter,
  TermFilter,
  UserFilter,
} from './types';

// Re-export live loaders
export {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressContentLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
} from './live';

// Re-export static loaders
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressContentStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
} from './static';
