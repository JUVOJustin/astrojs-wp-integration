/**
 * Shared content config for build and action integration fixtures.
 *
 * Build tests use these static collections to verify end-to-end content loading.
 */
import { defineCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressContentStaticLoader,
} from '../../../../src/loaders/static';
import {
  bookSchema,
  categorySchema,
  pageSchema,
  postSchema,
} from './collection-schemas';

const baseUrl = process.env.WP_BASE_URL ?? 'http://localhost:8888';
const wp = new WordPressClient({ baseUrl });

/** Static post collection loaded at build time with schema validation. */
const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
  schema: postSchema,
});

/** Static page collection loaded at build time with schema validation. */
const pages = defineCollection({
  loader: wordPressPageStaticLoader(wp),
  schema: pageSchema,
});

/** Static category collection loaded at build time with schema validation. */
const categories = defineCollection({
  loader: wordPressCategoryStaticLoader(wp),
  schema: categorySchema,
});

/** Static CPT (books) collection loaded at build time with extended schema validation. */
const books = defineCollection({
  loader: wordPressContentStaticLoader(wp, { resource: 'books' }),
  schema: bookSchema,
});

export const collections = { posts, pages, categories, books };
