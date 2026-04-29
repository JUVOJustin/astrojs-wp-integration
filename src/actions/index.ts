/**
 * Single barrel for all server action factories, schemas, execute helpers, and types.
 * Organised by entity — add a new entity block here when introducing new action sets
 * (e.g. terms).  Per-operation files live under src/actions/<entity>/<operation>.ts.
 */

export type {
  DeleteAbilityActionConfig,
  DeleteAbilityInput,
  ExecuteDeleteAbilityConfig,
  ExecuteDeleteAbilityOptions,
} from './ability/delete';
export {
  createDeleteAbilityAction,
  deleteAbilityInputSchema,
  executeDeleteAbility,
} from './ability/delete';
export type {
  ExecuteRunAbilityConfig,
  ExecuteRunAbilityOptions,
  RunAbilityActionConfig,
  RunAbilityInput,
} from './ability/execute';
export {
  createRunAbilityAction,
  executeRunAbility,
  runAbilityInputSchema,
} from './ability/execute';
// Ability actions
export type {
  AbilityActionOptions,
  ExecuteAbilityOptions,
} from './ability/factory';
export type {
  ExecuteGetAbilityConfig,
  ExecuteGetAbilityOptions,
  GetAbilityActionConfig,
  GetAbilityInput,
} from './ability/get';
export {
  createGetAbilityAction,
  executeGetAbility,
  getAbilityInputSchema,
} from './ability/get';
export type { WpCacheInvalidateInput } from './cache/invalidate';
// Cache invalidation actions
export {
  createWpCacheInvalidateAction,
  executeWpCacheInvalidate,
  wpCacheInvalidateInputSchema,
} from './cache/invalidate';
export type {
  ActionClientResolver,
  ActionResponseMapper,
  ResolvableActionClient,
} from './post/client';
export type {
  CreatePostActionConfig,
  CreatePostActionOptions,
  CreatePostInput,
  ExecuteCreateConfig,
  ExecuteCreateOptions,
} from './post/create';
// Post actions
export {
  createCreatePostAction,
  createPostInputSchema,
  executeCreatePost,
} from './post/create';
export type {
  DeletePostActionConfig,
  DeletePostActionOptions,
  DeletePostInput,
  DeletePostResult,
  ExecuteDeleteConfig,
  ExecuteDeleteOptions,
} from './post/delete';
export {
  createDeletePostAction,
  deletePostInputSchema,
  executeDeletePost,
} from './post/delete';
export type {
  ExecuteUpdateConfig,
  ExecuteUpdateOptions,
  UpdatePostActionConfig,
  UpdatePostActionOptions,
  UpdatePostInput,
} from './post/update';
export {
  createUpdatePostAction,
  executeUpdatePost,
  updatePostInputSchema,
} from './post/update';
export type {
  CreateTermActionConfig,
  CreateTermActionOptions,
  CreateTermInput,
  ExecuteCreateTermConfig,
  ExecuteCreateTermOptions,
} from './term/create';
// Term actions
export {
  createCreateTermAction,
  createTermInputSchema,
  executeCreateTerm,
} from './term/create';
export type {
  DeleteTermActionConfig,
  DeleteTermActionOptions,
  DeleteTermInput,
  DeleteTermResult,
  ExecuteDeleteTermConfig,
  ExecuteDeleteTermOptions,
} from './term/delete';
export {
  createDeleteTermAction,
  deleteTermInputSchema,
  executeDeleteTerm,
} from './term/delete';
export type {
  ExecuteUpdateTermConfig,
  ExecuteUpdateTermOptions,
  UpdateTermActionConfig,
  UpdateTermActionOptions,
  UpdateTermInput,
} from './term/update';
export {
  createUpdateTermAction,
  executeUpdateTerm,
  updateTermInputSchema,
} from './term/update';
export type {
  CreateUserActionConfig,
  CreateUserActionOptions,
  CreateUserInput,
  ExecuteCreateUserConfig,
  ExecuteCreateUserOptions,
} from './user/create';
// User actions
export {
  createCreateUserAction,
  createUserInputSchema,
  executeCreateUser,
} from './user/create';
export type {
  DeleteUserActionConfig,
  DeleteUserActionOptions,
  DeleteUserInput,
  DeleteUserResult,
  ExecuteDeleteUserConfig,
  ExecuteDeleteUserOptions,
} from './user/delete';
export {
  createDeleteUserAction,
  deleteUserInputSchema,
  executeDeleteUser,
} from './user/delete';
export type {
  ExecuteUpdateUserConfig,
  ExecuteUpdateUserOptions,
  UpdateUserActionConfig,
  UpdateUserActionOptions,
  UpdateUserInput,
} from './user/update';
export {
  createUpdateUserAction,
  executeUpdateUser,
  updateUserInputSchema,
} from './user/update';
