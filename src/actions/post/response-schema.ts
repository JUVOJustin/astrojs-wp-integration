import {
  contentWordPressSchema,
  pageSchema,
  postSchema,
} from 'fluent-wp-client';
import type {
  WordPressContent,
  WordPressPage,
  WordPressPost,
  WordPressStandardSchema,
} from 'fluent-wp-client';

export function getDefaultContentResponseSchema(
  resource: string
): WordPressStandardSchema<WordPressPost | WordPressPage | WordPressContent> {
  if (resource === 'posts') {
    return postSchema;
  }

  if (resource === 'pages') {
    return pageSchema;
  }

  return contentWordPressSchema;
}
