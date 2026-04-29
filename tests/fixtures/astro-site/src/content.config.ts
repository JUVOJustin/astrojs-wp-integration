/**
 * Shared content config for build and action integration fixtures.
 *
 * Build tests use these static collections to verify end-to-end content loading.
 */
import { defineCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import {
  wordPressCategoryStaticLoader,
  wordPressContentStaticLoader,
  wordPressPageStaticLoader,
  wordPressPostStaticLoader,
} from '../../../../src/loaders/static';
import { resolveWpBaseUrl } from '../../../helpers/wp-env';
import {
  booksItemSchema,
  categoriesItemSchema,
  pagesItemSchema,
  postsItemSchema,
} from './generated/wp-schemas';
import { createAcfChoiceLabelMapper } from './lib/acf-choice-label-mapper';

const baseUrl = resolveWpBaseUrl();
const wp = new WordPressClient({ baseUrl });

/** Static post collection loaded at build time with schema validation. */
const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
  schema: postsItemSchema,
});

/**
 * Static post collection with ACF choice label mapping.
 *
 * Demonstrates end-to-end mapping of dropdown values to human-readable labels
 * by calling the live WordPress REST API endpoint registered by the test
 * mu-plugin (`/wp-json/wp-astrojs-integration/v1/acf-choices`).
 */
const mappedPosts = defineCollection({
  loader: wordPressPostStaticLoader(wp, {
    mapEntry: createAcfChoiceLabelMapper(baseUrl),
  }),
  schema: postsItemSchema,
});

/** Static page collection loaded at build time with schema validation. */
const pages = defineCollection({
  loader: wordPressPageStaticLoader(wp),
  schema: pagesItemSchema,
});

/** Static category collection loaded at build time with schema validation. */
const categories = defineCollection({
  loader: wordPressCategoryStaticLoader(wp),
  schema: categoriesItemSchema,
});

/** Static CPT (books) collection loaded at build time with extended schema validation. */
const books = defineCollection({
  loader: wordPressContentStaticLoader(wp, { resource: 'books' }),
  schema: booksItemSchema,
});

export const collections = { posts, mappedPosts, pages, categories, books };
