import type { APIRoute } from 'astro';
import { getLiveContentCollectionTool } from '../../../../../../src/ai-sdk/index.ts';
import { aiWordPressClient, executeFixtureTool } from '../../lib/ai-tools';

/**
 * Cached AI tool endpoint backed by one live collection read.
 */
export const GET: APIRoute = async (context) => {
  const tool = getLiveContentCollectionTool(aiWordPressClient, context.cache, {
    collection: 'livePosts',
    contentType: 'posts',
    fixedArgs: {
      orderby: 'slug',
      order: 'asc',
      perPage: 20,
    },
  });

  const result = await executeFixtureTool(tool, {});
  context.cache.set({ maxAge: 300, swr: 60 });

  return Response.json({
    renderToken: `${Date.now()}-${Math.random()}`,
    result,
  });
};
