import type { WordPressClient } from 'fluent-wp-client';

type AcfChoice = {
  label: string;
  value: string;
};

type AcfSchemaField = {
  choices?: AcfChoice[];
};

/**
 * Seeds discovery metadata that mirrors WordPressResourceDescription ACF choice fields.
 */
export function useAcfChoiceCatalog(client: WordPressClient): WordPressClient {
  return client.useCatalog({
    abilities: {},
    resources: {},
    terms: {},
    content: {
      posts: {
        kind: 'content',
        namespace: 'wp/v2',
        resource: 'posts',
        route: '/wp/v2/posts',
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

/**
 * Builds the same field-label lookup a consumer can pass into mapEntry.
 */
export async function getAcfChoiceLabels(
  client: WordPressClient,
): Promise<Map<string, Map<string, string>>> {
  const acfFields = await client.content('posts').getSchemaValue<Record<string, AcfSchemaField>>(
    'properties.acf.properties',
  );
  const choiceLabels = new Map<string, Map<string, string>>();

  for (const [fieldName, fieldSchema] of Object.entries(acfFields ?? {})) {
    if (!Array.isArray(fieldSchema.choices)) continue;

    choiceLabels.set(
      fieldName,
      new Map(fieldSchema.choices.map((choice) => [choice.value, choice.label])),
    );
  }

  return choiceLabels;
}
