import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressPostLike,
  WordPressTag,
  WordPressClient,
} from 'fluent-wp-client';

import {
  createContentCollectionCacheHint,
  createContentEntryCacheHint,
  createMediaCollectionCacheHint,
  createMediaEntryCacheHint,
  createTermCollectionCacheHint,
  createTermEntryCacheHint,
  createUserCollectionCacheHint,
  createUserEntryCacheHint,
} from '../cache/hints';
import type { WordPressCacheHint } from '../cache/hints';
import type {
  CategoryFilter,
  ContentFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
  TagFilter,
  TermFilter,
  UserFilter,
  WordPressContentLoaderOptions,
  WordPressEmbedMode,
  WordPressEntryMappingOptions,
  WordPressLiveContentLoaderOptions,
  WordPressTermLoaderOptions,
} from './types';

/**
 * Minimal embed config shared by post-like live loaders.
 */
interface EmbedConfig {
  embed?: WordPressEmbedMode;
}

/**
 * Shared shape used by Astro loader entry payloads.
 */
interface IdentifiableEntry {
  id: number;
}

/**
 * Astro's live loader callbacks pass an optional wrapped filter object.
 */
interface LiveLoaderContext {
  filter?: unknown;
}

/**
 * Configuration for one reusable live loader factory.
 */
interface LiveLoaderDefinition<TEntry extends IdentifiableEntry, TFilter> {
  name: string;
  resource: string;
  collectionError: string;
  entryError: string;
  notFoundError: string;
  loadCollectionData: (
    client: WordPressClient,
    filter: TFilter | undefined
  ) => Promise<TEntry[]>;
  loadEntryData: (
    client: WordPressClient,
    filter: TFilter | undefined
  ) => Promise<TEntry | undefined>;
  mapEntry?: WordPressEntryMappingOptions<TEntry, TFilter>['mapEntry'];
  createEntryCacheHint?: (entry: TEntry) => WordPressCacheHint;
  createCollectionCacheHint?: (
    entries: TEntry[],
    filter: TFilter | undefined
  ) => WordPressCacheHint;
  renderHtml?: (entry: TEntry) => string | undefined;
}

/**
 * Strips the loader-only ID lookup field while preserving upstream collection
 * filters such as `slug`, `search`, `include`, and custom query params.
 */
function stripEntryLookupId<T extends { id?: unknown }>(
  filter: T
): Omit<T, 'id'> {
  const { id: _id, ...rest } = filter;

  return rest;
}

/**
 * Unwraps Astro's optional nested `filter` shape into the real loader filter.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro and the legacy wrapper supply different filter envelopes at this callback boundary.
function normalizeLoaderFilter<TFilter>(filter: unknown): TFilter | undefined {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Unwrap the legacy Astro filter envelope while preserving direct filters.
  if (typeof filter === 'object' && filter !== null && 'filter' in filter) {
    // SAFETY: The legacy Astro wrapper carries the same resource filter as the direct callback input.
    return filter.filter as TFilter | undefined;
  }

  // SAFETY: Public loader signatures bind this callback input to their resource-specific filter type.
  return filter as TFilter | undefined;
}

/**
 * Converts one thrown value into Astro's expected loader error shape.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JavaScript can throw non-Error values; Astro expects an Error result.
function createLoaderError(message: string, error: unknown) {
  return {
    error: error instanceof Error ? error : new Error(message),
  };
}

/**
 * Applies the optional site-specific mapper while keeping cache hints based on the raw WordPress payload.
 */
async function mapLiveEntry<TEntry extends IdentifiableEntry, TFilter>(
  entry: TEntry,
  definition: LiveLoaderDefinition<TEntry, TFilter>,
  filter: TFilter | undefined
): Promise<TEntry> {
  return definition.mapEntry
    ? definition.mapEntry(entry, { filter, resource: definition.resource })
    : entry;
}

/**
 * Builds one Astro live loader entry with optional rendered HTML.
 */
function createLiveEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  cacheHint?: WordPressCacheHint,
  renderHtml?: (entry: TEntry) => string | undefined
) {
  const html = renderHtml?.(entry);

  if (!html) {
    return {
      data: entry,
      id: String(entry.id),
      ...(cacheHint ? { cacheHint } : undefined),
    };
  }

  return {
    id: String(entry.id),
    data: entry,
    ...(cacheHint ? { cacheHint } : undefined),
    rendered: { html },
  };
}

