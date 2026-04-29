/**
 * Single barrel for all server action factories, schemas, execute helpers, and types.
 * Organised by entity — add a new entity block here when introducing new action sets
 * (e.g. terms).  Per-operation files live under src/actions/<entity>/<operation>.ts.
 */

export type {
  ActionResponseMapper,
  ActionClientResolver,
  ResolvableActionClient,
} from './post/client';

// Post actions
export { createCreatePostAction, createPostInputSchema, executeCreatePost } from './post/create';
export type {
  CreatePostInput,
  CreatePostActionOptions,
  CreatePostActionConfig,
  ExecuteCreateOptions,
  ExecuteCreateConfig,
} from './post/create';

export { createUpdatePostAction, updatePostInputSchema, executeUpdatePost } from './post/update';
export type {
  UpdatePostInput,
  UpdatePostActionOptions,
  UpdatePostActionConfig,
  ExecuteUpdateOptions,
  ExecuteUpdateConfig,
} from './post/update';

export { createDeletePostAction, deletePostInputSchema, executeDeletePost } from './post/delete';
export type {
  DeletePostInput,
  DeletePostActionOptions,
  DeletePostActionConfig,
  DeletePostResult,
  ExecuteDeleteOptions,
  ExecuteDeleteConfig,
} from './post/delete';

// Term actions
export { createCreateTermAction, createTermInputSchema, executeCreateTerm } from './term/create';
export type {
  CreateTermInput,
  CreateTermActionOptions,
  CreateTermActionConfig,
  ExecuteCreateTermOptions,
  ExecuteCreateTermConfig,
} from './term/create';

export { createUpdateTermAction, updateTermInputSchema, executeUpdateTerm } from './term/update';
export type {
  UpdateTermInput,
  UpdateTermActionOptions,
  UpdateTermActionConfig,
  ExecuteUpdateTermOptions,
  ExecuteUpdateTermConfig,
} from './term/update';

export { createDeleteTermAction, deleteTermInputSchema, executeDeleteTerm } from './term/delete';
export type {
  DeleteTermInput,
  DeleteTermActionOptions,
  DeleteTermActionConfig,
  DeleteTermResult,
  ExecuteDeleteTermOptions,
  ExecuteDeleteTermConfig,
} from './term/delete';

// Cache invalidation actions
export {
  createWpCacheInvalidateAction,
  wpCacheInvalidateInputSchema,
  executeWpCacheInvalidate,
} from './cache/invalidate';
export type {
  WpCacheInvalidateInput,
} from './cache/invalidate';

// User actions
export { createCreateUserAction, createUserInputSchema, executeCreateUser } from './user/create';
export type {
  CreateUserInput,
  CreateUserActionOptions,
  CreateUserActionConfig,
  ExecuteCreateUserOptions,
  ExecuteCreateUserConfig,
} from './user/create';

export { createUpdateUserAction, updateUserInputSchema, executeUpdateUser } from './user/update';
export type {
  UpdateUserInput,
  UpdateUserActionOptions,
  UpdateUserActionConfig,
  ExecuteUpdateUserOptions,
  ExecuteUpdateUserConfig,
} from './user/update';

export { createDeleteUserAction, deleteUserInputSchema, executeDeleteUser } from './user/delete';
export type {
  DeleteUserInput,
  DeleteUserActionOptions,
  DeleteUserActionConfig,
  DeleteUserResult,
  ExecuteDeleteUserOptions,
  ExecuteDeleteUserConfig,
} from './user/delete';

// Ability actions
export type { AbilityActionOptions, ExecuteAbilityOptions } from './ability/factory';

export { createGetAbilityAction, getAbilityInputSchema, executeGetAbility } from './ability/get';
export type {
  GetAbilityInput,
  GetAbilityActionConfig,
  ExecuteGetAbilityOptions,
  ExecuteGetAbilityConfig,
} from './ability/get';

export { createRunAbilityAction, runAbilityInputSchema, executeRunAbility } from './ability/execute';
export type {
  RunAbilityInput,
  RunAbilityActionConfig,
  ExecuteRunAbilityOptions,
  ExecuteRunAbilityConfig,
} from './ability/execute';

export { createDeleteAbilityAction, deleteAbilityInputSchema, executeDeleteAbility } from './ability/delete';
export type {
  DeleteAbilityInput,
  DeleteAbilityActionConfig,
  ExecuteDeleteAbilityOptions,
  ExecuteDeleteAbilityConfig,
} from './ability/delete';
