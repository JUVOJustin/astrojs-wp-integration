/**
 * Type definitions for WordPress loaders
 */

import type { 
  WordPressClientConfig,
  PostsFilter,
  PagesFilter,
  MediaFilter as ClientMediaFilter,
  CategoriesFilter,
  TagsFilter,
  QueryParams,
  UsersFilter 
} from 'fluent-wp-client';
import type { WordPressLoaderBlocksOption } from '../blocks';

/**
 * Configuration for WordPress loaders
 */
export interface WordPressLoaderConfig extends Pick<
  WordPressClientConfig,
  'baseUrl' | 'auth' | 'authHeader' | 'authHeaders' | 'cookies'
> {
  /** Enables Gutenberg block parsing from raw content (requires auth). */
  blocks?: WordPressLoaderBlocksOption;
}

/**
 * Configuration for static WordPress loaders (build-time only)
 */
export interface WordPressStaticLoaderConfig extends WordPressLoaderConfig {
  /** Number of items per page (default: 100) */
  perPage?: number;
  /** Additional query parameters */
  params?: Record<string, string>;
}

/**
 * Configuration for generic static content loaders.
 */
export interface WordPressContentStaticLoaderConfig extends WordPressStaticLoaderConfig {
  /** REST resource path (examples: 'posts', 'pages', 'books') */
  resource: string;
}

/**
 * Configuration for generic taxonomy loaders targeting one REST term resource.
 */
export interface WordPressTermLoaderConfig extends WordPressLoaderConfig {
  /** REST resource path (examples: 'categories', 'tags', 'genres') */
  resource: string;
}

/**
 * Configuration for generic post-like resource loaders.
 */
export interface WordPressContentLoaderConfig extends WordPressLoaderConfig {
  /** REST resource path (examples: 'posts', 'pages', 'books') */
  resource: string;
}

/**
 * Configuration for generic static taxonomy loaders.
 */
export interface WordPressTermStaticLoaderConfig extends WordPressStaticLoaderConfig {
  /** REST resource path (examples: 'categories', 'tags', 'genres') */
  resource: string;
}

/**
 * Base filter shape for loader entry lookup by ID or slug.
 * Used alongside fluent-wp-client filter types.
 */
export interface LoaderEntryLookup {
  /** WordPress entity ID */
  id?: number;
  /** WordPress entity slug */
  slug?: string;
}

/**
 * Filter options for posts (live loader).
 * Based on fluent-wp-client PostsFilter with entry lookup extensions.
 */
export type PostFilter = PostsFilter & LoaderEntryLookup;

/**
 * Filter options for pages (live loader).
 * Based on fluent-wp-client PagesFilter with entry lookup extensions.
 */
export type PageFilter = PagesFilter & LoaderEntryLookup;

/**
 * Filter options for media (live loader).
 * Based on fluent-wp-client MediaFilter with entry lookup extensions.
 */
export type MediaFilter = ClientMediaFilter & LoaderEntryLookup;

/**
 * Filter options for categories/taxonomies (live loader).
 * Based on fluent-wp-client CategoriesFilter with entry lookup extensions.
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type CategoryFilter = CategoriesFilter & LoaderEntryLookup & {
  /** Legacy field, will be deprecated in favor of hideEmpty */
  hide_empty?: boolean;
};

/**
 * Filter options for tags (live loader).
 * Based on fluent-wp-client TagsFilter with entry lookup extensions.
 * @deprecated Use 'hideEmpty' instead of 'hide_empty' (kept for backward compatibility)
 */
export type TagFilter = TagsFilter & LoaderEntryLookup & {
  /** Legacy field, will be deprecated in favor of hideEmpty */
  hide_empty?: boolean;
};

/**
 * Filter options for generic term resources (custom taxonomies).
 * Supports the common term query keys with passthrough params.
 */
export type TermFilter = QueryParams & LoaderEntryLookup & {
  hideEmpty?: boolean;
  hide_empty?: boolean;
};

/**
 * Filter options for users (live loader).
 * Based on fluent-wp-client UsersFilter with entry lookup extensions.
 */
export type UserFilter = UsersFilter & LoaderEntryLookup;

/**
 * Filter options for generic content resources (custom post types).
 */
export type ContentFilter = QueryParams & LoaderEntryLookup;
