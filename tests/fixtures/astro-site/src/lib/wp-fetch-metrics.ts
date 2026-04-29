type CounterMap = Record<string, number>;

type RouteCacheMetrics = {
  collections: CounterMap;
  entries: CounterMap;
};

type GlobalMetricsState = typeof globalThis & {
  __WP_ROUTE_CACHE_METRICS__?: RouteCacheMetrics;
};

function getMetricsState(): RouteCacheMetrics {
  const globals = globalThis as GlobalMetricsState;

  if (!globals.__WP_ROUTE_CACHE_METRICS__) {
    globals.__WP_ROUTE_CACHE_METRICS__ = {
      collections: {},
      entries: {},
    };
  }

  return globals.__WP_ROUTE_CACHE_METRICS__;
}

function increment(map: CounterMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function entryMetricKey(resource: string, key: string): string {
  return resource === 'posts' ? key : `${resource}:${key}`;
}

function collectionMetricKey(resource: string): string {
  return `${resource}:list`;
}

/**
 * Returns a stable snapshot of the in-process WordPress fetch counters.
 */
export function getRouteCacheMetrics(): RouteCacheMetrics {
  const metrics = getMetricsState();

  return {
    collections: { ...metrics.collections },
    entries: { ...metrics.entries },
  };
}

/**
 * Clears the in-process WordPress fetch counters used by the route-cache tests.
 */
export function resetRouteCacheMetrics(): RouteCacheMetrics {
  const metrics = getMetricsState();

  metrics.collections = {};
  metrics.entries = {};

  return getRouteCacheMetrics();
}

/**
 * Wraps fetch so route-cache tests can assert which WordPress resources were reloaded upstream.
 */
export async function trackedWordPressFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const requestUrl =
    typeof input === 'string'
      ? new URL(input)
      : input instanceof URL
        ? input
        : new URL(input.url);

  const resourceMatch = requestUrl.pathname.match(
    /^\/wp-json\/wp\/v2\/([^/]+)(?:\/(\d+))?$/,
  );

  if (!resourceMatch) {
    return fetch(input, init);
  }

  const [, resource, itemId] = resourceMatch;

  if (itemId) {
    increment(
      getMetricsState().entries,
      entryMetricKey(resource, `id:${itemId}`),
    );
    return fetch(input, init);
  }

  const id = requestUrl.searchParams.get('include');
  const slug = requestUrl.searchParams.get('slug');

  if (slug) {
    increment(
      getMetricsState().entries,
      entryMetricKey(resource, `slug:${slug}`),
    );
  } else if (id) {
    increment(getMetricsState().entries, entryMetricKey(resource, `id:${id}`));
  } else {
    increment(getMetricsState().collections, collectionMetricKey(resource));
  }

  return fetch(input, init);
}