/**
 * Free-text searches can change membership when any matching or formerly
 * matching entity changes, so only per-entry hints are safe for these results.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- The shared loader must inspect filters for resources with different query fields.
function hasFreeTextSearchFilter(filter: unknown): boolean {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Only object filters can contain a search query.
  if (typeof filter !== 'object' || filter === null) {
    return false;
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Only string searches can affect collection membership.
  return 'search' in filter && typeof filter.search === 'string';
}

/**
 * Creates one reusable live loader backed by `WordPressClient` methods.
 */
function createLiveWordPressLoader<TEntry extends IdentifiableEntry, TFilter>(
  client: WordPressClient,
  definition: LiveLoaderDefinition<TEntry, TFilter>
) {
  return {
    loadCollection: async ({ filter }: LiveLoaderContext) => {
      try {
        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);

        const entries = await definition.loadCollectionData(
          client,
          resolvedFilter
        );

        const mappedEntries = await Promise.all(
          entries.map((entry) =>
            mapLiveEntry(entry, definition, resolvedFilter)
          )
        );

        const cacheHint = hasFreeTextSearchFilter(resolvedFilter)
          ? undefined
          : definition.createCollectionCacheHint?.(entries, resolvedFilter);

        return {
          entries: mappedEntries.map((entry, index) =>
            createLiveEntry(
              entry,
              definition.createEntryCacheHint?.(entries[index]),
              definition.renderHtml
            )
          ),
          ...(cacheHint ? { cacheHint } : undefined),
        };
      } catch (error) {
        return createLoaderError(definition.collectionError, error);
      }
    },
    loadEntry: async ({ filter }: LiveLoaderContext) => {
      try {
        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entry = await definition.loadEntryData(client, resolvedFilter);

        if (!entry) {
          return createLoaderError(
            definition.notFoundError,
            new Error(definition.notFoundError)
          );
        }

        const mappedEntry = await mapLiveEntry(
          entry,
          definition,
          resolvedFilter
        );

        return createLiveEntry(
          mappedEntry,
          definition.createEntryCacheHint?.(entry),
          definition.renderHtml
        );
      } catch (error) {
        return createLoaderError(definition.entryError, error);
      }
    },
    name: definition.name,
  };
}

/**
 * Resolves one post from either `id` or `slug` filter input.
 */
async function loadPostEntry(
  client: WordPressClient,
  filter: PostFilter | undefined,
  options?: EmbedConfig
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.content('posts').item(filter.id, { embed: options?.embed });
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.content('posts').item(filter.slug, { embed: options?.embed });
  }

  return undefined;
}

/**
 * Resolves one page from either `id` or `slug` filter input.
 */
async function loadPageEntry(
  client: WordPressClient,
  filter: PageFilter | undefined,
  options?: EmbedConfig
): Promise<WordPressPage | undefined> {
  if (filter?.id) {
    return client.content('pages').item(filter.id, { embed: options?.embed });
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.content('pages').item(filter.slug, { embed: options?.embed });
  }

  return undefined;
}

/**
 * Resolves one media item from either `id` or `slug` filter input.
 */
