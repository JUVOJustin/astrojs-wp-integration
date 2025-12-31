import type { WordPressPage } from '../schemas';

/**
 * Pages API methods
 */
export function createPagesMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>) {
  return {
    /**
     * Gets all pages
     */
    async getPages(params: Record<string, string> = {}): Promise<WordPressPage[]> {
      return fetchAPI<WordPressPage[]>('/pages', {
        per_page: '100',
        _embed: 'true',
        ...params,
      });
    },

    /**
     * Gets a single page by ID
     */
    async getPage(id: number): Promise<WordPressPage> {
      return fetchAPI<WordPressPage>(`/pages/${id}`, { _embed: 'true' });
    },

    /**
     * Gets a single page by slug
     */
    async getPageBySlug(slug: string): Promise<WordPressPage | undefined> {
      const pages = await fetchAPI<WordPressPage[]>('/pages', { slug, _embed: 'true' });
      return pages[0];
    },
  };
}
