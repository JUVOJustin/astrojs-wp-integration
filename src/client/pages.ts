import type { WordPressPage } from '../schemas';
import type { FetchResult } from './index';
import type { PagesFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Pages API methods factory
 * Creates type-safe methods for fetching WordPress pages with filtering and pagination
 */
export function createPagesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>
) {
  return {
    /**
     * Gets pages with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (status, parent, author, search, etc.)
     * @returns Array of pages matching the filter criteria
     */
    async getPages(filter: PagesFilter = {}): Promise<WordPressPage[]> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      return fetchAPI<WordPressPage[]>('/pages', params);
    },

    /**
     * Gets ALL pages by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (status, parent, author, search, etc.)
     * @returns Array of all pages matching the filter criteria
     */
    async getAllPages(filter: Omit<PagesFilter, 'page'> = {}): Promise<WordPressPage[]> {
      const allPages: WordPressPage[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
        const result = await fetchAPIPaginated<WordPressPage[]>('/pages', params);
        allPages.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allPages;
    },

    /**
     * Gets pages with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with pages and total counts
     */
    async getPagesPaginated(filter: PagesFilter = {}): Promise<PaginatedResponse<WordPressPage>> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      const result = await fetchAPIPaginated<WordPressPage[]>('/pages', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
