/// <reference types="astro/types" />

declare module 'astro:actions' {
  export type ActionErrorCode = string;

  export interface ActionErrorParams {
    code: ActionErrorCode;
    message?: string;
    stack?: string;
  }

  export class ActionError extends Error {
    readonly type: 'AstroActionError';
    readonly code: ActionErrorCode;
    readonly status: number;

    constructor(params: ActionErrorParams);

    static codeToStatus(code: ActionErrorCode): number;
    static statusToCode(status: number): ActionErrorCode;
  }

  export class ActionInputError extends ActionError {
    readonly type: 'AstroActionInputError';
    readonly issues: unknown[];
    readonly fields: Record<string, string[]>;
  }

  export type ActionResult<TData> = {
    data: TData | undefined;
    error: ActionError | undefined;
  };

  export interface ActionClient<
    TData = unknown,
    TAccept = 'json' | 'form' | undefined,
    TSchema = unknown,
  > {
    (input: unknown): Promise<ActionResult<TData>>;
    orThrow(input: unknown): Promise<TData>;
    queryString?: string;
    toString(): string;
  }

  export type ActionAPIContext = import('astro').APIContext;

  export interface DefineActionOptions<
    TInput,
    TData,
    TSchema = unknown,
    TAccept extends 'json' | 'form' | undefined = undefined,
  > {
    accept?: TAccept;
    input?: TSchema;
    handler(input: TInput, context: ActionAPIContext): TData | Promise<TData>;
  }

  export function defineAction<
    TInput,
    TData,
    TSchema = unknown,
    TAccept extends 'json' | 'form' | undefined = undefined,
  >(
    options: DefineActionOptions<TInput, TData, TSchema, TAccept>,
  ): ActionClient<TData, TAccept, TSchema>;

  export function isActionError(error: unknown): error is ActionError;
  export function isInputError(error: unknown): error is ActionInputError;
}

declare module 'astro:content' {
  export type LiveDataEntry<TData = unknown> = {
    id: string;
    data: TData;
    cacheHint?: unknown;
    rendered?: { html: string };
  };

  export function getLiveEntry(
    collection: string,
    filter: unknown,
  ): Promise<{
    entry?: LiveDataEntry;
    error?: Error;
    cacheHint?: unknown;
  }>;

  export function getLiveCollection(
    collection: string,
    filter?: unknown,
  ): Promise<{
    entries: LiveDataEntry[];
    error?: Error;
    cacheHint?: unknown;
  }>;
}

// Keep these local development declarations in sync with VIRTUAL_MODULE_TYPES in src/integration.ts.
declare module 'virtual:wp-astrojs/catalog' {
  import type {
    WordPressClient,
    WordPressClientConfig,
    WordPressDiscoveryCatalog,
  } from 'wp-astrojs-integration';

  export const catalog: WordPressDiscoveryCatalog | undefined;
  export const catalogPath: string | undefined;
  export const hasCatalog: boolean;

  export function seedWordPressClient<TClient extends WordPressClient>(
    client: TClient,
  ): TClient;

  export function createWordPressClient(
    config?: WordPressClientConfig,
  ): WordPressClient;

  export const defineWordPressClient: typeof createWordPressClient;
}

declare module 'virtual:wp-astrojs/schemas' {
  import type { ResourceZodSchemas } from 'wp-astrojs-integration';

  export type WordPressCatalogResourceKind =
    | 'auto'
    | 'content'
    | 'terms'
    | 'resources';

  export interface WordPressCatalogSchemaOptions {
    kind?: WordPressCatalogResourceKind;
  }

  export function getWordPressResourceSchemas(
    resource: string,
    options?: WordPressCatalogSchemaOptions,
  ): ResourceZodSchemas;

  export function getWordPressContentSchemas(
    resource: string,
  ): ResourceZodSchemas;

  export function getWordPressTermSchemas(resource: string): ResourceZodSchemas;

  export function withWordPressActionSchemas<
    TOptions extends Record<string, unknown>,
  >(
    resource: string,
    options?: TOptions & WordPressCatalogSchemaOptions,
  ): TOptions & { schema?: unknown; responseSchema?: unknown };
}

declare module 'virtual:wp-astrojs/collections' {
  import type { BaseSchema } from 'astro:content';
  import type { WordPressGeneratedResourceSchemas } from 'virtual:wp-astrojs/generated-schemas';
  import type { WordPressCatalogResourceKind } from 'virtual:wp-astrojs/schemas';
  import type { LiveLoader, Loader } from 'astro/loaders';
  import type {
    WordPressClient,
    WordPressClientConfig,
  } from 'wp-astrojs-integration';

  export interface DefineWordPressCollectionOptions<
    TSchema extends BaseSchema = BaseSchema,
  > {
    mode?: 'static' | 'live';
    kind?: WordPressCatalogResourceKind | 'media' | 'users';
    client?: WordPressClient;
    clientConfig?: WordPressClientConfig;
    schema?: TSchema;
    loader?: Loader | LiveLoader;
    loaderOptions?: Record<string, unknown>;
  }

  export type GeneratedWordPressSchema<
    TResource extends keyof WordPressGeneratedResourceSchemas,
  > = WordPressGeneratedResourceSchemas[TResource] extends BaseSchema
    ? WordPressGeneratedResourceSchemas[TResource]
    : BaseSchema;

  export function defineWordPressCollection<
    TResource extends keyof WordPressGeneratedResourceSchemas,
    TSchema extends BaseSchema = GeneratedWordPressSchema<TResource>,
  >(
    resource: TResource,
    options?: DefineWordPressCollectionOptions<TSchema>,
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };

  export function defineWordPressCollection<
    TSchema extends BaseSchema = BaseSchema,
  >(
    resource: string,
    options?: DefineWordPressCollectionOptions<TSchema>,
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };
}

declare module 'virtual:wp-astrojs/generated-schemas' {
  export interface WordPressGeneratedResourceSchemas {}
  export const wordPressGeneratedSchemaMap: WordPressGeneratedResourceSchemas;
}
