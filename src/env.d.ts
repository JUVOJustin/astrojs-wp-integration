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

  export interface ActionResult<TData> {
    data: TData | undefined;
    error: ActionError | undefined;
  }

  export interface ActionClient<
    TData = unknown,
    TAccept = 'json' | 'form' | undefined,
    TSchema = unknown,
  > {
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro action inputs are validated by each action schema at runtime.
    (input: unknown): Promise<ActionResult<TData>>;
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro action inputs are validated by each action schema at runtime.
    orThrow(input: unknown): Promise<TData>;
    queryString?: string;
    toString(): string;
  }

  import type { APIContext } from 'astro';

  export type ActionAPIContext = APIContext;

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
    options: DefineActionOptions<TInput, TData, TSchema, TAccept>
  ): ActionClient<TData, TAccept, TSchema>;

  export function isActionError(error: unknown): error is ActionError;
  export function isInputError(error: unknown): error is ActionInputError;
}

declare module 'astro:content' {
  export interface LiveDataEntry<TData = unknown> {
    id: string;
    data: TData;
    cacheHint?: unknown;
    rendered?: { html: string };
  }

  export function getLiveEntry(
    collection: string,
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro resolves collection-specific filter types in generated application declarations.
    filter: unknown
  ): Promise<{
    entry?: LiveDataEntry;
    error?: Error;
    cacheHint?: unknown;
  }>;

  export function getLiveCollection(
    collection: string,
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro resolves collection-specific filter types in generated application declarations.
    filter?: unknown
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
  } from 'fluent-wp-client';

  export const catalog: WordPressDiscoveryCatalog | undefined;
  export const catalogPath: string | undefined;
  export const hasCatalog: boolean;

  export function seedWordPressClient<TClient extends WordPressClient>(
    client: TClient
  ): TClient;

  export function createWordPressClient(
    config?: WordPressClientConfig
  ): WordPressClient;

  export const defineWordPressClient: typeof createWordPressClient;
}

declare module 'virtual:wp-astrojs/schemas' {
  import type { ResourceZodSchemas } from 'fluent-wp-client/zod';

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
    options?: WordPressCatalogSchemaOptions
  ): ResourceZodSchemas;

  export function getWordPressContentSchemas(
    resource: string
  ): ResourceZodSchemas;

  export function getWordPressTermSchemas(resource: string): ResourceZodSchemas;

  export function withWordPressActionSchemas<
    TOptions extends Record<string, unknown>,
  >(
    resource: string,
    options?: TOptions & WordPressCatalogSchemaOptions
  ): TOptions & { schema?: unknown; responseSchema?: unknown };
}

declare module 'virtual:wp-astrojs/collections' {
  import type { LiveLoader, Loader } from 'astro/loaders';
  import type { BaseSchema } from 'astro:content';
  import type {
    WordPressClient,
    WordPressClientConfig,
  } from 'fluent-wp-client';
  import type { WordPressGeneratedResourceSchemas } from 'virtual:wp-astrojs/generated-schemas';
  import type { WordPressCatalogResourceKind } from 'virtual:wp-astrojs/schemas';

  export interface DefineWordPressCollectionOptions<
    TSchema extends BaseSchema = BaseSchema,
  > {
    mode?: 'static' | 'live';
    kind?: WordPressCatalogResourceKind | 'media' | 'users';
    client?: WordPressClient;
    clientConfig?: WordPressClientConfig;
    schema?: TSchema;
    loader?: Loader | LiveLoader;
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- WordPress plugin fields are open-ended; each consumer validates the values it uses.
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
    options?: DefineWordPressCollectionOptions<TSchema>
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };

  export function defineWordPressCollection<
    TSchema extends BaseSchema = BaseSchema,
  >(
    resource: string,
    options?: DefineWordPressCollectionOptions<TSchema>
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };
}

declare module 'virtual:wp-astrojs/generated-schemas' {
  export type WordPressGeneratedResourceSchemas = object;
  export const wordPressGeneratedSchemaMap: WordPressGeneratedResourceSchemas;
}
