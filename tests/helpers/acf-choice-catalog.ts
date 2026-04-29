type AcfChoice = {
  label: string;
  value: string;
};

/**
 * Builds a field-label lookup from the live WordPress REST API.
 *
 * Calls the custom `/wp-json/wp-astrojs-integration/v1/acf-choices` endpoint
 * registered by the test mu-plugin instead of seeding a discovery catalog
 * client-side. This ensures the mapping always reflects the current ACF
 * field definitions in WordPress.
 */
export async function getAcfChoiceLabels(
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
