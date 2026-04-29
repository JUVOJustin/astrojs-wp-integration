import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressPostLike,
  WordPressTag,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import {
  createContentCollectionCacheHint,
  createContentEntryCacheHint,
  createMediaCollectionCacheHint,
  createMediaEntryCacheHint,
  createTermCollectionCacheHint,
  createTermEntryCacheHint,
  createUserCollectionCacheHint,
  createUserEntryCacheHint,
  type WordPressCacheHint,
} from '../cache/hints';
import type {
  CategoryFilter,
  ContentFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
  TagFilter,
  TermFilter,
  WordPressEntryMappingOptions,
  WordPressTermLoaderOptions,
  WordPressContentLoaderOptions,
  WordPressEmbedMode,
  WordPressLiveContentLoaderOptions,
  UserFilter,
} from './types';

/**
 * Minimal embed config shared by post-like live loaders.
 */
type EmbedConfig = {
  embed?: WordPressEmbedMode;
};

/**
 * Shared shape used by Astro loader entry payloads.
 */
type IdentifiableEntry = {
  id: number;
};

/**
 * Astro's live loader callbacks pass an optional wrapped filter object.
 */
type LiveLoaderContext = {
  filter?: unknown;
};

/**
 * Configuration for one reusable live loader factory.
 */
interface LiveLoaderDefinition<TEntry extends IdentifiableEntry, TFilter> {
  name: string;
  resource: string;
  collectionError: string;
  entryError: string;
  notFoundError: string;
  loadCollectionData: (client: WordPressClient, filter: TFilter | undefined) => Promise<TEntry[]>;
  loadEntryData: (client: WordPressClient, filter: TFilter | undefined) => Promise<TEntry | undefined>;
  mapEntry?: WordPressEntryMappingOptions<TEntry, TFilter>['mapEntry'];
  createEntryCacheHint?: (entry: TEntry) => WordPressCacheHint;
  createCollectionCacheHint?: (entries: TEntry[], filter: TFilter | undefined) => WordPressCacheHint;
  renderHtml?: (entry: TEntry) => string | undefined;
}

/**
 * Unwraps Astro's optional nested `filter` shape into the real loader filter.
 */
function normalizeLoaderFilter<TFilter>(filter: unknown): TFilter | undefined {
  if (typeof filter === 'object' && filter !== null && 'filter' in filter) {
    return (filter as { filter?: TFilter }).filter;
  }

  return filter as TFilter | undefined;
}

/**
 * Converts one thrown value into Astro's expected loader error shape.
 */
function createLoaderError(message: string, error: unknown): { error: Error } {
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
  filter: TFilter | undefined,
): Promise<TEntry> {
  return definition.mapEntry
    ? definition.mapEntry(entry, { resource: definition.resource, filter })
    : entry;
}

/**
 * Builds one Astro live loader entry with optional rendered HTML.
 */
function createLiveEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  cacheHint?: WordPressCacheHint,
  renderHtml?: (entry: TEntry) => string | undefined,
): {
  id: string;
  data: TEntry;
  cacheHint?: WordPressCacheHint;
  rendered?: { html: string };
} {
  const html = renderHtml?.(entry);

  if (!html) {
    return {
      id: String(entry.id),
      data: entry,
      ...(cacheHint ? { cacheHint } : {}),
    };
  }

  return {
    id: String(entry.id),
    data: entry,
    ...(cacheHint ? { cacheHint } : {}),
    rendered: { html },
  };
}

/**
 * Creates one reusable live loader backed by `WordPressClient` methods.
 */
