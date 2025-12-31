import type { WordPressAuthor } from '../schemas';

/**
 * Users API methods
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  hasAuth: () => boolean
) {
  return {
    /**
     * Gets all users/authors
     */
    async getUsers(params: Record<string, string> = {}): Promise<WordPressAuthor[]> {
      return fetchAPI<WordPressAuthor[]>('/users', { per_page: '100', ...params });
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