async function loadMediaEntry(
  client: WordPressClient,
  filter: MediaFilter | undefined
): Promise<WordPressMedia | undefined> {
  if (filter?.id) {
    return client.media().item(filter.id);
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.media().item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one category from either `id` or `slug` filter input.
 */
async function loadCategoryEntry(
  client: WordPressClient,
  filter: CategoryFilter | undefined
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.terms('categories').item(filter.id);
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.terms('categories').item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one tag from either `id` or `slug` filter input.
 */
async function loadTagEntry(
  client: WordPressClient,
  filter: TagFilter | undefined
): Promise<WordPressTag | undefined> {
  if (filter?.id) {
    return client.terms('tags').item(filter.id);
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.terms('tags').item(filter.slug);
  }

  return undefined;
}

/**
 * Maps one term filter to generic query params accepted by custom taxonomies.
 */
function createTermQueryFilter(filter: TermFilter | undefined): TermFilter {
  if (!filter) {
    return {};
  }

  const { id: _id, hide_empty, hideEmpty, ...rest } = filter;

  return {
    ...rest,
    hideEmpty: hideEmpty ?? hide_empty,
  };
}

/**
 * Resolves one term from either `id` or `slug` for custom taxonomy resources.
 */
async function loadTermEntry(
  client: WordPressClient,
  resource: string,
  filter: TermFilter | undefined
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.terms(resource).item(filter.id);
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client.terms(resource).item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one user from either `id` or `slug` filter input.
 */
async function loadUserEntry(
  client: WordPressClient,
  filter: UserFilter | undefined
): Promise<WordPressAuthor | undefined> {
  if (filter?.id) {
    return client.users().item(filter.id);
  }

  if (!filter?.slug) {
    return undefined;
  }

  const users = await client.users().list({ search: filter.slug });

  return users.find((candidate) => candidate.slug === filter.slug);
}

/**
 * Creates a live loader for WordPress posts.
 */
export function wordPressPostLoader(
  client: WordPressClient,
  options?: WordPressLiveContentLoaderOptions<WordPressPost, PostFilter>
): LiveLoader<WordPressPost, PostFilter, PostFilter> {
  return createLiveWordPressLoader<WordPressPost, PostFilter>(client, {
    collectionError: 'Failed to load posts',
    createCollectionCacheHint: (entries) =>
      createContentCollectionCacheHint('posts', entries),
    createEntryCacheHint: (entry) =>
      createContentEntryCacheHint('posts', entry),
    entryError: 'Failed to load post',
    loadCollectionData: (client, filter: PostFilter | undefined) =>
      client.content('posts').list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
        embed: options?.embed,
      }),
    loadEntryData: (client, filter: PostFilter | undefined) =>
      loadPostEntry(client, filter, options),
    mapEntry: options?.mapEntry,
    name: 'wordpress-post-loader',
    notFoundError: 'Post not found',
    renderHtml: (entry) => entry.content.rendered,
    resource: 'posts',
  });
}

/**
 * Creates a live loader for WordPress pages.
 */
export function wordPressPageLoader(
  client: WordPressClient,
  options?: WordPressLiveContentLoaderOptions<WordPressPage, PageFilter>
): LiveLoader<WordPressPage, PageFilter, PageFilter> {
  return createLiveWordPressLoader<WordPressPage, PageFilter>(client, {
    collectionError: 'Failed to load pages',
    createCollectionCacheHint: (entries) =>
      createContentCollectionCacheHint('pages', entries),
    createEntryCacheHint: (entry) =>
      createContentEntryCacheHint('pages', entry),
    entryError: 'Failed to load page',
    loadCollectionData: (client, filter: PageFilter | undefined) =>
      client.content('pages').list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
        embed: options?.embed,
      }),
    loadEntryData: (client, filter: PageFilter | undefined) =>
      loadPageEntry(client, filter, options),
    mapEntry: options?.mapEntry,
    name: 'wordpress-page-loader',
    notFoundError: 'Page not found',
    renderHtml: (entry) => entry.content.rendered,
    resource: 'pages',
  });
}

/**
 * Creates a live loader for WordPress media items.
 */
export function wordPressMediaLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressMedia, MediaFilter>
): LiveLoader<WordPressMedia, MediaFilter, MediaFilter> {
  return createLiveWordPressLoader<WordPressMedia, MediaFilter>(client, {
    collectionError: 'Failed to load media',
    createCollectionCacheHint: (entries) =>
      createMediaCollectionCacheHint(entries),
    createEntryCacheHint: createMediaEntryCacheHint,
    entryError: 'Failed to load media',
    loadCollectionData: (client, filter) =>
      filter
        ? client.media().list(stripEntryLookupId(filter))
        : client.media().listAll(),
    loadEntryData: loadMediaEntry,
    mapEntry: options?.mapEntry,
    name: 'wordpress-media-loader',
    notFoundError: 'Media not found',
    resource: 'media',
  });
}

/**
 * Creates a live loader for WordPress categories and taxonomies.
 */
export function wordPressCategoryLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressCategory, CategoryFilter>
): LiveLoader<WordPressCategory, CategoryFilter, CategoryFilter> {
  return createLiveWordPressLoader<WordPressCategory, CategoryFilter>(client, {
    collectionError: 'Failed to load categories',
    createCollectionCacheHint: (entries) =>
      createTermCollectionCacheHint('categories', entries),
    createEntryCacheHint: (entry) =>
      createTermEntryCacheHint('categories', entry),
    entryError: 'Failed to load category',
    loadCollectionData: (client, filter) =>
      client.terms('categories').list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
        hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      }),
    loadEntryData: loadCategoryEntry,
    mapEntry: options?.mapEntry,
    name: 'wordpress-category-loader',
    notFoundError: 'Category not found',
    resource: 'categories',
  });
}

/**
 * Creates a live loader for WordPress tags.
 */
