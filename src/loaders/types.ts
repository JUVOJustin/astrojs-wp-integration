/**
 * Type definitions for WordPress loaders.
 */

import type {
  CategoriesFilter,
  PagesFilter,
  PostsFilter,
  QueryParams,
  UsersFilter,
  MediaFilter as ClientMediaFilter,
  TagsFilter,
} from 'fluent-wp-client';

/**
 * Optional embed configuration forwarded to fluent-wp-client content reads.
 */
export type WordPressEmbedMode = boolean | string[];

/**
 * Options shared by live loaders that read post-like content resources.
 */
export interface WordPressLiveContentLoaderOptions {
  /**
   * Requests embedded relations for collection and entry reads.
   * Leave unset for the lean default payload.
   */
  embed?: WordPressEmbedMode;
}

/**
 * Options for generic taxonomy loaders targeting one REST term resource.
 */
export interface WordPressTermLoaderOptions {
  /** REST resource path (examples: 'categories', 'tags', 'genres') */
  resource: string;
}

/**
 * Options for generic static taxonomy loaders.
 */
export interface WordPressTermStaticLoaderOptions extends WordPressTermLoaderOptions {}

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
export type CategoryFilter = CategoriesFilter & LoaderEntryLookup & {
  /** Legacy field kept for backward compatibility. */
  hide_empty?: boolean;
};

/**
 * Filter options for tags (live loader).
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type TagFilter = TagsFilter & LoaderEntryLookup & {
  /** Legacy field kept for backward compatibility. */
  hide_empty?: boolean;
};

/**
 * Filter options for generic term resources (custom taxonomies).
 */
export type TermFilter = QueryParams & LoaderEntryLookup & {
  hideEmpty?: boolean;
  hide_empty?: boolean;
};

/**
 * Options for generic content loaders targeting one REST post resource.
 */
export interface WordPressContentLoaderOptions {
  /** REST resource path (examples: 'posts', 'pages', 'products', 'books') */
  resource: string;
  /** Optional embedded relation loading for live reads. */
  embed?: WordPressEmbedMode;
}

/**
 * Options for generic static content loaders.
 */
export interface WordPressContentStaticLoaderOptions extends WordPressContentLoaderOptions {}

/**
 * Filter options for content resources (custom post types).
 */
export type ContentFilter = PostsFilter & LoaderEntryLookup;

/**
 * Filter options for users (live loader).
 */
export type UserFilter = UsersFilter & LoaderEntryLookup;
