/**
 * Shared live collection config for the Astro integration fixture.
 *
 * The live collection names are prefixed to avoid colliding with the build-time
 * collections defined in `src/content.config.ts` inside the same fixture app.
 */
import { defineLiveCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import {
  wordPressCategoryLoader,
  wordPressContentLoader,
  wordPressPageLoader,
  wordPressPostLoader,
} from '../../../../src/loaders/live';
import { resolveWpBaseUrl } from '../../../helpers/wp-env';
import {
  booksItemSchema,
  categoriesItemSchema,
  pagesItemSchema,
  postsItemSchema,
} from './generated/wp-schemas';
import { createAcfChoiceLabelMapper } from './lib/acf-choice-label-mapper';
import { trackedWordPressFetch } from './lib/wp-fetch-metrics';

const baseUrl = resolveWpBaseUrl();
const wp = new WordPressClient({
  baseUrl,
  fetch:
    process.env.ASTRO_TEST_ROUTE_CACHE === '1' ? trackedWordPressFetch : fetch,
});
const mapAcfChoiceLabels = createAcfChoiceLabelMapper(baseUrl);

/** Live post collection loaded at request time with schema validation. */
const livePosts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postsItemSchema,
});

/** Live post collection using the same reusable mapper actions can use. */
const liveMappedPosts = defineLiveCollection({
  loader: wordPressPostLoader(wp, {
    mapEntry: mapAcfChoiceLabels,
  }),
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
  liveMappedPosts,
  livePages,
  liveCategories,
  liveBooks,
};
