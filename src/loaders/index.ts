/**
 * WordPress Loaders for Astro Content Collections
 *
 * Live loaders: Use with defineLiveCollection for SSR/real-time data
 * Static loaders: Use with defineCollection for build-time static generation
 */

// Re-export live loaders
export {
  wordPressCategoryLoader,
  wordPressContentLoader,
  wordPressMediaLoader,
  wordPressPageLoader,
  wordPressPostLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
} from './live';
// Re-export static loaders
export {
  wordPressCategoryStaticLoader,
  wordPressContentStaticLoader,
  wordPressMediaStaticLoader,
  wordPressPageStaticLoader,
  wordPressPostStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
} from './static';
// Re-export types
export type {
  CategoryFilter,
  ContentFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
  TagFilter,
  TermFilter,
  UserFilter,
  WordPressContentLoaderOptions,
  WordPressContentStaticLoaderOptions,
  WordPressEmbedMode,
  WordPressEntryMappingOptions,
  WordPressLiveContentLoaderOptions,
  WordPressLoaderEntryMapper,
  WordPressTermLoaderOptions,
  WordPressTermStaticLoaderOptions,
} from './types';
