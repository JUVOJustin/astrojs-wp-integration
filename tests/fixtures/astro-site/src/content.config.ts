/**
 * Shared content config for build and action integration fixtures.
 *
 * Build tests use these static collections to verify end-to-end content loading.
 */
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressContentStaticLoader,
} from '../../../../src/loaders/static';
import {
  postSchema,
  pageSchema,
  categorySchema,
} from '../../../../src/index';

const baseUrl = process.env.WP_BASE_URL ?? 'http://localhost:8888';

/** Static post collection loaded at build time with schema validation. */
const posts = defineCollection({
  loader: wordPressPostStaticLoader({ baseUrl }),
  schema: postSchema,
});

/** Static page collection loaded at build time with schema validation. */
const pages = defineCollection({
  loader: wordPressPageStaticLoader({ baseUrl }),
  schema: pageSchema,
});

/** Static category collection loaded at build time with schema validation. */
const categories = defineCollection({
  loader: wordPressCategoryStaticLoader({ baseUrl }),
  schema: categorySchema,
});

/**
 * Extended schema for Books CPT with ACF field validation.
 * Tests CPT-specific schema extension capabilities.
 */
const bookSchema = postSchema.extend({
  acf: z.object({
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    priority_score: z.number().optional(),
    external_url: z.string().url().optional(),
    related_posts: z.array(z.any()).optional(),
    featured_post: z.any().optional(),
  }).optional(),
});

/** Static CPT (books) collection loaded at build time with extended schema validation. */
const books = defineCollection({
  loader: wordPressContentStaticLoader({ baseUrl, resource: 'books' }),
  schema: bookSchema,
});

export const collections = { posts, pages, categories, books };
