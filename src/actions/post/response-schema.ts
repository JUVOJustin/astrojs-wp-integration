import {
  contentWordPressSchema,
  pageSchema,
  postSchema,
  type WordPressContent,
  type WordPressPage,
  type WordPressPost,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
export function getDefaultContentResponseSchema(
  resource: string,
): WordPressStandardSchema<WordPressPost | WordPressPage | WordPressContent> {
  if (resource === 'posts') {
    return postSchema;
  }

  if (resource === 'pages') {
    return pageSchema;
  }

  return contentWordPressSchema;
}
