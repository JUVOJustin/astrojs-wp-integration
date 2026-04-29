import type { WordPressClient } from 'fluent-wp-client';

type AcfChoice = {
  label: string;
  value: string;
};

type AcfSchemaField = {
  choices?: AcfChoice[];
};

type EntryWithAcf = {
  acf?: Record<string, unknown> | null;
};

/**
 * Creates one callback that can normalize ACF choices for loaders and actions.
 */
export function createAcfChoiceLabelMapper(client: WordPressClient) {
  const lookups = new Map<string, Promise<Map<string, Map<string, string>>>>();

  return async function mapAcfChoiceLabels<TEntry extends EntryWithAcf>(
    entry: TEntry,
    context: { resource: string },
  ): Promise<TEntry> {
    if (!entry.acf) {
      return entry;
    }

    const choiceLabels = await getChoiceLabels(client, context.resource, lookups);

    return {
      ...entry,
      acf: Object.fromEntries(
        Object.entries(entry.acf).map(([fieldName, value]) => [
          fieldName,
          choiceLabels.get(fieldName)?.get(String(value)) ?? value,
        ]),
      ),
    };
  };
}

async function getChoiceLabels(
  client: WordPressClient,
  resource: string,
  lookups: Map<string, Promise<Map<string, Map<string, string>>>>,
): Promise<Map<string, Map<string, string>>> {
  if (!lookups.has(resource)) {
    lookups.set(resource, loadChoiceLabels(client, resource));
  }

  return lookups.get(resource)!;
}

async function loadChoiceLabels(
  client: WordPressClient,
  resource: string,
): Promise<Map<string, Map<string, string>>> {
  const acfFields = await client.content(resource).getSchemaValue<
    Record<string, AcfSchemaField>
  >('properties.acf.properties');
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
