/**
 * WordPress Loaders for Astro Content Collections
 * 
 * Live loaders: Use with defineLiveCollection for SSR/real-time data
 * Static loaders: Use with defineCollection for build-time static generation
 */

// Re-export types
export type {
  WordPressEmbedMode,
  WordPressLiveContentLoaderOptions,
  WordPressTermLoaderOptions,
  WordPressTermStaticLoaderOptions,
  WordPressContentLoaderOptions,
  WordPressContentStaticLoaderOptions,
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
  wordPressMediaLoader,
  wordPressCategoryLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
  wordPressContentLoader,
} from './live';

// Re-export static loaders
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
  wordPressContentStaticLoader,
} from './static';
