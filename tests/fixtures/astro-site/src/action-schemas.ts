import { z } from 'astro/zod';

import {
  createPostInputSchema,
  createTermInputSchema,
  updatePostInputSchema,
  updateTermInputSchema,
} from '../../../../src/actions';

export const postsCreateSchema = createPostInputSchema;
export const postsUpdateSchema = updatePostInputSchema;
export const pagesCreateSchema = createPostInputSchema;
export const pagesUpdateSchema = updatePostInputSchema;
export const categoriesCreateSchema = createTermInputSchema;
export const categoriesUpdateSchema = updateTermInputSchema;

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