export function wordPressTagLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressTag, TagFilter>
): LiveLoader<WordPressTag, TagFilter, TagFilter> {
  return createLiveWordPressLoader<WordPressTag, TagFilter>(client, {
    collectionError: 'Failed to load tags',
    createCollectionCacheHint: (entries) =>
      createTermCollectionCacheHint('tags', entries),
    createEntryCacheHint: (entry) => createTermEntryCacheHint('tags', entry),
    entryError: 'Failed to load tag',
    loadCollectionData: (client, filter) =>
      client.terms('tags').list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
        hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      }),
    loadEntryData: loadTagEntry,
    mapEntry: options?.mapEntry,
    name: 'wordpress-tag-loader',
    notFoundError: 'Tag not found',
    resource: 'tags',
  });
}

/**
 * Creates a live loader for custom taxonomy term resources.
 */
export function wordPressTermLoader(
  client: WordPressClient,
  options: WordPressTermLoaderOptions<WordPressCategory, TermFilter>
): LiveLoader<WordPressCategory, TermFilter, TermFilter> {
  const { resource } = options;

  return createLiveWordPressLoader<WordPressCategory, TermFilter>(client, {
    collectionError: `Failed to load ${resource}`,
    createCollectionCacheHint: (entries) =>
      createTermCollectionCacheHint(resource, entries),
    createEntryCacheHint: (entry) => createTermEntryCacheHint(resource, entry),
    entryError: `Failed to load ${resource} term`,
    loadCollectionData: (client, filter: TermFilter | undefined) =>
      client.terms(resource).list(createTermQueryFilter(filter)),
    loadEntryData: (client, filter: TermFilter | undefined) =>
      loadTermEntry(client, resource, filter),
    mapEntry: options.mapEntry,
    name: 'wordpress-term-loader',
    notFoundError: `${resource} term not found`,
    resource,
  });
}

/**
 * Resolves one content entry from either `id` or `slug` filter input.
 * Used for custom post types via generic content resource helpers.
 * The v3 client returns the broader post-like shape for generic resources,
 * while Astro collections still expose this loader as post-compatible data.
 */
async function loadContentEntry<TEntry extends WordPressPostLike>(
  client: WordPressClient,
  resource: string,
  filter: ContentFilter | undefined,
  options?: EmbedConfig
): Promise<TEntry | undefined> {
  if (filter?.id) {
    return client
      .content<TEntry>(resource)
      .item(filter.id, { embed: options?.embed });
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Collection filters also accept slug arrays; a single-entry lookup requires a string.
  if (typeof filter?.slug === 'string') {
    return client
      .content<TEntry>(resource)
      .item(filter.slug, { embed: options?.embed });
  }

  return undefined;
}

/**
 * Creates a live loader for WordPress users.
 */
export function wordPressUserLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressAuthor, UserFilter>
): LiveLoader<WordPressAuthor, UserFilter, UserFilter> {
  return createLiveWordPressLoader<WordPressAuthor, UserFilter>(client, {
    collectionError: 'Failed to load users',
    createCollectionCacheHint: () => createUserCollectionCacheHint(),
    createEntryCacheHint: createUserEntryCacheHint,
    entryError: 'Failed to load user',
    loadCollectionData: (client, filter) =>
      client.users().list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
      }),
    loadEntryData: loadUserEntry,
    mapEntry: options?.mapEntry,
    name: 'wordpress-user-loader',
    notFoundError: 'User not found',
    resource: 'users',
  });
}

/**
 * Creates a live loader for custom WordPress content resources (CPTs).
 * Aligns with fluent-wp-client's content(resource) naming.
 */
export function wordPressContentLoader<
  TEntry extends WordPressPostLike = WordPressPost,
>(
  client: WordPressClient,
  options: WordPressContentLoaderOptions<TEntry, ContentFilter>
): LiveLoader<TEntry, ContentFilter, ContentFilter> {
  const { resource, embed } = options;

  return createLiveWordPressLoader<TEntry, ContentFilter>(client, {
    collectionError: `Failed to load ${resource}`,
    createCollectionCacheHint: (entries) =>
      createContentCollectionCacheHint(resource, entries),
    createEntryCacheHint: (entry) =>
      createContentEntryCacheHint(resource, entry),
    entryError: `Failed to load ${resource} entry`,
    loadCollectionData: (client, filter: ContentFilter | undefined) =>
      client.content<TEntry>(resource).list({
        ...(filter ? stripEntryLookupId(filter) : undefined),
        embed,
      }),
    loadEntryData: (client, filter: ContentFilter | undefined) =>
      loadContentEntry<TEntry>(client, resource, filter, { embed }),
    mapEntry: options.mapEntry,
    name: 'wordpress-content-loader',
    notFoundError: `${resource} entry not found`,
    renderHtml: (entry) => entry.content?.rendered,
    resource,
  });
}
