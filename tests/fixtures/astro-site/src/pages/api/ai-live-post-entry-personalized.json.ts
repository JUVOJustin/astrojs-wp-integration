import type { APIRoute } from 'astro';
import { getLiveContentTool } from '../../../../../../src/ai-sdk/index.ts';
import { aiWordPressClient, executeFixtureTool } from '../../lib/ai-tools';

/**
 * Personalized AI tool endpoint that must opt out of Astro route caching.
 */
export const GET: APIRoute = async (context) => {
  const slug = context.url.searchParams.get('slug') ?? 'test-post-001';

  const tool = getLiveContentTool(aiWordPressClient, context.cache, {
    collection: 'livePosts',
    contentType: 'posts',
    personalized: () => {
      return Boolean(context.request.headers.get('cookie'));
    },
  });

  const result = await executeFixtureTool(tool, { slug });

  return Response.json({
    renderToken: `${Date.now()}-${Math.random()}`,
    result,
  });
};
