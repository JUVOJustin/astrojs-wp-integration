import type { WordPressAuthor } from '../schemas';
import type { FetchResult } from './index';
import type { UsersFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Users API methods factory
 * Creates type-safe methods for fetching WordPress users with filtering and pagination
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  hasAuth: () => boolean
) {
  return {
    /**
     * Gets users with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (roles, include, exclude, search, etc.)
     * @returns Array of users matching the filter criteria
     */
    async getUsers(filter: UsersFilter = {}): Promise<WordPressAuthor[]> {
      const params = filterToParams(filter as Record<string, unknown>);
      return fetchAPI<WordPressAuthor[]>('/users', params);
    },

    /**
     * Gets ALL users by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (roles, include, exclude, search, etc.)
     * @returns Array of all users matching the filter criteria
     */
    async getAllUsers(filter: Omit<UsersFilter, 'page'> = {}): Promise<WordPressAuthor[]> {
      const allUsers: WordPressAuthor[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 } as Record<string, unknown>);
        const result = await fetchAPIPaginated<WordPressAuthor[]>('/users', params);
        allUsers.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allUsers;
    },

    /**
     * Gets users with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with users and total counts
     */
    async getUsersPaginated(filter: UsersFilter = {}): Promise<PaginatedResponse<WordPressAuthor>> {
      const params = filterToParams(filter as Record<string, unknown>);
      const result = await fetchAPIPaginated<WordPressAuthor[]>('/users', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },

    /**
     * Gets a single user by ID
     */
    async getUser(id: number): Promise<WordPressAuthor> {
      return fetchAPI<WordPressAuthor>(`/users/${id}`);
    },

    /**
     * Gets the currently authenticated user
     * Requires authentication to be configured
     * 
     * @throws Error if authentication is not configured or user is not authenticated
     */
    async getCurrentUser(): Promise<WordPressAuthor> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
      }
      return fetchAPI<WordPressAuthor>('/users/me');
    }
  };
}
