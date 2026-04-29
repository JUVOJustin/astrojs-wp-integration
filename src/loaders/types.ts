/**
 * Type definitions for WordPress loaders.
 */

import type {
  CategoriesFilter,
  MediaFilter as ClientMediaFilter,
  PagesFilter,
  PostsFilter,
  QueryParams,
  TagsFilter,
  UsersFilter,
} from 'fluent-wp-client';

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
  extends WordPressTermLoaderOptions<TEntry> {}

/**
 * Base filter shape for loader entry lookup by ID or slug.
 */
export interface LoaderEntryLookup {
  /** WordPress entity ID */
  id?: number;
  /** WordPress entity slug */
  slug?: string;
}

/**
 * Filter options for posts (live loader).
 */
export type PostFilter = PostsFilter & LoaderEntryLookup;

/**
 * Filter options for pages (live loader).
 */
export type PageFilter = PagesFilter & LoaderEntryLookup;

/**
 * Filter options for media (live loader).
 */
export type MediaFilter = ClientMediaFilter & LoaderEntryLookup;

/**
 * Filter options for categories/taxonomies (live loader).
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type CategoryFilter = CategoriesFilter &
  LoaderEntryLookup & {
    /** Legacy field kept for backward compatibility. */
    hide_empty?: boolean;
  };

/**
 * Filter options for tags (live loader).
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type TagFilter = TagsFilter &
  LoaderEntryLookup & {
    /** Legacy field kept for backward compatibility. */
    hide_empty?: boolean;
  };

/**
 * Filter options for generic term resources (custom taxonomies).
 */
export type TermFilter = QueryParams &
  LoaderEntryLookup & {
    hideEmpty?: boolean;
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
  extends WordPressContentLoaderOptions<TEntry> {}

/**
 * Filter options for content resources (custom post types).
 */
export type ContentFilter = PostsFilter & LoaderEntryLookup;

/**
 * Filter options for users (live loader).
 */
export type UserFilter = UsersFilter & LoaderEntryLookup;
