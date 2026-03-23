/**
 * WordPress Loaders for Astro Content Collections
 * 
 * Live loaders: Use with defineLiveCollection for SSR/real-time data
 * Static loaders: Use with defineCollection for build-time static generation
 */

// Re-export types
export type {
  WordPressTermLoaderOptions,
  WordPressTermStaticLoaderOptions,
  WordPressContentLoaderOptions,
  WordPressContentStaticLoaderOptions,
  WordPressLoaderOptions,
  ContentFilter,
  PostFilter,
  PageFilter,
  MediaFilter,
  CategoryFilter,
  TagFilter,
  TermFilter,
  UserFilter,
} from './types';

// Re-export schema field utilities
export {
  extractFieldsFromSchema,
  fieldsPresets,
  mergeFields,
  type ExtractFieldsOptions,
} from './schema-fields';

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
