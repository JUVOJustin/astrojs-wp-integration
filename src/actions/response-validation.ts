import {
  isStandardSchema,
  type WordPressStandardSchema,
} from 'fluent-wp-client';

/**
 * Validates one action response with a Standard Schema-compatible validator when provided.
 */
export async function validateActionResponse<T>(
  value: unknown,
  schema: WordPressStandardSchema<T> | undefined,
  context: string,
): Promise<T> {
  if (!schema) {
    return value as T;
  }

  if (!isStandardSchema(schema)) {
    throw new Error(
      `${context} received an invalid Standard Schema validator.`,
    );
  }

  const result = await schema['~standard'].validate(value);

  if (!result.issues) {
    return result.value;
  }

  const [issue] = result.issues;
  throw new Error(
    `${context} returned an invalid response: ${issue?.message ?? 'Validation failed.'}`,
  );
}
