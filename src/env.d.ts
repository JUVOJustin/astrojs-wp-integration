/// <reference types="astro/types" />

declare module 'astro:actions' {
  export type ActionErrorCode = string;

  export interface ActionErrorParams {
    code: ActionErrorCode;
    message?: string;
    stack?: string;
  }

  export class ActionError extends Error {
    readonly type: 'AstroActionError';
    readonly code: ActionErrorCode;
    readonly status: number;

    constructor(params: ActionErrorParams);

    static codeToStatus(code: ActionErrorCode): number;
    static statusToCode(status: number): ActionErrorCode;
  }

  export class ActionInputError extends ActionError {
    readonly type: 'AstroActionInputError';
    readonly issues: unknown[];
    readonly fields: Record<string, string[]>;
  }

  export type ActionResult<TData> = {
    data: TData | undefined;
    error: ActionError | undefined;
  };

  export interface ActionClient<
    TData = unknown,
    TAccept = 'json' | 'form' | undefined,
    TSchema = unknown,
  > {
    (input: unknown): Promise<ActionResult<TData>>;
    orThrow(input: unknown): Promise<TData>;
    queryString?: string;
    toString(): string;
  }

  export type ActionAPIContext = import('astro').APIContext;

  export interface DefineActionOptions<
    TInput,
    TData,
    TSchema = unknown,
    TAccept extends 'json' | 'form' | undefined = undefined,
  > {
    accept?: TAccept;
    input?: TSchema;
    handler(input: TInput, context: ActionAPIContext): TData | Promise<TData>;
  }

  export function defineAction<
    TInput,
    TData,
    TSchema = unknown,
    TAccept extends 'json' | 'form' | undefined = undefined,
  >(
    options: DefineActionOptions<TInput, TData, TSchema, TAccept>,
  ): ActionClient<TData, TAccept, TSchema>;

  export function isActionError(error: unknown): error is ActionError;
  export function isInputError(error: unknown): error is ActionInputError;
}

declare module 'astro:content' {
  export type LiveDataEntry<TData = unknown> = {
    id: string;
    data: TData;
    cacheHint?: unknown;
    rendered?: { html: string };
  };

  export function getLiveEntry(
    collection: string,
    filter: unknown,
  ): Promise<{
    entry?: LiveDataEntry;
    error?: Error;
    cacheHint?: unknown;
  }>;

  export function getLiveCollection(
    collection: string,
    filter?: unknown,
  ): Promise<{
    entries: LiveDataEntry[];
    error?: Error;
    cacheHint?: unknown;
  }>;
}
