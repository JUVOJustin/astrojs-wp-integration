/**
 * Type definitions for WordPress loaders
 */

/**
 * Configuration for WordPress loaders
 */
export interface WordPressLoaderConfig {
  baseUrl: string;
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
 * Filter options for posts
 */
export interface PostFilter {
  id?: number;
  slug?: string;
  status?: string;
  categories?: number[];
  tags?: number[];
  terms?: string;
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance';
  order?: 'asc' | 'desc';
}

/**
 * Filter options for pages
 */
export interface PageFilter {
  id?: number;
  slug?: string;
  status?: string;
}

/**
 * Filter options for media
 */
export interface MediaFilter {
  id?: number;
  slug?: string;
}

/**
 * Filter options for categories/taxonomies
 */
export interface CategoryFilter {
  id?: number;
  slug?: string;
  taxonomy?: string;
  hide_empty?: boolean;
  parent?: number;
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group';
  order?: 'asc' | 'desc';
}
