/**
 * Minimal Astro content config exercising static and live loaders.
 * 
 * This fixture tests the full WordPress integration:
 * - Static loaders (posts, pages, categories) for build-time content
 * - Live loaders (posts with auth) for runtime content
 * - Middleware/auth bridge for session management
 * - Actions for creating content
 */
import { defineCollection } from 'astro:content';
import {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressCategoryStaticLoader,
} from '../../../../../src/loaders/static';

const baseUrl = process.env.WP_BASE_URL ?? 'http://localhost:8888';

/** Static post collection loaded at build time. */
const posts = defineCollection({
  loader: wordPressPostStaticLoader({ baseUrl }),
});

/** Static page collection loaded at build time. */
const pages = defineCollection({
  loader: wordPressPageStaticLoader({ baseUrl }),
});

/** Static category collection loaded at build time. */
const categories = defineCollection({
  loader: wordPressCategoryStaticLoader({ baseUrl }),
});

export const collections = { posts, pages, categories };
