import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAstroPreviewServer } from '../../helpers/astro-preview';
import { callAction } from '../../helpers/action-client';
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

type AiLivePostEntryResponse = {
  renderToken: string;
  result: {
    item?: {
      id: number;
      slug: string;
      title?: { rendered: string };
    };
    error?: {
      message: string;
    };
    ok?: boolean;
  };
};

type AiLivePostCollectionResponse = {
  renderToken: string;
  result: Array<{
    id: number;
    slug: string;
    title?: { rendered: string };
  }> | {
    error?: {
      message: string;
    };
    ok?: boolean;
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

async function getRouteCacheMetrics(baseUrl: string): Promise<RouteCacheMetrics> {
  return callAction<RouteCacheMetrics>('routeCacheMetricsGet', {}, { baseUrl });
}

async function resetRouteCacheMetrics(baseUrl: string): Promise<RouteCacheMetrics> {
  return callAction<RouteCacheMetrics>('routeCacheMetricsReset', {}, { baseUrl });
}

async function fetchCachedPostList(baseUrl: string): Promise<CachedPostListResponse> {
  const response = await request(`${baseUrl}/api/cached-post-list.json`);
  return response.json();
}

async function fetchCachedPostEntry(baseUrl: string, id: number): Promise<CachedPostEntryResponse> {
  const response = await request(`${baseUrl}/api/cached-post-entry.json?id=${id}`);
  return response.json();
}

async function fetchAiLivePostEntry(baseUrl: string, slug = 'test-post-001'): Promise<Response> {
  return request(`${baseUrl}/api/ai-live-post-entry.json?slug=${encodeURIComponent(slug)}`);
}

async function fetchAiLivePostEntryPersonalized(baseUrl: string, slug = 'test-post-001'): Promise<Response> {
  return request(`${baseUrl}/api/ai-live-post-entry-personalized.json?slug=${encodeURIComponent(slug)}`, {
    headers: {
      Cookie: 'viewer=test-user',
    },
  });
}

async function fetchAiLivePostCollection(baseUrl: string): Promise<Response> {
  return request(`${baseUrl}/api/ai-live-post-collection.json`);
}

async function fetchAiLivePostEntryMissingCollection(baseUrl: string): Promise<Response> {
  return request(`${baseUrl}/api/ai-live-post-entry-missing-collection.json`);
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
    const firstResponse = await request(`${previewSession.baseUrl}/live-cached-book`);
    const firstHtml = await firstResponse.text();
    const firstToken = extractRenderToken(firstHtml);
    const originalTitle = extractDataAttribute(firstHtml, 'data-book-title');
    const originalSubtitle = extractDataAttribute(firstHtml, 'data-book-subtitle');

    const idMatch = firstHtml.match(/data-book-id="(\d+)"/);
    expect(idMatch).not.toBeNull();

    const bookId = Number.parseInt(idMatch![1], 10);
    const updatedTitle = `Route cache title ${Date.now()}`;
    const updatedSubtitle = `Route cache subtitle ${Date.now()}`;

    try {
      const secondResponse = await request(`${previewSession.baseUrl}/live-cached-book`);
      const thirdResponse = await request(`${previewSession.baseUrl}/live-cached-book`);
      const secondHtml = await secondResponse.text();
      const thirdHtml = await thirdResponse.text();
      const secondToken = extractRenderToken(secondHtml);
      const thirdToken = extractRenderToken(thirdHtml);

      expect(secondToken).toBe(firstToken);
      expect(thirdToken).toBe(firstToken);

      await callAction('updateBook', {
        id: bookId,
        title: updatedTitle,
        acf: {
          acf_subtitle: updatedSubtitle,
        },
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      const invalidation = await callAction<{ invalidated: boolean; resource: string; tags: string[] }>('wpCacheInvalidate', {
        id: bookId,
        entity: 'post',
        post_type: 'book',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      expect(invalidation.invalidated).toBe(true);
      expect(invalidation.resource).toBe('books');
      expect(invalidation.tags).toContain(`wp:entry:books:${bookId}`);

      const fourthResponse = await request(`${previewSession.baseUrl}/live-cached-book`);
      const fourthHtml = await fourthResponse.text();
      const fifthResponse = await request(`${previewSession.baseUrl}/live-cached-book`);
      const fifthHtml = await fifthResponse.text();
      const fourthToken = extractRenderToken(fourthHtml);
      const fifthToken = extractRenderToken(fifthHtml);

      expect(fourthToken).not.toBe(firstToken);
      expect(fourthHtml).toContain(`data-book-title="${updatedTitle}"`);
      expect(fourthHtml).toContain(`data-book-subtitle="${updatedSubtitle}"`);
      expect(fifthToken).toBe(fourthToken);
      expect(fifthHtml).toContain(`data-book-title="${updatedTitle}"`);
    } finally {
      await callAction('updateBook', {
        id: bookId,
        title: originalTitle,
        acf: {
          acf_subtitle: originalSubtitle,
        },
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);

      await callAction('wpCacheInvalidate', {
        id: bookId,
        entity: 'post',
        post_type: 'book',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);
    }
  });

  it('caches live term responses and invalidates them through the term cache action', async () => {
    const firstResponse = await request(`${previewSession.baseUrl}/live-cached-category`);
    const firstHtml = await firstResponse.text();
    const firstToken = extractRenderToken(firstHtml);
    const originalName = extractDataAttribute(firstHtml, 'data-category-name');

    const idMatch = firstHtml.match(/data-category-id="(\d+)"/);
    expect(idMatch).not.toBeNull();

    const categoryId = Number.parseInt(idMatch![1], 10);
    const updatedName = `Technology Cache ${Date.now()}`;

    try {
      const secondResponse = await request(`${previewSession.baseUrl}/live-cached-category`);
      const thirdResponse = await request(`${previewSession.baseUrl}/live-cached-category`);
      const secondHtml = await secondResponse.text();
      const thirdHtml = await thirdResponse.text();
      const secondToken = extractRenderToken(secondHtml);
      const thirdToken = extractRenderToken(thirdHtml);

      expect(secondToken).toBe(firstToken);
      expect(thirdToken).toBe(firstToken);

      await callAction('updateCategory', {
        id: categoryId,
        name: updatedName,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      const invalidation = await callAction<{ invalidated: boolean; resource: string; tags: string[] }>('wpCacheInvalidate', {
        id: categoryId,
        entity: 'term',
        taxonomy: 'category',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      expect(invalidation.invalidated).toBe(true);
      expect(invalidation.resource).toBe('categories');
      expect(invalidation.tags).toContain(`wp:entry:categories:${categoryId}`);
      expect(invalidation.tags).toHaveLength(1);

      const fourthResponse = await request(`${previewSession.baseUrl}/live-cached-category`);
      const fourthHtml = await fourthResponse.text();
      const fifthResponse = await request(`${previewSession.baseUrl}/live-cached-category`);
      const fifthHtml = await fifthResponse.text();
      const fourthToken = extractRenderToken(fourthHtml);
      const fifthToken = extractRenderToken(fifthHtml);

      expect(fourthToken).not.toBe(firstToken);
      expect(fourthHtml).toContain(`data-category-name="${updatedName}"`);
      expect(fifthToken).toBe(fourthToken);
    } finally {
      await callAction('updateCategory', {
        id: categoryId,
        name: originalName,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);

      await callAction('wpCacheInvalidate', {
        id: categoryId,
        entity: 'term',
        taxonomy: 'category',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);
    }
  });

  it('keeps the cached post list while refreshing only the invalidated post entry', async () => {
    await resetRouteCacheMetrics(previewSession.baseUrl);

    const listFirst = await fetchCachedPostList(previewSession.baseUrl);
    expect(listFirst.ids).toHaveLength(20);

    const entriesFirst = await Promise.all(
      listFirst.ids.map((id) => fetchCachedPostEntry(previewSession.baseUrl, id)),
    );

    const listSecond = await fetchCachedPostList(previewSession.baseUrl);
    const listThird = await fetchCachedPostList(previewSession.baseUrl);
    const entriesSecond = await Promise.all(
      listFirst.ids.map((id) => fetchCachedPostEntry(previewSession.baseUrl, id)),
    );
    const entriesThird = await Promise.all(
      listFirst.ids.map((id) => fetchCachedPostEntry(previewSession.baseUrl, id)),
    );

    expect(listSecond.renderToken).toBe(listFirst.renderToken);
    expect(listThird.renderToken).toBe(listFirst.renderToken);

    for (let index = 0; index < entriesFirst.length; index += 1) {
      expect(entriesSecond[index].renderToken).toBe(entriesFirst[index].renderToken);
      expect(entriesThird[index].renderToken).toBe(entriesFirst[index].renderToken);
    }

    const metricsBeforeUpdate = await getRouteCacheMetrics(previewSession.baseUrl);
    expect(metricsBeforeUpdate.collections['posts:list']).toBe(1);

    for (const id of listFirst.ids) {
      expect(metricsBeforeUpdate.entries[`id:${id}`]).toBe(1);
    }

    const changedEntry = entriesFirst[0];
    const originalTitle = changedEntry.title;
    const updatedTitle = `Route cache list title ${Date.now()}`;

    try {
      await callAction('updatePost', {
        id: changedEntry.id,
        title: updatedTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      await callAction('wpCacheInvalidate', {
        id: changedEntry.id,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      const listAfterInvalidation = await fetchCachedPostList(previewSession.baseUrl);
      const entriesAfterInvalidation = await Promise.all(
        listFirst.ids.map((id) => fetchCachedPostEntry(previewSession.baseUrl, id)),
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

      const metricsAfterInvalidation = await getRouteCacheMetrics(previewSession.baseUrl);
      expect(metricsAfterInvalidation.collections['posts:list']).toBe(1);
      expect(metricsAfterInvalidation.entries[`id:${changedEntry.id}`]).toBe(2);

      for (const id of listFirst.ids) {
        if (id === changedEntry.id) {
          continue;
        }

        expect(metricsAfterInvalidation.entries[`id:${id}`]).toBe(1);
      }
    } finally {
      await callAction('updatePost', {
        id: changedEntry.id,
        title: originalTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);

      await callAction('wpCacheInvalidate', {
        id: changedEntry.id,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);
    }
  });

  it('caches AI live entry reads and invalidates them by entry tag', async () => {
    await resetRouteCacheMetrics(previewSession.baseUrl);

    const firstResponse = await fetchAiLivePostEntry(previewSession.baseUrl);
    const firstBody = await firstResponse.json() as AiLivePostEntryResponse;
    const secondResponse = await fetchAiLivePostEntry(previewSession.baseUrl);
    const secondBody = await secondResponse.json() as AiLivePostEntryResponse;

    expect(firstResponse.headers.get('x-astro-cache')).toBe('MISS');
    expect(secondResponse.headers.get('x-astro-cache')).toBe('HIT');
    expect(firstBody.result.error).toBeUndefined();
    expect(firstBody.result.item?.slug).toBe('test-post-001');
    expect(secondBody.renderToken).toBe(firstBody.renderToken);

    const metricsBeforeInvalidation = await getRouteCacheMetrics(previewSession.baseUrl);
    expect(metricsBeforeInvalidation.entries['slug:test-post-001']).toBe(1);

    const postId = firstBody.result.item!.id;
    const originalTitle = firstBody.result.item!.title?.rendered ?? '';
    const updatedTitle = `AI route cache title ${Date.now()}`;

    try {
      await callAction('updatePost', {
        id: postId,
        title: updatedTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      await callAction('wpCacheInvalidate', {
        id: postId,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      const thirdResponse = await fetchAiLivePostEntry(previewSession.baseUrl);
      const thirdBody = await thirdResponse.json() as AiLivePostEntryResponse;

      expect(thirdResponse.headers.get('x-astro-cache')).toBe('MISS');
      expect(thirdBody.renderToken).not.toBe(firstBody.renderToken);
      expect(thirdBody.result.item?.title?.rendered).toBe(updatedTitle);

      const metricsAfterInvalidation = await getRouteCacheMetrics(previewSession.baseUrl);
      expect(metricsAfterInvalidation.entries['slug:test-post-001']).toBe(2);
    } finally {
      await callAction('updatePost', {
        id: postId,
        title: originalTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);

      await callAction('wpCacheInvalidate', {
        id: postId,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);
    }
  });

  it('bypasses route caching for personalized AI live entry reads', async () => {
    await resetRouteCacheMetrics(previewSession.baseUrl);

    const firstResponse = await fetchAiLivePostEntryPersonalized(previewSession.baseUrl);
    const firstBody = await firstResponse.json() as AiLivePostEntryResponse;
    const secondResponse = await fetchAiLivePostEntryPersonalized(previewSession.baseUrl);
    const secondBody = await secondResponse.json() as AiLivePostEntryResponse;

    expect(firstBody.result.error).toBeUndefined();
    expect(secondBody.result.error).toBeUndefined();
    expect(firstBody.result.item?.slug).toBe('test-post-001');
    expect(secondBody.result.item?.slug).toBe('test-post-001');
    expect(secondBody.renderToken).not.toBe(firstBody.renderToken);
    expect(firstResponse.headers.get('x-astro-cache')).not.toBe('HIT');
    expect(secondResponse.headers.get('x-astro-cache')).not.toBe('HIT');

    const metrics = await getRouteCacheMetrics(previewSession.baseUrl);
    expect(metrics.entries['slug:test-post-001']).toBe(2);
  });

  it('caches AI live collection reads and invalidates them when one entry changes', async () => {
    await resetRouteCacheMetrics(previewSession.baseUrl);

    const firstResponse = await fetchAiLivePostCollection(previewSession.baseUrl);
    const firstBody = await firstResponse.json() as AiLivePostCollectionResponse;
    const secondResponse = await fetchAiLivePostCollection(previewSession.baseUrl);
    const secondBody = await secondResponse.json() as AiLivePostCollectionResponse;

    expect(firstResponse.headers.get('x-astro-cache')).toBe('MISS');
    expect(secondResponse.headers.get('x-astro-cache')).toBe('HIT');
    expect(Array.isArray(firstBody.result)).toBe(true);
    expect(Array.isArray(secondBody.result)).toBe(true);
    expect(firstBody.renderToken).toBe(secondBody.renderToken);

    const collection = firstBody.result as AiLivePostCollectionResponse['result'] & Array<{ id: number; title?: { rendered: string } }>;
    expect(collection).toHaveLength(20);

    const metricsBeforeInvalidation = await getRouteCacheMetrics(previewSession.baseUrl);
    expect(metricsBeforeInvalidation.collections['posts:list']).toBe(1);

    const changedPost = collection[0];
    const originalTitle = changedPost.title?.rendered ?? '';
    const updatedTitle = `AI route cache collection ${Date.now()}`;

    try {
      await callAction('updatePost', {
        id: changedPost.id,
        title: updatedTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      await callAction('wpCacheInvalidate', {
        id: changedPost.id,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      });

      const thirdResponse = await fetchAiLivePostCollection(previewSession.baseUrl);
      const thirdBody = await thirdResponse.json() as AiLivePostCollectionResponse;

      expect(thirdResponse.headers.get('x-astro-cache')).toBe('MISS');
      expect(thirdBody.renderToken).not.toBe(firstBody.renderToken);
      expect(Array.isArray(thirdBody.result)).toBe(true);
      expect((thirdBody.result as Array<{ id: number; title?: { rendered: string } }>)[0].title?.rendered).toBe(updatedTitle);

      const metricsAfterInvalidation = await getRouteCacheMetrics(previewSession.baseUrl);
      expect(metricsAfterInvalidation.collections['posts:list']).toBe(2);
    } finally {
      await callAction('updatePost', {
        id: changedPost.id,
        title: originalTitle,
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);

      await callAction('wpCacheInvalidate', {
        id: changedPost.id,
        entity: 'post',
        post_type: 'post',
      }, {
        authHeader: basicAuth,
        baseUrl: previewSession.baseUrl,
      }).catch(() => undefined);
    }
  });

  it('returns a clear tool error when the requested live collection is not defined', async () => {
    const response = await fetchAiLivePostEntryMissingCollection(previewSession.baseUrl);
    const body = await response.json() as {
      result: {
        error?: {
          message: string;
        };
        ok?: boolean;
      };
    };

    expect(response.ok).toBe(true);
    expect(body.result.ok).toBe(false);
    expect(body.result.error?.message).toContain('missingLivePosts');
    expect(body.result.error?.message).toContain('src/live.config.ts');
  });
});
