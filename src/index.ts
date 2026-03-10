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
} from './loaders';

export type {
  WordPressLoaderConfig,
  WordPressStaticLoaderConfig,
  WordPressTermLoaderConfig,
  WordPressTermStaticLoaderConfig,
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
} from 'fluent-wp-client';

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
  ActionAuthConfig,
  ActionAuthHeadersConfig,
  ActionAuthHeadersFromContext,
  ResolvableActionAuthHeaders,
  UpdatePostInput,
  UpdatePostActionConfig,
  ExecuteUpdateConfig,
  CreatePostInput,
  CreatePostActionConfig,
  ExecuteCreateConfig,
  DeletePostInput,
  DeletePostActionConfig,
  DeletePostResult,
  ExecuteDeleteConfig,
  CreateTermInput,
  CreateTermActionConfig,
  ExecuteCreateTermConfig,
  UpdateTermInput,
  UpdateTermActionConfig,
  ExecuteUpdateTermConfig,
  DeleteTermInput,
  DeleteTermActionConfig,
  DeleteTermResult,
  ExecuteDeleteTermConfig,
  CreateUserInput,
  CreateUserActionConfig,
  ExecuteCreateUserConfig,
  UpdateUserInput,
  UpdateUserActionConfig,
  ExecuteUpdateUserConfig,
  DeleteUserInput,
  DeleteUserActionConfig,
  DeleteUserResult,
  ExecuteDeleteUserConfig,
  GetAbilityActionConfig,
  ExecuteGetAbilityConfig,
  RunAbilityActionConfig,
  ExecuteRunAbilityConfig,
  DeleteAbilityActionConfig,
  ExecuteDeleteAbilityConfig,
} from './actions';

// Export runtime-agnostic standalone client
export { WordPressClient, WordPressRequestBuilder, PostRelationQueryBuilder, WordPressAbilityBuilder } from 'fluent-wp-client';
export type {
  WordPressClientConfig,
  WordPressNamespaceClient,
  FetchResult,
  WordPressRequestOptions,
  WordPressRequestResult,
  WordPressRequestDeleteOptions,
  WordPressMediaUploadInput,
  PostRelation,
  SelectedPostRelations,
  DeleteOptions,
  WordPressDeleteResult,
  UserDeleteOptions,
  UserWriteInput,
} from 'fluent-wp-client';

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
  WordPressSchemaValidationError,
  isStandardSchema,
  validateWithStandardSchema,
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
