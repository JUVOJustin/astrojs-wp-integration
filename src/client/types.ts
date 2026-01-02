/**
 * Shared type definitions for WordPress client
 */

/**
 * Pagination options for list endpoints
 */
export interface PaginationParams {
  /** Number of items per page (default: 100, max: 100) */
  perPage?: number;
  /** Page number (1-indexed) */
  page?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
}

/**
 * Filter options for posts
 */
export interface PostsFilter extends PaginationParams {
  /** Filter by status (publish, draft, pending, private, future, trash) */
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
  /** Filter by category IDs */
  categories?: number[];
  /** Exclude category IDs */
  categoriesExclude?: number[];
  /** Filter by tag IDs */
  tags?: number[];
  /** Exclude tag IDs */
  tagsExclude?: number[];
  /** Filter by author ID */
  author?: number;
  /** Exclude author IDs */
  authorExclude?: number[];
  /** Search term */
  search?: string;
  /** Filter posts after this date (ISO 8601) */
  after?: string;
  /** Filter posts before this date (ISO 8601) */
  before?: string;
  /** Only sticky posts */
  sticky?: boolean;
  /** Order by field */
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Filter options for pages
 */
export interface PagesFilter extends PaginationParams {
  /** Filter by status */
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
  /** Filter by parent page ID */
  parent?: number;
  /** Exclude parent page IDs */
  parentExclude?: number[];
  /** Filter by author ID */
  author?: number;
  /** Exclude author IDs */
  authorExclude?: number[];
  /** Search term */
  search?: string;
  /** Filter pages after this date (ISO 8601) */
  after?: string;
  /** Filter pages before this date (ISO 8601) */
  before?: string;
  /** Order by field */
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include' | 'menu_order';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Filter options for media
 */
export interface MediaFilter extends PaginationParams {
  /** Filter by media type */
  mediaType?: 'image' | 'video' | 'audio' | 'application';
  /** Filter by MIME type */
  mimeType?: string;
  /** Filter by author ID */
  author?: number;
  /** Exclude author IDs */
  authorExclude?: number[];
  /** Filter by parent post ID */
  parent?: number;
  /** Search term */
  search?: string;
  /** Filter media after this date (ISO 8601) */
  after?: string;
  /** Filter media before this date (ISO 8601) */
  before?: string;
  /** Order by field */
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Filter options for categories
 */
export interface CategoriesFilter extends PaginationParams {
  /** Hide empty categories */
  hideEmpty?: boolean;
  /** Filter by parent category ID (0 for top-level) */
  parent?: number;
  /** Exclude category IDs */
  exclude?: number[];
  /** Only include these category IDs */
  include?: number[];
  /** Search term */
  search?: string;
  /** Order by field */
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Filter options for tags
 */
export interface TagsFilter extends PaginationParams {
  /** Hide empty tags */
  hideEmpty?: boolean;
  /** Exclude tag IDs */
  exclude?: number[];
  /** Only include these tag IDs */
  include?: number[];
  /** Search term */
  search?: string;
  /** Order by field */
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Filter options for users
 */
export interface UsersFilter extends PaginationParams {
  /** Filter by role */
  roles?: string[];
  /** Exclude user IDs */
  exclude?: number[];
  /** Only include these user IDs */
  include?: number[];
  /** Search term */
  search?: string;
  /** Order by field */
  orderby?: 'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date' | 'include';
  /** Order direction */
  order?: 'asc' | 'desc';
}

/**
 * Converts filter object to WordPress API query params
 * Accepts any filter type and converts camelCase keys to snake_case
 */
export function filterToParams<T extends Record<string, unknown>>(filter: T): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;

    // Convert camelCase to snake_case for WordPress API
    const apiKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

    if (Array.isArray(value)) {
      params[apiKey] = value.join(',');
    } else if (typeof value === 'boolean') {
      params[apiKey] = value ? 'true' : 'false';
    } else if (typeof value === 'number') {
      params[apiKey] = String(value);
    } else {
      params[apiKey] = String(value);
    }
  }

  // Handle special cases
  if (params.per_page === undefined) {
    params.per_page = '100';
  }

  return params;
}
