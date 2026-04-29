import type { APIRoute } from 'astro';
import { WordPressClient } from 'fluent-wp-client';

const baseUrl = import.meta.env.WP_BASE_URL ?? 'http://localhost:8888';

/**
 * Personalized user-profile endpoint that explicitly opts out of Astro
 * route caching so user-specific data is never served to another visitor.
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

  // Opt out of route caching — this is the key isolation guard
  context.cache.set(false);

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