function createLiveWordPressLoader<TEntry extends IdentifiableEntry, TFilter>(
  client: WordPressClient,
  definition: LiveLoaderDefinition<TEntry, TFilter>,
): {
  name: string;
  loadCollection: (context: LiveLoaderContext) => Promise<{
    entries: ReturnType<typeof createLiveEntry<TEntry>>[];
    cacheHint?: WordPressCacheHint;
  } | { error: Error }>;
  loadEntry: (context: LiveLoaderContext) => Promise<ReturnType<typeof createLiveEntry<TEntry>> | { error: Error }>;
} {
  return {
    name: definition.name,
    loadCollection: async ({ filter }: LiveLoaderContext) => {
      try {
        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entries = await definition.loadCollectionData(client, resolvedFilter);
        const mappedEntries = await Promise.all(
          entries.map((entry) => mapLiveEntry(entry, definition, resolvedFilter)),
        );
        const cacheHint = definition.createCollectionCacheHint?.(entries, resolvedFilter);

        return {
          entries: mappedEntries.map((entry, index) => createLiveEntry(
            entry,
            definition.createEntryCacheHint?.(entries[index]),
            definition.renderHtml,
          )),
          ...(cacheHint ? { cacheHint } : {}),
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
          return createLoaderError(definition.notFoundError, new Error(definition.notFoundError));
        }

        const mappedEntry = await mapLiveEntry(entry, definition, resolvedFilter);

        return createLiveEntry(
          mappedEntry,
          definition.createEntryCacheHint?.(entry),
          definition.renderHtml,
        );
      } catch (error) {
        return createLoaderError(definition.entryError, error);
      }
    },
  };
}

/**
 * Resolves one post from either `id` or `slug` filter input.
 */
async function loadPostEntry(
  client: WordPressClient,
  filter: PostFilter | undefined,
  options?: EmbedConfig,
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.content('posts').item(filter.id, { embed: options?.embed });
  }

  if (filter?.slug) {
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
  options?: EmbedConfig,
): Promise<WordPressPage | undefined> {
  if (filter?.id) {
    return client.content('pages').item(filter.id, { embed: options?.embed });
  }

  if (filter?.slug) {
    return client.content('pages').item(filter.slug, { embed: options?.embed });
  }

  return undefined;
}

/**
 * Resolves one media item from either `id` or `slug` filter input.
 */
