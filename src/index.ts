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
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
  wordPressContentLoader,
} from './loaders';

// Export static loaders (for defineCollection - build-time only)
export {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressMediaStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
  wordPressContentStaticLoader,
} from './loaders';

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
} from './loaders';

// Export schemas and core WP types from standalone client package
export {
  baseWordPressSchema,
  contentWordPressSchema,
  postSchema,
  pageSchema,
  mediaSchema,
  categorySchema,
  tagSchema,
  embeddedMediaSchema,
  abilityAnnotationsSchema,
  abilitySchema,
  abilityCategorySchema,
  settingsSchema,
  wordPressErrorSchema,
  updatePostFieldsSchema,
  postWriteBaseSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthErrorResponseSchema,
  jwtAuthValidationResponseSchema,
  commentSchema,
  authorSchema,
  searchResultSchema,
} from 'fluent-wp-client/zod';

// Export embed extraction helpers
export {
  getEmbeddedAuthor,
  getEmbeddedFeaturedMedia,
  getEmbeddedParent,
  getEmbeddedTerms,
  getEmbeddedReplies,
  getEmbeddedData,
  getAcfEmbeddedPosts,
  getAcfEmbeddedTerms,
  getAcfFieldPosts,
  getAcfFieldPost,
  getAcfFieldTerms,
  getAcfFieldIds,
  getAcfFieldId,
  getLinkEntries,
  getEmbeddableLinkKeys,
  ACF_POSTS_EMBED_KEY,
  ACF_TERMS_EMBED_KEY,
} from 'fluent-wp-client/zod';

// Export schema discovery helpers
export {
  zodFromJsonSchema,
  zodSchemasFromDescription,
  stripDateTimeFormats,
} from 'fluent-wp-client/zod';

export type {
  ResourceZodSchemas,
  AbilityZodSchemas,
} from 'fluent-wp-client/zod';

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
  WordPressAbilityAnnotations,
  WordPressAbility,
  WordPressAbilityCategory,
  WordPressSettings,
  WordPressError,
  WordPressPostWriteFields,
  WordPressPostWriteBase,
  WordPressComment,
  WordPressAbilityRuntime,
  GetAbilityInput,
  RunAbilityInput,
  DeleteAbilityInput,
} from 'fluent-wp-client';

// Export predefined server actions
export {
  createUpdatePostAction,
  updatePostInputSchema,
  createCreatePostAction,
  createPostInputSchema,
  createDeletePostAction,
  deletePostInputSchema,
  createCreateTermAction,
  createTermInputSchema,
  createUpdateTermAction,
  updateTermInputSchema,
  createDeleteTermAction,
  deleteTermInputSchema,
  createCreateUserAction,
  createUserInputSchema,
  createUpdateUserAction,
  updateUserInputSchema,
  createDeleteUserAction,
  deleteUserInputSchema,
  createGetAbilityAction,
  getAbilityInputSchema,
  createRunAbilityAction,
  runAbilityInputSchema,
  createDeleteAbilityAction,
  deleteAbilityInputSchema,
} from './actions';
export type {
  ActionClientResolver,
  ResolvableActionClient,
  UpdatePostInput,
  UpdatePostActionOptions,
  UpdatePostActionConfig,
  ExecuteUpdateOptions,
  ExecuteUpdateConfig,
  CreatePostInput,
  CreatePostActionOptions,
  CreatePostActionConfig,
  ExecuteCreateOptions,
  ExecuteCreateConfig,
  DeletePostInput,
  DeletePostActionOptions,
  DeletePostActionConfig,
  DeletePostResult,
  ExecuteDeleteOptions,
  ExecuteDeleteConfig,
  CreateTermInput,
  CreateTermActionOptions,
  CreateTermActionConfig,
  ExecuteCreateTermOptions,
  ExecuteCreateTermConfig,
  UpdateTermInput,
  UpdateTermActionOptions,
  UpdateTermActionConfig,
  ExecuteUpdateTermOptions,
  ExecuteUpdateTermConfig,
  DeleteTermInput,
  DeleteTermActionOptions,
  DeleteTermActionConfig,
  DeleteTermResult,
  ExecuteDeleteTermOptions,
  ExecuteDeleteTermConfig,
  CreateUserInput,
  CreateUserActionOptions,
  CreateUserActionConfig,
  ExecuteCreateUserOptions,
  ExecuteCreateUserConfig,
  UpdateUserInput,
  UpdateUserActionOptions,
  UpdateUserActionConfig,
  ExecuteUpdateUserOptions,
  ExecuteUpdateUserConfig,
  DeleteUserInput,
  DeleteUserActionOptions,
  DeleteUserActionConfig,
  DeleteUserResult,
  ExecuteDeleteUserOptions,
  ExecuteDeleteUserConfig,
  AbilityActionOptions,
  ExecuteAbilityOptions,
  GetAbilityActionConfig,
  ExecuteGetAbilityOptions,
  ExecuteGetAbilityConfig,
  RunAbilityActionConfig,
  ExecuteRunAbilityOptions,
  ExecuteRunAbilityConfig,
  DeleteAbilityActionConfig,
  ExecuteDeleteAbilityOptions,
  ExecuteDeleteAbilityConfig,
} from './actions';

