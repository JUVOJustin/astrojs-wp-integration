import { z } from 'astro/zod';

/**
 * Base schema shared by all WordPress content types
 * Can be extended with custom fields using .extend() or .merge()
 */
export const baseWordPressSchema = z.object({
  id: z.number(),
  date: z.string(),
  date_gmt: z.string(),
  guid: z.object({
    rendered: z.string(),
  }),
  modified: z.string(),
  modified_gmt: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  link: z.string().url(),
  title: z.object({
    rendered: z.string(),
  }),
  author: z.number(),
  meta: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _links: z.any(),
});

/**
 * Schema for content types (posts and pages)
 * Extend this for custom post types with content fields
 */
export const contentWordPressSchema = baseWordPressSchema.extend({
  content: z.object({
    rendered: z.string(),
    protected: z.boolean(),
  }),
  excerpt: z.object({
    rendered: z.string(),
    protected: z.boolean(),
  }),
  featured_media: z.number().optional(),
  comment_status: z.string(),
  ping_status: z.string(),
  template: z.string(),
  acf: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _embedded: z.any().optional(),
});

/**
 * Default schema for WordPress posts
 * Extend with .extend() to add custom ACF fields or taxonomies
 * 
 * @example
 * const customPostSchema = postSchema.extend({
 *   acf: z.object({
 *     custom_field: z.string().optional(),
 *   }).optional(),
 * });
 */
export const postSchema = contentWordPressSchema.extend({
  sticky: z.boolean(),
  format: z.string(),
  categories: z.array(z.number()).default([]),
  tags: z.array(z.number()).default([]),
});

/**
 * Default schema for WordPress pages
 * Extend with .extend() to add custom ACF fields
 * 
 * @example
 * const customPageSchema = pageSchema.extend({
 *   acf: z.object({
 *     hero_image: z.number().optional(),
 *   }).optional(),
 * });
 */
export const pageSchema = contentWordPressSchema.extend({
  parent: z.number().default(0),
  menu_order: z.number().default(0),
  class_list: z.array(z.string()).default([]),
});

/**
 * Schema for WordPress media items
 */
export const mediaSchema = baseWordPressSchema.extend({
  comment_status: z.string(),
  ping_status: z.string(),
  alt_text: z.string(),
  caption: z.object({
    rendered: z.string(),
  }),
  description: z.object({
    rendered: z.string(),
  }),
  media_type: z.string(),
  mime_type: z.string(),
  media_details: z.object({
    width: z.number(),
    height: z.number(),
    file: z.string(),
    filesize: z.number().optional(),
    sizes: z.record(z.object({
      file: z.string(),
      width: z.number(),
      height: z.number(),
      filesize: z.number().optional(),
      mime_type: z.string(),
      source_url: z.string(),
    })),
    image_meta: z.any(),
  }),
  source_url: z.string(),
});

/**
 * Schema for WordPress categories and taxonomies
 * Extend with .extend() to add custom ACF fields to taxonomies
 * 
 * @example
 * const customCategorySchema = categorySchema.extend({
 *   acf: z.object({
 *     color: z.string().optional(),
 *   }).optional(),
 * });
 */
export const categorySchema = z.object({
  id: z.number(),
  count: z.number(),
  description: z.string(),
  link: z.string().url(),
  name: z.string(),
  slug: z.string(),
  taxonomy: z.string(),
  parent: z.number().default(0),
  meta: z.array(z.any()).or(z.record(z.any())),
  acf: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _embedded: z.any().optional(),
  _links: z.any(),
});

/**
 * Schema for WordPress embedded media (used in _embedded field)
 */
export const embeddedMediaSchema = z.object({
  id: z.number(),
  date: z.string(),
  slug: z.string(),
  type: z.string(),
  link: z.string(),
  title: z.object({
    rendered: z.string(),
  }),
  author: z.number(),
  featured_media: z.number(),
  caption: z.object({
    rendered: z.string(),
  }),
  alt_text: z.string(),
  media_type: z.string(),
  mime_type: z.string(),
  media_details: z.object({
    width: z.number(),
    height: z.number(),
    file: z.string(),
    filesize: z.number().optional(),
    sizes: z.record(z.object({
      file: z.string(),
      width: z.number(),
      height: z.number(),
      filesize: z.number().optional(),
      mime_type: z.string(),
      source_url: z.string(),
    })),
    image_meta: z.any().optional(),
  }),
  source_url: z.string(),
  acf: z.any().optional(),
  _links: z.any().optional(),
});

/**
 * Inferred TypeScript types from Zod schemas
 */
export type WordPressBase = z.infer<typeof baseWordPressSchema>;
export type WordPressContent = z.infer<typeof contentWordPressSchema>;
export type WordPressPost = z.infer<typeof postSchema>;
export type WordPressPage = z.infer<typeof pageSchema>;
export type WordPressMedia = z.infer<typeof mediaSchema>;
export type WordPressCategory = z.infer<typeof categorySchema>;
export type WordPressEmbeddedMedia = z.infer<typeof embeddedMediaSchema>;

/**
 * WordPress Author interface (not using live collections)
 */
export interface WordPressAuthor {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls: {
    [key: string]: string;
  };
  meta: any[];
  _links: any;
}

/**
 * WordPress Tag type (alias for Category)
 */
export type WordPressTag = WordPressCategory;

/**
 * Schema for WordPress site settings (requires authentication)
 */
export const settingsSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url(),
  email: z.string().email().optional(),
  timezone: z.string(),
  date_format: z.string(),
  time_format: z.string(),
  start_of_week: z.number(),
  language: z.string(),
  use_smilies: z.boolean(),
  default_category: z.number(),
  default_post_format: z.string(),
  posts_per_page: z.number(),
  show_on_front: z.string(),
  page_on_front: z.number(),
  page_for_posts: z.number(),
  default_ping_status: z.string(),
  default_comment_status: z.string(),
  site_logo: z.number().nullable().optional(),
  site_icon: z.number().nullable().optional(),
});

export type WordPressSettings = z.infer<typeof settingsSchema>;
