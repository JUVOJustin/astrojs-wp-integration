import type { Tool, ToolCallOptions } from 'ai';
import { WordPressClient } from 'fluent-wp-client';
import { resolveWpBaseUrl } from '../../../../helpers/wp-env';

const baseUrl = resolveWpBaseUrl();

/** Shared WordPress client used by the AI tool fixture routes. */
export const aiWordPressClient = new WordPressClient({ baseUrl });

const defaultToolCallOptions: ToolCallOptions = {
  toolCallId: 'fixture-tool-call',
  messages: [],
};

/**
 * Executes one AI SDK tool without a model round-trip inside fixture routes.
 */
export async function executeFixtureTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  if (!tool.execute) {
    throw new Error('Tool is missing an execute handler.');
  }

  return tool.execute(input, defaultToolCallOptions) as Promise<TOutput>;
}
