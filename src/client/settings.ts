import type { WordPressSettings } from '../schemas';

/**
 * Settings API methods
 */
export function createSettingsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  hasAuth: () => boolean
) {
  return {
    /**
     * Gets WordPress site settings (requires authentication)
     * 
     * @returns Site settings including title, description, URL, etc.
     * @throws Error if authentication is not configured
     */
    async getSettings(): Promise<WordPressSettings> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
      }
      return fetchAPI<WordPressSettings>('/settings');
    },
  };
}