// Export runtime-agnostic standalone client
export { WordPressClient, WordPressAbilityBuilder } from 'fluent-wp-client';
export type {
  WordPressClientConfig,
  ContentResourceClient,
  TermsResourceClient,
  MediaResourceClient,
  UsersResourceClient,
  CommentsResourceClient,
  SettingsResourceClient,
  FetchResult,
  WordPressRequestOptions,
  WordPressRequestResult,
  WordPressRequestOverrides,
  WordPressMediaUploadInput,
  DeleteOptions,
  WordPressDeleteResult,
  UserDeleteOptions,
  UserWriteInput,
  TermWriteInput,
  WordPressWritePayload,
  QueryParams,
  PaginationParams,
  PaginatedResponse,
  PostsFilter,
  PagesFilter,
  MediaFilter as ClientMediaFilter,
  CategoriesFilter,
  TagsFilter,
  UsersFilter,
  CommentsFilter,
} from 'fluent-wp-client';

// Export auth utilities
export {
  createBasicAuthHeader,
  createJwtAuthHeader,
  createWordPressAuthHeader,
  createAuthResolver,
  resolveWordPressAuth,
  resolveWordPressRequestCredentials,
  resolveWordPressRequestHeaders,
} from 'fluent-wp-client';

export {
  isStandardSchema,
} from 'fluent-wp-client';

export type {
  BasicAuthCredentials,
  CookieNonceAuthCredentials,
  JwtAuthCredentials,
  HeaderAuthCredentials,
  JwtLoginCredentials,
  JwtAuthTokenResponse,
  JwtAuthValidationResponse,
  WordPressAuthorizationInput,
  WordPressAuthRequest,
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthConfig,
  WordPressAuthInput,
  WordPressAuthResolver,
  RequestAuthResolver,
  WordPressSchemaIssue,
  WordPressStandardSchema,
  ResolvableWordPressAuth,
  // Discovery types
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressAbilityDescription,
  WordPressResourceSchemaSet,
  WordPressAbilitySchemaSet,
  WordPressResourceCapabilities,
  WordPressDiscoveryWarning,
} from 'fluent-wp-client';

// Export server auth bridge helpers
export {
  createWordPressAuthBridge,
  wordPressLoginInputSchema,
} from './server';

export type {
  WordPressAuthBridge,
  WordPressAuthBridgeConfig,
  WordPressAuthSession,
  WordPressLoginAction,
  WordPressLoginActionPayload,
  WordPressLoginActionResult,
  WordPressLoginInput,
} from './server';

// Components are imported directly via:
// import WPImage from 'wp-astrojs-integration/components/WPImage.astro';
// import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
