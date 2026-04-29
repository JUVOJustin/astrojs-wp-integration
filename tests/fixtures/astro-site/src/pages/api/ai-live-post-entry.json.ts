import type { APIRoute } from 'astro';
import { getLiveContentTool } from '../../../../../../src/ai-sdk/index.ts';
import { aiWordPressClient, executeFixtureTool } from '../../lib/ai-tools';

/**
 * Cached AI tool endpoint backed by one live entry read.
 */
export const GET: APIRoute = async (context) => {
  const slug = context.url.searchParams.get('slug') ?? 'test-post-001';

  const tool = getLiveContentTool(aiWordPressClient, context.cache, {
    collection: 'livePosts',
    contentType: 'posts',
  });

  const result = await executeFixtureTool(tool, { slug });
  context.cache.set({ maxAge: 300, swr: 60 });

  return Response.json({
    renderToken: `${Date.now()}-${Math.random()}`,
    result,
  });
};
