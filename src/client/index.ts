import type {
  WordPressPost,
  WordPressPage,
  WordPressMedia,
  WordPressCategory,
  WordPressTag,
  WordPressAuthor,
} from '../schemas';

/**
 * WordPress API Client
 * Provides direct access to WordPress REST API endpoints
 * Used internally by loaders and available for runtime data fetching
 */
export class WordPressClient {
  private baseUrl: string;
  private apiBase: string;

  /**
   * Creates a WordPress API client
   * 
   * @param baseUrl - WordPress site URL (e.g., 'https://example.com')
   * 
   * @example
   * const wp = new WordPressClient('https://example.com');
   * const posts = await wp.getPosts();
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.apiBase = `${baseUrl}/index.php?rest_route=/wp/v2`;
  }

  /**
   * Fetches data from WordPress REST API
   */
  async fetchAPI<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const startTime = performance.now();
    const url = new URL(`${this.apiBase}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Math.round(performance.now() - startTime);
    console.log(`[WP API] ${endpoint} - ${duration}ms - params:`, JSON.stringify(params));

    return data;
  }

  /**
   * Gets all posts
   */
  async getPosts(params: Record<string, string> = {}): Promise<WordPressPost[]> {
    return this.fetchAPI<WordPressPost[]>('/posts', {
      per_page: '100',
      _embed: 'true',
      ...params,
    });
  }

  /**
   * Gets a single post by ID
   */
  async getPost(id: number): Promise<WordPressPost> {
    return this.fetchAPI<WordPressPost>(`/posts/${id}`, { _embed: 'true' });
  }

  /**
   * Gets a single post by slug
   */
  async getPostBySlug(slug: string): Promise<WordPressPost | undefined> {
    const posts = await this.fetchAPI<WordPressPost[]>('/posts', { slug, _embed: 'true' });
    return posts[0];
  }

  /**
   * Gets all pages
   */
  async getPages(params: Record<string, string> = {}): Promise<WordPressPage[]> {
    return this.fetchAPI<WordPressPage[]>('/pages', {
      per_page: '100',
      _embed: 'true',
      ...params,
    });
  }

  /**
   * Gets a single page by ID
   */
  async getPage(id: number): Promise<WordPressPage> {
    return this.fetchAPI<WordPressPage>(`/pages/${id}`, { _embed: 'true' });
  }

  /**
   * Gets a single page by slug
   */
  async getPageBySlug(slug: string): Promise<WordPressPage | undefined> {
    const pages = await this.fetchAPI<WordPressPage[]>('/pages', { slug, _embed: 'true' });
    return pages[0];
  }

  /**
   * Gets all media items
   */
  async getMedia(params: Record<string, string> = {}): Promise<WordPressMedia[]> {
    return this.fetchAPI<WordPressMedia[]>('/media', { per_page: '100', ...params });
  }

  /**
   * Gets a single media item by ID
   */
  async getMediaItem(id: number): Promise<WordPressMedia> {
    return this.fetchAPI<WordPressMedia>(`/media/${id}`);
  }

  /**
   * Gets a single media item by slug
   */
  async getMediaBySlug(slug: string): Promise<WordPressMedia | undefined> {
    const media = await this.fetchAPI<WordPressMedia[]>('/media', { slug });
    return media[0];
  }

  /**
   * Gets all categories
   */
  async getCategories(params: Record<string, string> = {}): Promise<WordPressCategory[]> {
    return this.fetchAPI<WordPressCategory[]>('/categories', { per_page: '100', ...params });
  }

  /**
   * Gets a single category by ID
   */
  async getCategory(id: number): Promise<WordPressCategory> {
    return this.fetchAPI<WordPressCategory>(`/categories/${id}`);
  }

  /**
   * Gets a single category by slug
   */
  async getCategoryBySlug(slug: string): Promise<WordPressCategory | undefined> {
    const categories = await this.fetchAPI<WordPressCategory[]>('/categories', { slug });
    return categories[0];
  }

  /**
   * Gets all tags
   */
  async getTags(params: Record<string, string> = {}): Promise<WordPressTag[]> {
    return this.fetchAPI<WordPressTag[]>('/tags', { per_page: '100', ...params });
  }

  /**
   * Gets a single tag by ID
   */
  async getTag(id: number): Promise<WordPressTag> {
    return this.fetchAPI<WordPressTag>(`/tags/${id}`);
  }

  /**
   * Gets a single tag by slug
   */
  async getTagBySlug(slug: string): Promise<WordPressTag | undefined> {
    const tags = await this.fetchAPI<WordPressTag[]>('/tags', { slug });
    return tags[0];
  }

  /**
   * Gets all authors/users
   */
  async getAuthors(params: Record<string, string> = {}): Promise<WordPressAuthor[]> {
    return this.fetchAPI<WordPressAuthor[]>('/users', { per_page: '100', ...params });
  }

  /**
   * Gets a single author by ID
   */
  async getAuthor(id: number): Promise<WordPressAuthor> {
    return this.fetchAPI<WordPressAuthor>(`/users/${id}`);
  }

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
  }
}

/**
 * Creates a WordPress client instance
 * @deprecated Use `new WordPressClient(baseUrl)` instead
 */
export function createWordPressClient(baseUrl: string): WordPressClient {
  return new WordPressClient(baseUrl);
}
