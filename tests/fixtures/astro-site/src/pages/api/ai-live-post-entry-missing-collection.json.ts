import type { APIRoute } from 'astro';
import { getLiveContentTool } from '../../../../../../src/ai-sdk/index.ts';
import { aiWordPressClient, executeFixtureTool } from '../../lib/ai-tools';

/**
 * Error endpoint used to verify missing live collections produce actionable tool errors.
 */
export const GET: APIRoute = async (context) => {
  const tool = getLiveContentTool(aiWordPressClient, context.cache, {
    collection: 'missingLivePosts',
    contentType: 'posts',
  });

  const result = await executeFixtureTool(tool, { slug: 'test-post-001' });

  return Response.json({ result });
};
