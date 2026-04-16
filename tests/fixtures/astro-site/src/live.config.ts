/**
 * Shared live collection config for the Astro integration fixture.
 *
 * The live collection names are prefixed to avoid colliding with the build-time
 * collections defined in `src/content.config.ts` inside the same fixture app.
 */
import { defineLiveCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import { resolveWpBaseUrl } from '../../../helpers/wp-env';
import {
  wordPressCategoryLoader,
  wordPressContentLoader,
  wordPressPageLoader,
  wordPressPostLoader,
} from '../../../../src/loaders/live';
import {
  booksItemSchema,
  categoriesItemSchema,
  pagesItemSchema,
  postsItemSchema,
} from './generated/wp-schemas';

const baseUrl = resolveWpBaseUrl();
const wp = new WordPressClient({ baseUrl });

/** Live post collection loaded at request time with schema validation. */
const livePosts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postsItemSchema,
});

/** Live page collection loaded at request time with schema validation. */
const livePages = defineLiveCollection({
  loader: wordPressPageLoader(wp),
  schema: pagesItemSchema,
});

/** Live category collection loaded at request time with schema validation. */
const liveCategories = defineLiveCollection({
  loader: wordPressCategoryLoader(wp),
  schema: categoriesItemSchema,
});

/** Live books collection loaded at request time with extended CPT validation. */
const liveBooks = defineLiveCollection({
  loader: wordPressContentLoader(wp, { resource: 'books' }),
  schema: booksItemSchema,
});

export const collections = {
  livePosts,
  livePages,
  liveCategories,
  liveBooks,
};
