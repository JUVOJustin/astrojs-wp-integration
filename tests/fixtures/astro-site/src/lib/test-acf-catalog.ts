import type { WordPressClient } from 'fluent-wp-client';

/**
 * Seeds fixture discovery metadata so mapper tests exercise the catalog path.
 */
export function useTestAcfChoiceCatalog(
  client: WordPressClient,
  resource: string,
): WordPressClient {
  return client.useCatalog({
    abilities: {},
    resources: {},
    terms: {},
    content: {
      [resource]: {
        kind: 'content',
        namespace: 'wp/v2',
        resource,
        route: `/wp/v2/${resource}`,
        schemas: {
          item: {
            properties: {
              acf: {
                properties: {
                  acf_project_status: {
                    choices: [
                      { value: 'in_progress', label: 'In progress' },
                      { value: 'done', label: 'Done' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
