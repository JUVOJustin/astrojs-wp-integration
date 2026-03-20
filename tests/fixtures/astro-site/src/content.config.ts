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

const baseUrl = process.env.WP_BASE_URL ?? 'http://localhost:8888';
const wp = new WordPressClient({ baseUrl });

/** Static post collection loaded at build time. */
const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
});

/** Static page collection loaded at build time. */
const pages = defineCollection({
  loader: wordPressPageStaticLoader(wp),
});

/** Static category collection loaded at build time. */
const categories = defineCollection({
  loader: wordPressCategoryStaticLoader(wp),
});

/** Static CPT (books) collection loaded at build time. */
const books = defineCollection({
  loader: wordPressContentStaticLoader(wp, { resource: 'books' }),
});

export const collections = { posts, pages, categories, books };
