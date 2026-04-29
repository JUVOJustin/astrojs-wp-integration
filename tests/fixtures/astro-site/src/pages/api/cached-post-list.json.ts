import type { APIRoute } from 'astro';
import { getLiveCollection } from 'astro:content';

/**
 * Cached post-list endpoint used to verify collection caching independently from per-entry caching.
 */
export const GET: APIRoute = async (context) => {
  const { entries, error } = await getLiveCollection('livePosts', {
    orderby: 'slug',
    order: 'asc',
    perPage: 20,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  context.cache.set({
    maxAge: 300,
    tags: ['wp:list:posts:20'],
  });

  return Response.json({
    renderToken: `${Date.now()}-${Math.random()}`,
    ids: entries.map((entry) => Number.parseInt(entry.id, 10)),
  });
};
