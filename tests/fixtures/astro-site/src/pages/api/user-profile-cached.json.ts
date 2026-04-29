import type { APIRoute } from 'astro';
import { WordPressClient } from 'fluent-wp-client';

const baseUrl = import.meta.env.WP_BASE_URL ?? 'http://localhost:8888';

/**
 * User-profile endpoint that does NOT opt out of Astro route caching.
 *
 * This fixture intentionally demonstrates the leak risk: without
 * `context.cache.set(false)` (or our AI SDK `personalized` flag), Astro
 * caches the first rendered response by URL and serves it to every
 * subsequent visitor regardless of auth state.
 */
export const GET: APIRoute = async (context) => {
  const authHeader = context.request.headers.get('x-test-auth');

  if (!authHeader) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = new WordPressClient({
    baseUrl,
    auth: { token: authHeader.replace('Bearer ', '') },
  });

  const user = await client.users().me();

  // Intentionally enable route caching without personalization guards
  context.cache.set({ maxAge: 300 });

  return Response.json({
    renderToken: `${Date.now()}-${Math.random()}`,
    user: {
      id: user.id,
      slug: user.slug,
      email: user.email,
      name: user.name,
    },
  });
};
