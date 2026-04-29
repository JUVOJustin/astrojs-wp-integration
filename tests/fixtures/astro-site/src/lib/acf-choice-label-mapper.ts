type AcfChoice = {
  label: string;
  value: string;
};

type EntryWithAcf = {
  acf?: Record<string, unknown> | null;
};

/**
 * Creates one callback that can normalize ACF choices for loaders and actions.
 *
 * Reads value → label mappings from the live WordPress REST API endpoint
 * `/wp-json/wp-astrojs-integration/v1/acf-choices` registered by the test
 * mu-plugin, eliminating the need for client-side catalog seeding.
 */
export function createAcfChoiceLabelMapper(baseUrl: string) {
  const lookups = new Map<string, Promise<Map<string, Map<string, string>>>>();

  return async function mapAcfChoiceLabels<TEntry extends EntryWithAcf>(
    entry: TEntry,
    _context: { resource: string },
  ): Promise<TEntry> {
    if (!entry.acf) {
      return entry;
    }

    const choiceLabels = await getChoiceLabels(baseUrl, lookups);

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
  baseUrl: string,
  lookups: Map<string, Promise<Map<string, Map<string, string>>>>,
): Promise<Map<string, Map<string, string>>> {
  if (!lookups.has('acf-choices')) {
    lookups.set('acf-choices', loadChoiceLabels(baseUrl));
  }

  return lookups.get('acf-choices')!;
}

async function loadChoiceLabels(
  baseUrl: string,
): Promise<Map<string, Map<string, string>>> {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/wp-json/wp-astrojs-integration/v1/acf-choices`,
  );

  if (!response.ok) {
    return new Map();
  }

  const data = (await response.json()) as Record<string, AcfChoice[]>;
  const choiceLabels = new Map<string, Map<string, string>>();

  for (const [fieldName, choices] of Object.entries(data)) {
    if (!Array.isArray(choices)) continue;

    choiceLabels.set(
      fieldName,
      new Map(choices.map((choice) => [choice.value, choice.label])),
    );
  }

  return choiceLabels;
}
