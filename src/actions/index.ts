/**
 * Single barrel for all server action factories, schemas, execute helpers, and types.
 * Organised by entity — add a new entity block here when introducing new action sets
 * (e.g. terms).  Per-operation files live under src/actions/<entity>/<operation>.ts.
 */

export type {
  ActionAuthConfig,
  ActionAuthHeadersConfig,
  ActionAuthHeadersFromContext,
  ResolvableActionAuthHeaders,
} from './auth';

// Post actions
export { createCreatePostAction, createPostInputSchema, executeCreatePost } from './post/create';
export type { CreatePostInput, CreatePostActionConfig, ExecuteCreateConfig } from './post/create';

export { createUpdatePostAction, updatePostInputSchema, executeUpdatePost } from './post/update';
export type { UpdatePostInput, UpdatePostActionConfig, ExecuteUpdateConfig } from './post/update';

export { createDeletePostAction, deletePostInputSchema, executeDeletePost } from './post/delete';
export type { DeletePostInput, DeletePostActionConfig, DeletePostResult, ExecuteDeleteConfig } from './post/delete';

// Term actions
export { createCreateTermAction, createTermInputSchema, executeCreateTerm } from './term/create';
export type { CreateTermInput, CreateTermActionConfig, ExecuteCreateTermConfig } from './term/create';

export { createUpdateTermAction, updateTermInputSchema, executeUpdateTerm } from './term/update';
export type { UpdateTermInput, UpdateTermActionConfig, ExecuteUpdateTermConfig } from './term/update';

export { createDeleteTermAction, deleteTermInputSchema, executeDeleteTerm } from './term/delete';
export type { DeleteTermInput, DeleteTermActionConfig, DeleteTermResult, ExecuteDeleteTermConfig } from './term/delete';
