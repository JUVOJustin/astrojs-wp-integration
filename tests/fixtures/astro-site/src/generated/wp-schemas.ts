/**
 * Fixture-local schema module that mirrors the shape of CLI-generated schemas.
 *
 * The integration fixture uses this file as the first-class reference workflow
 * for typed collections without depending on a generated file
 * checked into the package root.
 */
import { z } from 'astro/zod';
import {
  categorySchema,
  contentWordPressSchema,
  pageSchema,
  postSchema,
} from 'fluent-wp-client/zod';

export const postsItemSchema = postSchema;

export const pagesItemSchema = pageSchema;

export const categoriesItemSchema = categorySchema;

/**
 * Books use the generic content schema because the CPT endpoint omits post-only
 * fields such as `sticky` and `format`.
 */
export const booksItemSchema = contentWordPressSchema.extend({
  acf: z
    .object({
      acf_subtitle: z.string().nullable().optional(),
      acf_summary: z.string().nullable().optional(),
      acf_priority_score: z.preprocess(
        (value) => (value === '' ? null : value),
        z.number().nullable().optional()
      ),
      acf_external_url: z.preprocess(
        (value) => (value === '' ? null : value),
        z.string().url().nullable().optional()
      ),
      acf_related_posts: z.array(z.any()).nullable().optional(),
      acf_featured_post: z.any().nullable().optional(),
    })
    .optional(),
});
