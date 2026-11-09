import { isStandardSchema } from 'fluent-wp-client';
import type { WordPressStandardSchema } from 'fluent-wp-client';

/**
 * Validates one action response with a Standard Schema-compatible validator when provided.
 */
export async function validateActionResponse<T>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- A Standard Schema validator must receive the unvalidated action response.
  value: unknown,
  schema: WordPressStandardSchema<T> | undefined,
  context: string
): Promise<T> {
  if (!schema) {
    // SAFETY: Without a schema, the caller explicitly owns the response type contract.
    return value as T;
  }

  if (!isStandardSchema(schema)) {
    throw new Error(
      `${context} received an invalid Standard Schema validator.`
    );
  }

  const result = await schema['~standard'].validate(value);

  if (!result.issues) {
    return result.value;
  }

  const [issue] = result.issues;
  throw new Error(
    `${context} returned an invalid response: ${issue?.message ?? 'Validation failed.'}`
  );
}
