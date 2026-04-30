/**
 * Type definitions for WordPress loaders.
 */

import type {
  CategoriesFilter,
  MediaFilter as ClientMediaFilter,
  ExtensibleFilter,
  PagesFilter,
  PostsFilter,
  TagsFilter,
  UsersFilter,
} from 'fluent-wp-client';

/**
 * Build-time filter for static loaders. Passed as loader options and forwarded
 * to `listAll()` once at build/prerender time to scope which entries are fetched.
 * `page` is omitted because `listAll()` handles pagination internally.
 */
export type StaticLoaderFilter<TFilter> = Omit<TFilter, 'page'>;

/**
 * Optional embed configuration forwarded to fluent-wp-client content reads.
 */
export type WordPressEmbedMode = boolean | string[];

/**
 * Per-entry mapper for site-specific field normalization before Astro receives loader data.
 */
export type WordPressLoaderEntryMapper<TEntry, TFilter = unknown> = (
  entry: TEntry,
  context: {
    resource: string;
    filter?: TFilter;
  },
) => TEntry | Promise<TEntry>;

/**
 * Shared options for loaders that can rewrite entries after WordPress returns them.
 */
export interface WordPressEntryMappingOptions<TEntry, TFilter = unknown> {
  /**
   * Rewrites one entry before it is returned to Astro.
   * Useful for plugging in site-specific field normalization or catalog-driven label mapping.
   */
  mapEntry?: WordPressLoaderEntryMapper<TEntry, TFilter>;
}

/**
 * Options shared by live loaders that read post-like content resources.
 */
export interface WordPressLiveContentLoaderOptions<
  TEntry = unknown,
  TFilter = unknown,
> extends WordPressEntryMappingOptions<TEntry, TFilter> {
  /**
   * Requests embedded relations for collection and entry reads.
   * Leave unset for the lean default payload.
   */
  embed?: WordPressEmbedMode;
}

/**
 * Options for generic taxonomy loaders targeting one REST term resource.
 */
export interface WordPressTermLoaderOptions<TEntry = unknown, TFilter = unknown>
  extends WordPressEntryMappingOptions<TEntry, TFilter> {
  /** REST resource path (examples: 'categories', 'tags', 'genres') */
  resource: string;
}

/**
 * Options for generic static taxonomy loaders.
 */
export interface WordPressTermStaticLoaderOptions<TEntry = unknown>
  extends WordPressTermLoaderOptions<TEntry> {
  /**
   * Build-time filter forwarded to `listAll()`. Scopes which terms are fetched
   * at build/prerender time. `page` is omitted — `listAll()` handles pagination.
   */
  filter?: StaticLoaderFilter<ExtensibleFilter<CategoriesFilter>>;
}

/**
 * Base filter shape for loader entry lookup by ID or slug.
 */
export interface LoaderEntryLookup {
  /** WordPress entity ID */
  id?: number;
  /** WordPress entity slug for single-entry lookups. */
  slug?: string;
}

/**
 * Live loader filters use fluent-wp-client collection filters while also
 * accepting a string slug for Astro single-entry lookups.
 */
export type WordPressLiveFilter<TFilter extends object> = Omit<
  ExtensibleFilter<TFilter>,
  'slug'
> &
  LoaderEntryLookup & {
    slug?:
      | string
      | (ExtensibleFilter<TFilter> extends { slug?: infer TSlug }
          ? TSlug
          : never);
  };

/**
 * Filter options for posts (live loader).
 */
export type PostFilter = WordPressLiveFilter<PostsFilter>;

/**
 * Filter options for pages (live loader).
 */
export type PageFilter = WordPressLiveFilter<PagesFilter>;

/**
 * Filter options for media (live loader).
 */
export type MediaFilter = WordPressLiveFilter<ClientMediaFilter>;

/**
 * Filter options for categories/taxonomies (live loader).
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type CategoryFilter = ExtensibleFilter<CategoriesFilter> &
  LoaderEntryLookup & {
    /** Legacy field kept for backward compatibility. */
    hide_empty?: boolean;
  };

/**
 * Filter options for tags (live loader).
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type TagFilter = ExtensibleFilter<TagsFilter> &
  LoaderEntryLookup & {
    /** Legacy field kept for backward compatibility. */
    hide_empty?: boolean;
  };

/**
 * Filter options for generic term resources (custom taxonomies).
 * Uses `ExtensibleFilter<CategoriesFilter>` so it satisfies the index signature
 * required by the generic `client.terms(string)` overload without casting.
 * Adds `hide_empty` for backward compatibility.
 */
export type TermFilter = ExtensibleFilter<CategoriesFilter> &
  LoaderEntryLookup & {
    /** @deprecated Use `hideEmpty` instead. */
    hide_empty?: boolean;
  };

/**
 * Options for generic content loaders targeting one REST post resource.
 */
export interface WordPressContentLoaderOptions<
  TEntry = unknown,
  TFilter = unknown,
> extends WordPressEntryMappingOptions<TEntry, TFilter> {
  /** REST resource path (examples: 'posts', 'pages', 'products', 'books') */
  resource: string;
  /** Optional embedded relation loading for live reads. */
  embed?: WordPressEmbedMode;
}

/**
 * Options for generic static content loaders.
 */
export interface WordPressContentStaticLoaderOptions<TEntry = unknown>
  extends WordPressContentLoaderOptions<TEntry> {
  /**
   * Build-time filter forwarded to `listAll()`. Scopes which entries are fetched
   * at build/prerender time. `page` is omitted — `listAll()` handles pagination.
   */
  filter?: StaticLoaderFilter<ExtensibleFilter<PostsFilter>>;
}

/**
 * Options for typed static loaders (posts, pages, media, categories, tags, users).
 * Extends the base entry-mapping options with an optional build-time filter.
 */
export interface WordPressStaticLoaderOptions<TEntry, TFilter>
  extends WordPressEntryMappingOptions<TEntry> {
  /**
   * Build-time filter forwarded to `listAll()`. Scopes which entries are fetched
   * at build/prerender time. `page` is omitted — `listAll()` handles pagination.
   */
  filter?: StaticLoaderFilter<TFilter>;
}

/**
 * Filter options for content resources (custom post types).
 * Uses `ExtensibleFilter<PostsFilter>` so it satisfies the index signature
 * required by the generic `client.content(string)` overload without casting.
 */
export type ContentFilter = WordPressLiveFilter<PostsFilter>;

/**
 * Filter options for users (live loader).
 */
export type UserFilter = ExtensibleFilter<UsersFilter> & LoaderEntryLookup;
