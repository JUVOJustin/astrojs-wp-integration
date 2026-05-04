/**
 * Fixture-local schema module that mirrors the shape of CLI-generated schemas.
 *
 * The integration fixture uses this file as the first-class reference workflow
 * for typed collections and actions without depending on a generated file
 * checked into the package root.
 */
import { z } from 'astro/zod';
import {
  categorySchema,
  contentWordPressSchema,
  pageSchema,
  postSchema,
} from 'fluent-wp-client/zod';
import {
  createPostInputSchema,
  createTermInputSchema,
  updatePostInputSchema,
  updateTermInputSchema,
} from '../../../../../src/actions';

export const postsItemSchema = postSchema;
export const postsCreateSchema = createPostInputSchema;
export const postsUpdateSchema = updatePostInputSchema;

export const pagesItemSchema = pageSchema;
export const pagesCreateSchema = createPostInputSchema;
export const pagesUpdateSchema = updatePostInputSchema;

export const categoriesItemSchema = categorySchema;
export const categoriesCreateSchema = createTermInputSchema;
export const categoriesUpdateSchema = updateTermInputSchema;

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

export const booksCreateSchema = createPostInputSchema.extend({
  acf: z
    .object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  custom_note: z.string().min(3).optional(),
});

export const booksUpdateSchema = updatePostInputSchema.extend({
  acf: z
    .object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  custom_note: z.string().optional(),
});
