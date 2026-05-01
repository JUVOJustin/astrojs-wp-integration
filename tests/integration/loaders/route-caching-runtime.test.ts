import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callAction } from '../../helpers/action-client';
import { startAstroPreviewServer } from '../../helpers/astro-preview';
import { request } from '../../helpers/http-client';

type PreviewSession = Awaited<ReturnType<typeof startAstroPreviewServer>>;

type RouteCacheMetrics = {
  collections: Record<string, number>;
  entries: Record<string, number>;
};

type CachedPostListResponse = {
  renderToken: string;
  ids: number[];
};

type CachedPostEntryResponse = {
  id: number;
  title: string;
  renderToken: string;
};

type UserProfileResponse = {
  renderToken: string;
  user: {
    id: number;
    slug: string;
    email: string;
    name: string;
  };
};

/**
 * Extracts one rendered cache token from the fixture page HTML.
 */
function extractRenderToken(html: string): string {
  const match = html.match(/data-render-token="([^"]+)"/);

  if (!match) {
    throw new Error(`Missing data-render-token in response: ${html}`);
  }

  return match[1];
}

/**
 * Extracts one data-* attribute value from the rendered fixture HTML.
 */
function extractDataAttribute(html: string, attribute: string): string {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escaped}="([^"]*)"`));

  if (!match) {
    throw new Error(`Missing ${attribute} in response: ${html}`);
  }

  return match[1];
}

async function getRouteCacheMetrics(
  baseUrl: string,
): Promise<RouteCacheMetrics> {
  return callAction<RouteCacheMetrics>('routeCacheMetricsGet', {}, { baseUrl });
}

async function resetRouteCacheMetrics(
  baseUrl: string,
): Promise<RouteCacheMetrics> {
  return callAction<RouteCacheMetrics>(
    'routeCacheMetricsReset',
    {},
    { baseUrl },
  );
}

async function fetchCachedPostList(
  baseUrl: string,
): Promise<CachedPostListResponse> {
  const response = await request(`${baseUrl}/api/cached-post-list.json`);
  return response.json();
}

async function fetchCachedPostEntry(
  baseUrl: string,
  id: number,
): Promise<CachedPostEntryResponse> {
  const response = await request(
    `${baseUrl}/api/cached-post-entry.json?id=${id}`,
  );
  return response.json();
}

async function fetchUserProfilePersonalized(
  baseUrl: string,
  authHeader: string,
): Promise<Response> {
  return request(`${baseUrl}/api/user-profile-personalized.json`, {
    headers: {
      'X-Test-Auth': authHeader,
    },
  });
}

async function fetchUserProfileCached(
  baseUrl: string,
  authHeader: string,
): Promise<Response> {
  return request(`${baseUrl}/api/user-profile-cached.json`, {
    headers: {
      'X-Test-Auth': authHeader,
    },
  });
}

/**
 * End-to-end route-caching coverage against a production Astro preview server.
 */
