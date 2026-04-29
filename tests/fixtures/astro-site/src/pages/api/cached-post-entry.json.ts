import type { APIRoute } from 'astro';
import { getLiveEntry } from 'astro:content';

/**
 * Cached per-entry endpoint used to verify that invalidation only refreshes changed posts.
 */
export const GET: APIRoute = async (context) => {
  const idParam = context.url.searchParams.get('id');

  if (!idParam) {
    return Response.json({ error: 'Missing id query param.' }, { status: 400 });
  }

  const id = Number.parseInt(idParam, 10);

  if (!Number.isFinite(id)) {
    return Response.json({ error: 'Invalid id query param.' }, { status: 400 });
  }

  const { entry, error, cacheHint } = await getLiveEntry('livePosts', { id });

  if (error || !entry) {
    return Response.json({ error: error?.message ?? 'Entry not found.' }, { status: 404 });
  }

  if (cacheHint) {
    context.cache.set(cacheHint);
  }

  context.cache.set({ maxAge: 300 });

  return Response.json({
    id,
    title: entry.data.title?.rendered ?? '',
    renderToken: `${Date.now()}-${Math.random()}`,
  });
};
