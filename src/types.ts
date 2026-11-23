export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export type BodyEncoding = 'json' | 'formUrlencoded' | 'formData' | 'raw';

export type ExecutionStrategy = 'pipeline' | 'parallel' | 'batch';

export type OutputAggregationMode =
  | 'allAsObject'
  | 'allAsArray'
  | 'lastStepOnly'
  | 'splitToItems'
  | 'mergeIntoInput';

export interface KeyValueEntry {
  key: string;
  value: string;
}

export interface KeyValueTypedEntry {
  key: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
}

export interface EndpointDefinition {
  alias: string;
  method: HttpVerb;
  url: string;
  queryParams?: KeyValueEntry[] | Record<string, string>;
  headers?: KeyValueEntry[] | Record<string, string>;
  sendBody?: boolean;
  bodyContentType?: 'json' | 'formUrlencoded' | 'raw';
  bodyInputMethod?: 'jsonEditor' | 'fields';
  bodyPayload?: string;
  bodyFields?: KeyValueTypedEntry[];
  formFields?: KeyValueEntry[];
  rawContentType?: string;
  dataPath?: string;
  continueOnFail?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface EndpointExecutionResult {
  alias: string;
  statusCode: number;
  success: boolean;
  data: any;
  headers?: Record<string, any>;
  durationMs: number;
  error?: string;
}

export interface PipelineRuntimeContext {
  json: Record<string, any>;
  pipeline: Record<string, EndpointExecutionResult>;
  steps: EndpointExecutionResult[];
  prev?: EndpointExecutionResult;
  itemIndex: number;
}

export interface GlobalPipeSettings {
  baseUrl?: string;
  defaultHeaders?: KeyValueEntry[];
  concurrencyLimit?: number;
  delayBetweenStepsMs?: number;
  authType?: 'none' | 'bearer' | 'header' | 'basic';
  bearerToken?: string;
  headerAuthName?: string;
  headerAuthValue?: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
}