describe('Route Caching: Astro preview runtime', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  let previewSession: PreviewSession;

  beforeAll(async () => {
    previewSession = await startAstroPreviewServer();
  });

  afterAll(async () => {
    await previewSession?.stop();
  });

  it('caches live content responses and invalidates them through the content cache action', async () => {
    const firstResponse = await request(
      `${previewSession.baseUrl}/live-cached-book`,
    );
    const firstHtml = await firstResponse.text();
    const firstToken = extractRenderToken(firstHtml);
    const originalTitle = extractDataAttribute(firstHtml, 'data-book-title');
    const originalSubtitle = extractDataAttribute(
      firstHtml,
      'data-book-subtitle',
    );

    const idMatch = firstHtml.match(/data-book-id="(\d+)"/);
    expect(idMatch).not.toBeNull();

    const bookId = Number.parseInt(idMatch![1], 10);
    const updatedTitle = `Route cache title ${Date.now()}`;
    const updatedSubtitle = `Route cache subtitle ${Date.now()}`;

    try {
      const secondResponse = await request(
        `${previewSession.baseUrl}/live-cached-book`,
      );
      const thirdResponse = await request(
        `${previewSession.baseUrl}/live-cached-book`,
      );
      const secondHtml = await secondResponse.text();
      const thirdHtml = await thirdResponse.text();
      const secondToken = extractRenderToken(secondHtml);
      const thirdToken = extractRenderToken(thirdHtml);

      expect(secondToken).toBe(firstToken);
      expect(thirdToken).toBe(firstToken);

      await callAction(
        'updateBook',
        {
          id: bookId,
          title: updatedTitle,
          acf: {
            acf_subtitle: updatedSubtitle,
          },
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      const invalidation = await callAction<{
        invalidated: boolean;
        resource: string;
        tags: string[];
      }>(
        'wpCacheInvalidate',
        {
          id: bookId,
          entity: 'post',
          post_type: 'book',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      expect(invalidation.invalidated).toBe(true);
      expect(invalidation.resource).toBe('books');
      expect(invalidation.tags).toContain(`wp:entry:books:${bookId}`);

      const fourthResponse = await request(
        `${previewSession.baseUrl}/live-cached-book`,
      );
      const fourthHtml = await fourthResponse.text();
      const fifthResponse = await request(
        `${previewSession.baseUrl}/live-cached-book`,
      );
      const fifthHtml = await fifthResponse.text();
      const fourthToken = extractRenderToken(fourthHtml);
      const fifthToken = extractRenderToken(fifthHtml);

      expect(fourthToken).not.toBe(firstToken);
      expect(fourthHtml).toContain(`data-book-title="${updatedTitle}"`);
      expect(fourthHtml).toContain(`data-book-subtitle="${updatedSubtitle}"`);
      expect(fifthToken).toBe(fourthToken);
      expect(fifthHtml).toContain(`data-book-title="${updatedTitle}"`);
    } finally {
      await callAction(
        'updateBook',
        {
          id: bookId,
          title: originalTitle,
          acf: {
            acf_subtitle: originalSubtitle,
          },
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);

      await callAction(
        'wpCacheInvalidate',
        {
          id: bookId,
          entity: 'post',
          post_type: 'book',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);
    }
  });

  it('caches live term responses and invalidates them through the term cache action', async () => {
    const firstResponse = await request(
      `${previewSession.baseUrl}/live-cached-category`,
    );
    const firstHtml = await firstResponse.text();
    const firstToken = extractRenderToken(firstHtml);
    const originalName = extractDataAttribute(firstHtml, 'data-category-name');

    const idMatch = firstHtml.match(/data-category-id="(\d+)"/);
    expect(idMatch).not.toBeNull();

    const categoryId = Number.parseInt(idMatch![1], 10);
    const updatedName = `Technology Cache ${Date.now()}`;

    try {
      const secondResponse = await request(
        `${previewSession.baseUrl}/live-cached-category`,
      );
      const thirdResponse = await request(
        `${previewSession.baseUrl}/live-cached-category`,
      );
      const secondHtml = await secondResponse.text();
      const thirdHtml = await thirdResponse.text();
      const secondToken = extractRenderToken(secondHtml);
      const thirdToken = extractRenderToken(thirdHtml);

      expect(secondToken).toBe(firstToken);
      expect(thirdToken).toBe(firstToken);

      await callAction(
        'updateCategory',
        {
          id: categoryId,
          name: updatedName,
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      const invalidation = await callAction<{
        invalidated: boolean;
        resource: string;
        tags: string[];
      }>(
        'wpCacheInvalidate',
        {
          id: categoryId,
          entity: 'term',
          taxonomy: 'category',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      expect(invalidation.invalidated).toBe(true);
      expect(invalidation.resource).toBe('categories');
      expect(invalidation.tags).toContain(`wp:entry:categories:${categoryId}`);
      expect(invalidation.tags).toHaveLength(1);

      const fourthResponse = await request(
        `${previewSession.baseUrl}/live-cached-category`,
      );
      const fourthHtml = await fourthResponse.text();
      const fifthResponse = await request(
        `${previewSession.baseUrl}/live-cached-category`,
      );
      const fifthHtml = await fifthResponse.text();
      const fourthToken = extractRenderToken(fourthHtml);
      const fifthToken = extractRenderToken(fifthHtml);

      expect(fourthToken).not.toBe(firstToken);
      expect(fourthHtml).toContain(`data-category-name="${updatedName}"`);
      expect(fifthToken).toBe(fourthToken);
    } finally {
      await callAction(
        'updateCategory',
        {
          id: categoryId,
          name: originalName,
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);

      await callAction(
        'wpCacheInvalidate',
        {
          id: categoryId,
          entity: 'term',
          taxonomy: 'category',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);
    }
  });

  it('keeps the cached post list while refreshing only the invalidated post entry', async () => {
    await resetRouteCacheMetrics(previewSession.baseUrl);

    const listFirst = await fetchCachedPostList(previewSession.baseUrl);
    expect(listFirst.ids).toHaveLength(20);

    const entriesFirst = await Promise.all(
      listFirst.ids.map((id) =>
        fetchCachedPostEntry(previewSession.baseUrl, id),
      ),
    );

    const listSecond = await fetchCachedPostList(previewSession.baseUrl);
    const listThird = await fetchCachedPostList(previewSession.baseUrl);
    const entriesSecond = await Promise.all(
      listFirst.ids.map((id) =>
        fetchCachedPostEntry(previewSession.baseUrl, id),
      ),
    );
    const entriesThird = await Promise.all(
      listFirst.ids.map((id) =>
        fetchCachedPostEntry(previewSession.baseUrl, id),
      ),
    );

    expect(listSecond.renderToken).toBe(listFirst.renderToken);
    expect(listThird.renderToken).toBe(listFirst.renderToken);

    for (let index = 0; index < entriesFirst.length; index += 1) {
      expect(entriesSecond[index].renderToken).toBe(
        entriesFirst[index].renderToken,
      );
      expect(entriesThird[index].renderToken).toBe(
        entriesFirst[index].renderToken,
      );
    }

    const metricsBeforeUpdate = await getRouteCacheMetrics(
      previewSession.baseUrl,
    );
    expect(metricsBeforeUpdate.collections['posts:list']).toBe(1);

    for (const id of listFirst.ids) {
      expect(metricsBeforeUpdate.entries[`id:${id}`]).toBe(1);
    }

    const changedEntry = entriesFirst[0];
    const originalTitle = changedEntry.title;
    const updatedTitle = `Route cache list title ${Date.now()}`;

    try {
      await callAction(
        'updatePost',
        {
          id: changedEntry.id,
          title: updatedTitle,
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      await callAction(
        'wpCacheInvalidate',
        {
          id: changedEntry.id,
          entity: 'post',
          post_type: 'post',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      );

      const listAfterInvalidation = await fetchCachedPostList(
        previewSession.baseUrl,
      );
      const entriesAfterInvalidation = await Promise.all(
        listFirst.ids.map((id) =>
          fetchCachedPostEntry(previewSession.baseUrl, id),
        ),
      );

      expect(listAfterInvalidation.renderToken).toBe(listFirst.renderToken);

      for (let index = 0; index < entriesFirst.length; index += 1) {
        const before = entriesFirst[index];
        const after = entriesAfterInvalidation[index];

        if (after.id === changedEntry.id) {
          expect(after.renderToken).not.toBe(before.renderToken);
          expect(after.title).toBe(updatedTitle);
          continue;
        }

        expect(after.renderToken).toBe(before.renderToken);
        expect(after.title).toBe(before.title);
      }

      const metricsAfterInvalidation = await getRouteCacheMetrics(
        previewSession.baseUrl,
      );
      expect(metricsAfterInvalidation.collections['posts:list']).toBe(1);
      expect(metricsAfterInvalidation.entries[`id:${changedEntry.id}`]).toBe(2);

      for (const id of listFirst.ids) {
        if (id === changedEntry.id) {
          continue;
        }

        expect(metricsAfterInvalidation.entries[`id:${id}`]).toBe(1);
      }
    } finally {
      await callAction(
        'updatePost',
        {
          id: changedEntry.id,
          title: originalTitle,
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);

      await callAction(
        'wpCacheInvalidate',
        {
          id: changedEntry.id,
          entity: 'post',
          post_type: 'post',
        },
        {
          authHeader: basicAuth,
          baseUrl: previewSession.baseUrl,
        },
      ).catch(() => undefined);
    }
  });

  it('bypasses route caching for personalized user-profile reads', async () => {
    const aliceToken = process.env.WP_ALICE_JWT_TOKEN!;
    const bobToken = process.env.WP_BOB_JWT_TOKEN!;
    const aliceAuth = `Bearer ${aliceToken}`;
    const bobAuth = `Bearer ${bobToken}`;

    const firstResponse = await fetchUserProfilePersonalized(
      previewSession.baseUrl,
      aliceAuth,
    );
    const firstBody = (await firstResponse.json()) as UserProfileResponse;
    const secondResponse = await fetchUserProfilePersonalized(
      previewSession.baseUrl,
      bobAuth,
    );
    const secondBody = (await secondResponse.json()) as UserProfileResponse;

    expect(firstBody.user.slug).toBe('alice');
    expect(firstBody.user.name).toBe('Alice Test');
    expect(secondBody.user.slug).toBe('bob');
    expect(secondBody.user.name).toBe('Bob Test');

    // Render tokens must differ because cache is bypassed
    expect(secondBody.renderToken).not.toBe(firstBody.renderToken);
    expect(firstResponse.headers.get('x-astro-cache')).not.toBe('HIT');
    expect(secondResponse.headers.get('x-astro-cache')).not.toBe('HIT');
  });

  it('demonstrates route-cache leakage when user-profile endpoint is not marked personalized', async () => {
    const aliceToken = process.env.WP_ALICE_JWT_TOKEN!;
    const bobToken = process.env.WP_BOB_JWT_TOKEN!;
    const aliceAuth = `Bearer ${aliceToken}`;
    const bobAuth = `Bearer ${bobToken}`;

    const firstResponse = await fetchUserProfileCached(
      previewSession.baseUrl,
      aliceAuth,
    );
    const firstBody = (await firstResponse.json()) as UserProfileResponse;
    const secondResponse = await fetchUserProfileCached(
      previewSession.baseUrl,
      bobAuth,
    );
    const secondBody = (await secondResponse.json()) as UserProfileResponse;

    // Astro route cache keys by URL (not headers), so Bob receives Alice's cached response
    expect(secondBody.renderToken).toBe(firstBody.renderToken);
    expect(secondBody.user.slug).toBe('alice');
    expect(secondBody.user.name).toBe('Alice Test');
    expect(secondResponse.headers.get('x-astro-cache')).toBe('HIT');
  });
});
