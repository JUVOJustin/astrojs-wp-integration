import type { WordPressPost } from '../schemas';
import type { FetchResult } from './index';
import type { PostsFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

export function createCustomPostMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  postTypePath: string
) {
  const basePath = `/${postTypePath.replace(/^\//, '')}`;
  
  return {
    async getItems(filter: PostsFilter = {}): Promise<WordPressPost[]> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      return fetchAPI<WordPressPost[]>(basePath, params);
    },
    async getAllItems(filter: Omit<PostsFilter, 'page'> = {}): Promise<WordPressPost[]> {
      const allItems: WordPressPost[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
        const result = await fetchAPIPaginated<WordPressPost[]>(basePath, params);
        allItems.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allItems;
    },
    async getItemsPaginated(filter: PostsFilter = {}): Promise<PaginatedResponse<WordPressPost>> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      const result = await fetchAPIPaginated<WordPressPost[]>(basePath, params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },
    async getItem(id: number): Promise<WordPressPost> {
      return fetchAPI<WordPressPost>(`${basePath}/${id}`, { _embed: 'true' });
    },
    async getItemBySlug(slug: string): Promise<WordPressPost | undefined> {
      const items = await fetchAPI<WordPressPost[]>(basePath, { slug, _embed: 'true' });
      return items[0];
    },
  };
}
