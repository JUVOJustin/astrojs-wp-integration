/**
 * Shared collection schemas for the Astro integration fixture.
 *
 * Static and live fixture configs import the same schemas so both paths validate
 * the same WordPress payload shapes.
 */
import { z } from 'astro/zod';
import {
  categorySchema,
  contentWordPressSchema,
  pageSchema,
  postSchema,
} from '../../../../src/index';

export { categorySchema, pageSchema, postSchema };

/**
 * Extends the shared content schema for the seeded Book CPT fields.
 *
 * Books use the generic content schema instead of `postSchema` because the
 * custom post type endpoint does not expose post-only fields such as `sticky`
 * and `format`.
 */
export const bookSchema = contentWordPressSchema.extend({
  acf: z
    .object({
      acf_subtitle: z.string().nullable().optional(),
      acf_summary: z.string().nullable().optional(),
      acf_priority_score: z.preprocess(
        (value) => (value === '' ? null : value),
        z.number().nullable().optional(),
      ),
      acf_external_url: z.preprocess(
        (value) => (value === '' ? null : value),
        z.string().url().nullable().optional(),
      ),
      acf_related_posts: z.array(z.any()).nullable().optional(),
      acf_featured_post: z.any().nullable().optional(),
    })
    .optional(),
});