async function loadMediaEntry(
  client: WordPressClient,
  filter: MediaFilter | undefined,
): Promise<WordPressMedia | undefined> {
  if (filter?.id) {
    return client.media().item(filter.id);
  }

  if (filter?.slug) {
    return client.media().item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one category from either `id` or `slug` filter input.
 */
async function loadCategoryEntry(
  client: WordPressClient,
  filter: CategoryFilter | undefined,
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.terms('categories').item(filter.id);
  }

  if (filter?.slug) {
    return client.terms('categories').item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one tag from either `id` or `slug` filter input.
 */
async function loadTagEntry(
  client: WordPressClient,
  filter: TagFilter | undefined,
): Promise<WordPressTag | undefined> {
  if (filter?.id) {
    return client.terms('tags').item(filter.id);
  }

  if (filter?.slug) {
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

  const {
    id: _id,
    slug: _slug,
    hide_empty,
    hideEmpty,
    ...rest
  } = filter;

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
  filter: TermFilter | undefined,
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.terms(resource).item(filter.id);
  }

  if (filter?.slug) {
    return client.terms(resource).item(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one user from either `id` or `slug` filter input.
 */
async function loadUserEntry(
  client: WordPressClient,
  filter: UserFilter | undefined,
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
  options?: WordPressLiveContentLoaderOptions<WordPressPost, PostFilter>,
): LiveLoader<WordPressPost, PostFilter> {
  return createLiveWordPressLoader<WordPressPost, PostFilter>(client, {
    name: 'wordpress-post-loader',
    resource: 'posts',
    collectionError: 'Failed to load posts',
    entryError: 'Failed to load post',
    notFoundError: 'Post not found',
    createEntryCacheHint: (entry) => createContentEntryCacheHint('posts', entry),
    createCollectionCacheHint: (entries) => createContentCollectionCacheHint('posts', entries),
    loadCollectionData: (client, filter: PostFilter | undefined) => client.content('posts').list({
      status: filter?.status as never,
      categories: filter?.categories,
      tags: filter?.tags,
      search: filter?.search,
      orderby: filter?.orderby,
      order: filter?.order,
      page: filter?.page,
      perPage: filter?.perPage,
      embed: options?.embed,
    }),
    mapEntry: options?.mapEntry,
    loadEntryData: (client, filter: PostFilter | undefined) => loadPostEntry(client, filter, options),
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPost, PostFilter>;
}

/**
 * Creates a live loader for WordPress pages.
 */
export function wordPressPageLoader(
  client: WordPressClient,
  options?: WordPressLiveContentLoaderOptions<WordPressPage, PageFilter>,
): LiveLoader<WordPressPage, PageFilter> {
  return createLiveWordPressLoader<WordPressPage, PageFilter>(client, {
    name: 'wordpress-page-loader',
    resource: 'pages',
    collectionError: 'Failed to load pages',
    entryError: 'Failed to load page',
    notFoundError: 'Page not found',
    createEntryCacheHint: (entry) => createContentEntryCacheHint('pages', entry),
    createCollectionCacheHint: (entries) => createContentCollectionCacheHint('pages', entries),
    loadCollectionData: (client, filter: PageFilter | undefined) => client.content('pages').list({
      status: filter?.status as never,
      search: filter?.search,
      orderby: filter?.orderby,
      order: filter?.order,
      page: filter?.page,
      perPage: filter?.perPage,
      embed: options?.embed,
    }),
    mapEntry: options?.mapEntry,
    loadEntryData: (client, filter: PageFilter | undefined) => loadPageEntry(client, filter, options),
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPage, PageFilter>;
}

/**
 * Creates a live loader for WordPress media items.
 */
export function wordPressMediaLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressMedia, MediaFilter>,
): LiveLoader<WordPressMedia, MediaFilter> {
  return createLiveWordPressLoader<WordPressMedia, MediaFilter>(client, {
    name: 'wordpress-media-loader',
    resource: 'media',
    collectionError: 'Failed to load media',
    entryError: 'Failed to load media',
    notFoundError: 'Media not found',
    createEntryCacheHint: createMediaEntryCacheHint,
    createCollectionCacheHint: (entries) => createMediaCollectionCacheHint(entries),
    loadCollectionData: (client) => client.media().listAll(),
    loadEntryData: loadMediaEntry,
    mapEntry: options?.mapEntry,
  }) as LiveLoader<WordPressMedia, MediaFilter>;
}

/**
 * Creates a live loader for WordPress categories and taxonomies.
 */
export function wordPressCategoryLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressCategory, CategoryFilter>,
): LiveLoader<WordPressCategory, CategoryFilter> {
  return createLiveWordPressLoader<WordPressCategory, CategoryFilter>(client, {
    name: 'wordpress-category-loader',
    resource: 'categories',
    collectionError: 'Failed to load categories',
    entryError: 'Failed to load category',
    notFoundError: 'Category not found',
    createEntryCacheHint: (entry) => createTermEntryCacheHint('categories', entry),
    createCollectionCacheHint: (entries) => createTermCollectionCacheHint('categories', entries),
    loadCollectionData: (client, filter) => client.terms('categories').list({
      hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      parent: filter?.parent,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadCategoryEntry,
    mapEntry: options?.mapEntry,
  }) as LiveLoader<WordPressCategory, CategoryFilter>;
}

/**
 * Creates a live loader for WordPress tags.
 */
export function wordPressTagLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressTag, TagFilter>,
): LiveLoader<WordPressTag, TagFilter> {
  return createLiveWordPressLoader<WordPressTag, TagFilter>(client, {
    name: 'wordpress-tag-loader',
    resource: 'tags',
    collectionError: 'Failed to load tags',
    entryError: 'Failed to load tag',
    notFoundError: 'Tag not found',
    createEntryCacheHint: (entry) => createTermEntryCacheHint('tags', entry),
    createCollectionCacheHint: (entries) => createTermCollectionCacheHint('tags', entries),
    loadCollectionData: (client, filter) => client.terms('tags').list({
      hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      exclude: filter?.exclude,
      include: filter?.include,
      search: filter?.search,
      orderby: filter?.orderby,
      order: filter?.order,
      page: filter?.page,
      perPage: filter?.perPage,
    }),
    loadEntryData: loadTagEntry,
    mapEntry: options?.mapEntry,
  }) as LiveLoader<WordPressTag, TagFilter>;
}

/**
 * Creates a live loader for custom taxonomy term resources.
 */
export function wordPressTermLoader(
  client: WordPressClient,
  options: WordPressTermLoaderOptions<WordPressCategory, TermFilter>,
): LiveLoader<WordPressCategory, TermFilter> {
  const { resource } = options;

  return createLiveWordPressLoader<WordPressCategory, TermFilter>(client, {
    name: 'wordpress-term-loader',
    resource,
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} term`,
    notFoundError: `${resource} term not found`,
    createEntryCacheHint: (entry) => createTermEntryCacheHint(resource, entry),
    createCollectionCacheHint: (entries) => createTermCollectionCacheHint(resource, entries),
    loadCollectionData: (client, filter: TermFilter | undefined) => client.terms(resource).list(createTermQueryFilter(filter)),
    loadEntryData: (client, filter: TermFilter | undefined) => loadTermEntry(client, resource, filter),
    mapEntry: options.mapEntry,
  }) as LiveLoader<WordPressCategory, TermFilter>;
}

/**
 * Resolves one content entry from either `id` or `slug` filter input.
 * Used for custom post types via generic content resource helpers.
 * The v3 client returns the broader post-like shape for generic resources,
 * while Astro collections still expose this loader as post-compatible data.
 */
async function loadContentEntry(
  client: WordPressClient,
  resource: string,
  filter: ContentFilter | undefined,
  options?: EmbedConfig,
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.content(resource).item(filter.id, { embed: options?.embed }) as unknown as Promise<WordPressPost | undefined>;
  }

  if (filter?.slug) {
    return client.content(resource).item(filter.slug, { embed: options?.embed }) as unknown as Promise<WordPressPost | undefined>;
  }

  return undefined;
}

/**
 * Creates a live loader for WordPress users.
 */
export function wordPressUserLoader(
  client: WordPressClient,
  options?: WordPressEntryMappingOptions<WordPressAuthor, UserFilter>,
): LiveLoader<WordPressAuthor, UserFilter> {
  return createLiveWordPressLoader<WordPressAuthor, UserFilter>(client, {
    name: 'wordpress-user-loader',
    resource: 'users',
    collectionError: 'Failed to load users',
    entryError: 'Failed to load user',
    notFoundError: 'User not found',
    createEntryCacheHint: createUserEntryCacheHint,
    createCollectionCacheHint: () => createUserCollectionCacheHint(),
    loadCollectionData: (client, filter) => client.users().list({
      roles: filter?.roles,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadUserEntry,
    mapEntry: options?.mapEntry,
  }) as LiveLoader<WordPressAuthor, UserFilter>;
}

/**
 * Creates a live loader for custom WordPress content resources (CPTs).
 * Aligns with fluent-wp-client's content(resource) naming.
 */
export function wordPressContentLoader<TEntry extends WordPressPostLike = WordPressPost>(
  client: WordPressClient,
  options: WordPressContentLoaderOptions<TEntry, ContentFilter>,
): LiveLoader<TEntry, ContentFilter> {
  const { resource, embed } = options;

  return createLiveWordPressLoader<TEntry, ContentFilter>(client, {
    name: 'wordpress-content-loader',
    resource,
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} entry`,
    notFoundError: `${resource} entry not found`,
    createEntryCacheHint: (entry) => createContentEntryCacheHint(resource, entry),
    createCollectionCacheHint: (entries) => createContentCollectionCacheHint(resource, entries),
    loadCollectionData: (client, filter: ContentFilter | undefined) => client.content<TEntry>(resource).list({
      status: filter?.status as never,
      categories: filter?.categories,
      tags: filter?.tags,
      orderby: filter?.orderby,
      order: filter?.order,
      perPage: filter?.perPage,
      page: filter?.page,
      embed,
    }),
    loadEntryData: (client, filter: ContentFilter | undefined) => loadContentEntry(client, resource, filter, { embed }) as Promise<TEntry | undefined>,
    mapEntry: options.mapEntry,
    renderHtml: (entry) => entry.content?.rendered,
  }) as LiveLoader<TEntry, ContentFilter>;
}
