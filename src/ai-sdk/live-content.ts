import type { APIContext } from 'astro';
import { getLiveCollection, getLiveEntry } from 'astro:content';
import type { QueryParams, WordPressClient, WordPressPostLike } from 'fluent-wp-client';
import {
  getContentCollectionTool,
  getContentTool,
  type ContentItemResult,
  type ContentCollectionToolOptions,
  type ContentGetToolOptions,
} from 'fluent-wp-client/ai-sdk';

type AstroCacheController = Pick<APIContext['cache'], 'set'>;
type RouteCacheValue = Parameters<AstroCacheController['set']>[0];

type LiveContentGetInput = {
  contentType: string;
  fields?: string[];
  id?: number;
  includeBlocks?: boolean;
  includeContent?: boolean;
  slug?: string;
};

type LiveContentCollectionInput = {
  contentType: string;
  filter: QueryParams;
};

type MaybePromise<T> = T | Promise<T>;

type PersonalizedResolver<TInput> = boolean | ((input: TInput) => MaybePromise<boolean>);

interface AstroLiveToolOptions<TInput extends Record<string, unknown>> {
  /** Astro live collection name passed to `getLiveEntry()` / `getLiveCollection()`. */
  collection: string;
  /** Whether the current request is personalized and must bypass route caching. */
  personalized?: PersonalizedResolver<TInput>;
}

export interface AstroLiveContentToolOptions
  extends Omit<ContentGetToolOptions<Record<string, unknown>>, 'fetch'>,
    AstroLiveToolOptions<LiveContentGetInput> {}

export interface AstroLiveContentCollectionToolOptions
  extends Omit<ContentCollectionToolOptions<Record<string, unknown>>, 'fetch'>,
    AstroLiveToolOptions<LiveContentCollectionInput> {}

/**
 * Resolves one maybe-async option value.
 */
async function resolveOption<TInput, TValue>(
  value: TValue | ((input: TInput) => MaybePromise<TValue>) | undefined,
  input: TInput,
): Promise<TValue | undefined> {
  if (typeof value === 'function') {
    return (value as (input: TInput) => MaybePromise<TValue>)(input);
  }

  return value;
}

/**
 * Applies Astro route-cache behavior for one live collection read.
 */
async function applyRouteCache<TInput extends Record<string, unknown>>(
  cache: AstroCacheController,
  input: TInput,
  cacheableValue: RouteCacheValue | undefined,
  options: AstroLiveToolOptions<TInput>,
): Promise<void> {
  const isPersonalized = await resolveOption(options.personalized, input);

  if (isPersonalized) {
    cache.set(false);
    return;
  }

  if (cacheableValue !== undefined) {
    cache.set(cacheableValue as RouteCacheValue);
  }
}

/**
 * Adds collection context to Astro live collection failures.
 */
function createLiveCollectionError(collection: string, action: 'entry' | 'collection', error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);

  return new Error(
    `Failed to resolve live ${action} from collection "${collection}". Define that live collection in src/live.config.ts before using the Astro AI SDK helper. ${detail}`,
  );
}

/**
 * Reads one Astro live entry and turns missing-collection failures into actionable errors.
 */
async function readLiveEntry(collection: string, filter: { id: number } | { slug: string }) {
  try {
    return await getLiveEntry(collection, filter);
  } catch (error) {
    throw createLiveCollectionError(collection, 'entry', error);
  }
}

/**
 * Reads one Astro live collection and turns missing-collection failures into actionable errors.
 */
async function readLiveCollection(collection: string, filter: QueryParams) {
  try {
    return await getLiveCollection(collection, filter);
  } catch (error) {
    throw createLiveCollectionError(collection, 'collection', error);
  }
}

/**
 * Creates one Astro-aware AI SDK content getter backed by a live collection.
 */
export function getLiveContentTool(
  client: WordPressClient,
  cache: AstroCacheController,
  options: AstroLiveContentToolOptions,
) {
  return getContentTool(client, {
    ...options,
    fetch: async (input) => {
      if (input.includeBlocks || input.includeContent) {
        throw new Error(
          'Live collection AI tools do not support includeContent/includeBlocks because live loaders return serializable entry data only.',
        );
      }

      const filter = input.id !== undefined
        ? { id: input.id }
        : input.slug !== undefined
          ? { slug: input.slug }
          : undefined;

      if (!filter) {
        throw new Error('Either id or slug must be provided.');
      }

      const result = await readLiveEntry(options.collection, filter);

      if (result.error) {
        throw createLiveCollectionError(options.collection, 'entry', result.error);
      }

      await applyRouteCache(cache, input, result.entry as RouteCacheValue | undefined, options);

      return {
        item: result.entry?.data,
      } as ContentItemResult<WordPressPostLike | undefined>;
    },
  } as ContentGetToolOptions<Record<string, unknown>>);
}

/**
 * Creates one Astro-aware AI SDK content collection tool backed by a live collection.
 */
export function getLiveContentCollectionTool(
  client: WordPressClient,
  cache: AstroCacheController,
  options: AstroLiveContentCollectionToolOptions,
) {
  return getContentCollectionTool(client, {
    ...options,
    fetch: async (input) => {
      const result = await readLiveCollection(options.collection, input.filter);

      if (result.error) {
        throw createLiveCollectionError(options.collection, 'collection', result.error);
      }

      await applyRouteCache(cache, input, result.cacheHint as RouteCacheValue | undefined, options);
      return result.entries.map((entry: { data: unknown }) => entry.data) as WordPressPostLike[];
    },
  } as ContentCollectionToolOptions<Record<string, unknown>>);
}
