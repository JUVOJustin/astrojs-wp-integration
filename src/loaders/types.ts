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
 * Filter options for posts (live loader)
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
 * Filter options for pages (live loader)
 */
export interface PageFilter {
  id?: number;
  slug?: string;
  status?: string;
}

/**
 * Filter options for media (live loader)
 * Named differently from client MediaFilter to avoid collision
 */
export interface MediaFilter {
  id?: number;
  slug?: string;
}

/**
 * Filter options for categories/taxonomies (live loader)
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

/**
 * Filter options for users (live loader)
 */
export interface UserFilter {
  id?: number;
  slug?: string;
  roles?: string[];
  orderby?: 'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date';
  order?: 'asc' | 'desc';
}
