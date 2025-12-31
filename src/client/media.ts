import type { WordPressMedia } from '../schemas';

/**
 * Media API methods
 */
export function createMediaMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>) {
  return {
    /**
     * Gets all media items
     */
    async getMedia(params: Record<string, string> = {}): Promise<WordPressMedia[]> {
      return fetchAPI<WordPressMedia[]>('/media', { per_page: '100', ...params });
    },

    /**
     * Gets a single media item by ID
     */
    async getMediaItem(id: number): Promise<WordPressMedia> {
      return fetchAPI<WordPressMedia>(`/media/${id}`);
    },

    /**
     * Gets a single media item by slug
     */
    async getMediaBySlug(slug: string): Promise<WordPressMedia | undefined> {
      const media = await fetchAPI<WordPressMedia[]>('/media', { slug });
      return media[0];
    },

    /**
     * Gets the URL for a specific media size
     * 
     * @param media - WordPress media object
     * @param size - Size name (e.g., 'thumbnail', 'medium', 'large', 'full')
     * @returns Image URL for the specified size
     */
    getImageUrl(media: WordPressMedia, size: string = 'full'): string {
      if (size === 'full' || !media.media_details.sizes[size]) {
        return media.source_url;
      }
      return media.media_details.sizes[size].source_url;
    },
  };
}
