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
 * Matches ACF field names as exposed in REST API (acf_* prefix).
 */
const bookSchema = postSchema.extend({
  acf: z.object({
    acf_subtitle: z.string().optional(),
    acf_summary: z.string().optional(),
    acf_priority_score: z.number().optional(),
    acf_external_url: z.string().url().optional(),
    acf_related_posts: z.array(z.any()).optional(),
    acf_featured_post: z.any().optional(),
  }).optional(),
});

/** Static CPT (books) collection loaded at build time with extended schema validation. */
const books = defineCollection({
  loader: wordPressContentStaticLoader({ baseUrl, resource: 'books' }),
  schema: bookSchema,
});

export const collections = { posts, pages, categories, books };
