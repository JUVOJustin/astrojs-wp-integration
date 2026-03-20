/**
 * Shared live collection config for the Astro integration fixture.
 *
 * The live collection names are prefixed to avoid colliding with the build-time
 * collections defined in `src/content.config.ts` inside the same fixture app.
 */
import { defineLiveCollection } from 'astro:content';
import {
  wordPressCategoryLoader,
  wordPressContentLoader,
  wordPressPageLoader,
  wordPressPostLoader,
} from '../../../../src/loaders/live';
import {
  bookSchema,
  categorySchema,
  pageSchema,
  postSchema,
} from './collection-schemas';

const baseUrl = process.env.WP_BASE_URL ?? 'http://localhost:8888';

/** Live post collection loaded at request time with schema validation. */
const livePosts = defineLiveCollection({
  loader: wordPressPostLoader({ baseUrl }),
  schema: postSchema,
});

/** Live page collection loaded at request time with schema validation. */
const livePages = defineLiveCollection({
  loader: wordPressPageLoader({ baseUrl }),
  schema: pageSchema,
});

/** Live category collection loaded at request time with schema validation. */
const liveCategories = defineLiveCollection({
  loader: wordPressCategoryLoader({ baseUrl }),
  schema: categorySchema,
});

/** Live books collection loaded at request time with extended CPT validation. */
const liveBooks = defineLiveCollection({
  loader: wordPressContentLoader({ baseUrl, resource: 'books' }),
  schema: bookSchema,
});

export const collections = {
  livePosts,
  livePages,
  liveCategories,
  liveBooks,
};
