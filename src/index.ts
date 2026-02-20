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
  wordPressUserLoader,
} from './loaders';

// Export static loaders (for defineCollection - build-time only)
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressUserStaticLoader,
} from './loaders';

export type {
  WordPressLoaderConfig,
  WordPressStaticLoaderConfig,
  PostFilter,
  PageFilter,
  MediaFilter,
  CategoryFilter,
  UserFilter,
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
  settingsSchema,
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
  WordPressSettings,
} from './schemas';

// Export client
export { WordPressClient } from './client';
export type { WordPressClientConfig, FetchResult } from './client';

// Export client filter types for typesafe API calls
export type {
  PaginationParams,
  PaginatedResponse,
  PostsFilter,
  PagesFilter,
  MediaFilter as ClientMediaFilter,
  CategoriesFilter,
  TagsFilter,
  UsersFilter,
} from './client/types';

// Export auth utilities
export { createBasicAuthHeader } from './client/auth';
export type { BasicAuthCredentials } from './client/auth';

// Export server auth bridge helpers
export {
  createWordPressAuthBridge,
  wordPressLoginInputSchema,
} from './server';

export type {
  WordPressAuthBridge,
  WordPressAuthBridgeConfig,
  WordPressAuthSession,
  WordPressLoginInput,
} from './server';

// Components are imported directly via:
// import WPImage from 'wp-astrojs-integration/components/WPImage.astro';
// import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
