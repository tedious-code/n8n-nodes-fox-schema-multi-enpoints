import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
  NodeOperationError,
  sleep,
} from 'n8n-workflow';

import {
  EndpointDefinition,
  EndpointExecutionResult,
  GlobalPipeSettings,
  OutputAggregationMode,
  PipelineRuntimeContext,
} from '../../src/types';
import { executeSingleEndpoint } from '../../src/utils/httpClient';

export class FoxSchemaMultiEndpoints implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Fox Schema Multi Endpoint',
    name: 'foxSchemaMultiEndpoints',
    icon: {
      light: 'file:foxMultiPipe.svg',
      dark: 'file:foxMultiPipe.svg',
    },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["mode"]}}',
    description:
      'Fox Schema Multi Endpoint node for n8n: Execute multiple HTTP endpoints in sequence or parallel with dynamic variable propagation',
    defaults: {
      name: 'Fox Schema Multi Endpoint',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Execute Multi-Endpoint Pipeline',
            value: 'execute',
            action: 'Execute multiple endpoints',
            description: 'Execute multiple HTTP endpoints sequentially or concurrently',
          },
        ],
        default: 'execute',
      },
      {
        displayName: 'Execution Mode',
        name: 'mode',
        type: 'options',
        options: [
          {
            name: 'Parallel (Concurrent)',
            value: 'parallel',
            description: 'Execute requests concurrently and aggregate all responses',
          },
          {
            name: 'Sequential Pipe (Chained)',
            value: 'pipeline',
            description:
              'Execute requests in order. Downstream requests can access prior responses via {{$pipeline.alias.data}}.',
          },
        ],
        default: 'pipeline',
        description: 'How configured endpoints should be processed',
      },
      {
        displayName: 'Response Output',
        name: 'responseMode',
        type: 'options',
        options: [
          {
            name: 'All Responses as Array',
            value: 'allAsArray',
            description: 'Return a list containing all endpoint execution responses',
          },
          {
            name: 'First Response Only',
            value: 'firstResponse',
            description: 'Return data only from the first executed endpoint',
          },
          {
            name: 'Last Response Only',
            value: 'lastResponse',
            description: 'Return data only from the final executed endpoint',
          },
          {
            name: 'Merge All Responses Into an Object',
            value: 'mergeAllToObject',
            description:
              'Combine all endpoint results into an object keyed by step alias e.g. { step1: { data, status }, step2: { ... } }.',
          },
          {
            name: 'Merge Into Input Item',
            value: 'mergeIntoInput',
            description: 'Merge all endpoint responses directly into the incoming $JSON object',
          },
          {
            name: 'Split Each Response to New Item',
            value: 'splitToItems',
            description: 'Emit each endpoint response as an individual n8n output item',
          },
        ],
        default: 'mergeAllToObject',
        description: 'How responses should be combined in the final node output',
      },
      {
        displayName: 'Timeout (Ms)',
        name: 'timeoutMs',
        type: 'number',
        default: 500,
        description:
          'Timeout in milliseconds for each request. Defaults to 500ms and can be updated as needed.',
      },
      {
        displayName: 'Endpoints',
        name: 'endpoints',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Endpoint',
        default: {
          endpointValues: [
            {
              alias: 'step1',
              method: 'GET',
              url: 'https://api.example.com/data',
            },
          ],
        },
        options: [
          {
            name: 'endpointValues',
            displayName: 'Endpoint',
            values: [
              {
                displayName: 'Alias / Step Name',
                name: 'alias',
                type: 'string',
                default: 'step1',
                placeholder: 'e.g. auth, fetchUser, createOrder',
                description:
                  'Unique identifier for referencing this step in downstream requests and output',
              },
              {
                displayName: 'Body Content Type',
                name: 'bodyContentType',
                type: 'options',
                displayOptions: {
                  show: {
                    sendBody: [true],
                  },
                },
                options: [
                  {
                    name: 'Form-Urlencoded',
                    value: 'formUrlencoded',
                  },
                  {
                    name: 'JSON',
                    value: 'json',
                  },
                  {
                    name: 'Raw / Text / XML / GraphQL',
                    value: 'raw',
                  },
                ],
                default: 'json',
                description: 'Format of the request body',
              },
              {
                displayName: 'Body Fields',
                name: 'bodyFields',
                type: 'fixedCollection',
                typeOptions: {
                  multipleValues: true,
                },
                placeholder: 'Add Field',
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['json'],
                    bodyJsonType: ['fields'],
                  },
                },
                default: {},
                options: [
                  {
                    name: 'fieldValues',
                    displayName: 'Field',
                    values: [
                      {
                        displayName: 'Key',
                        name: 'key',
                        type: 'string',
                        default: '',
                      },
                      {
                        displayName: 'Type',
                        name: 'type',
                        type: 'options',
                        options: [
                          { name: 'Boolean', value: 'boolean' },
                          { name: 'Number', value: 'number' },
                          { name: 'Object / Array (JSON)', value: 'json' },
                          { name: 'String', value: 'string' },
                        ],
                        default: 'string',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                      },
                    ],
                  },
                ],
              },
              {
                displayName: 'Continue on Fail',
                name: 'continueOnFail',
                type: 'boolean',
                default: false,
                description:
                  'Whether to continue pipeline execution if this endpoint fails',
              },
              {
                displayName: 'Form Fields',
                name: 'formFields',
                type: 'fixedCollection',
                typeOptions: {
                  multipleValues: true,
                },
                placeholder: 'Add Form Field',
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['formUrlencoded'],
                  },
                },
                default: {},
                options: [
                  {
                    name: 'fieldValues',
                    displayName: 'Field',
                    values: [
                      {
                        displayName: 'Key',
                        name: 'key',
                        type: 'string',
                        default: '',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                      },
                    ],
                  },
                ],
              },
              {
                displayName: 'Headers',
                name: 'headers',
                type: 'fixedCollection',
                typeOptions: {
                  multipleValues: true,
                },
                placeholder: 'Add Header',
                default: {},
                options: [
                  {
                    name: 'headerValues',
                    displayName: 'Header',
                    values: [
                      {
                        displayName: 'Key',
                        name: 'key',
                        type: 'string',
                        default: '',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                      },
                    ],
                  },
                ],
              },
              {
                displayName: 'JSON Input Type',
                name: 'bodyJsonType',
                type: 'options',
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['json'],
                  },
                },
                options: [
                  {
                    name: 'Fields (Key-Value Builder)',
                    value: 'fields',
                    description: 'Add individual JSON fields',
                  },
                  {
                    name: 'JSON Editor / Expression',
                    value: 'jsonEditor',
                    description: 'Write raw JSON string or expression',
                  },
                ],
                default: 'jsonEditor',
              },
              {
                displayName: 'JSON Payload',
                name: 'bodyPayload',
                type: 'string',
                typeOptions: {
                  rows: 5,
                },
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['json'],
                    bodyJsonType: ['jsonEditor'],
                  },
                },
                default: '',
                placeholder:
                  '{\n  "userId": "{{ $json.ID }}",\n  "token": "{{ $pipeline.auth.data.token }}",\n  "items": {{ $pipeline.cart.data }}\n}',
                description:
                  'JSON payload to send with the request. Supports expressions like {{$pipeline.step1.data}}.',
              },
              {
                displayName: 'Method',
                name: 'method',
                type: 'options',
                options: [
                  { name: 'DELETE', value: 'DELETE' },
                  { name: 'GET', value: 'GET' },
                  { name: 'HEAD', value: 'HEAD' },
                  { name: 'PATCH', value: 'PATCH' },
                  { name: 'POST', value: 'POST' },
                  { name: 'PUT', value: 'PUT' },
                ],
                default: 'GET',
              },
              {
                displayName: 'Query Parameters',
                name: 'queryParams',
                type: 'fixedCollection',
                typeOptions: {
                  multipleValues: true,
                },
                placeholder: 'Add Query Parameter',
                default: {},
                options: [
                  {
                    name: 'paramValues',
                    displayName: 'Parameter',
                    values: [
                      {
                        displayName: 'Key',
                        name: 'key',
                        type: 'string',
                        default: '',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                      },
                    ],
                  },
                ],
              },
              {
                displayName: 'Raw Body',
                name: 'rawBody',
                type: 'string',
                typeOptions: {
                  rows: 5,
                },
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['raw'],
                  },
                },
                default: '',
              },
              {
                displayName: 'Raw Content Type',
                name: 'rawContentType',
                type: 'string',
                displayOptions: {
                  show: {
                    sendBody: [true],
                    bodyContentType: ['raw'],
                  },
                },
                default: 'text/plain',
                placeholder: 'application/xml, application/graphql, etc.',
              },
              {
                displayName: 'Response Data Path',
                name: 'dataPath',
                type: 'string',
                default: '',
                placeholder: 'e.g. data.items or result[0]',
                description:
                  'Dot/bracket notation path to extract from the response (empty returns full response)',
              },
              {
                displayName: 'Retry Attempts',
                name: 'retryAttempts',
                type: 'number',
                default: 0,
                description: 'Number of times to retry this endpoint on HTTP error',
              },
              {
                displayName: 'Send Body',
                name: 'sendBody',
                type: 'boolean',
                default: false,
                description: 'Whether to include a request body with this endpoint',
              },
              {
                displayName: 'Timeout (Ms)',
                name: 'timeoutMs',
                type: 'number',
                default: 500,
                description: 'Request timeout in milliseconds (default: 500ms)',
              },
              {
                displayName: 'URL / Path',
                name: 'url',
                type: 'string',
                default: '',
                placeholder: 'https://api.example.com/items or /relative/path',
                description:
                  'Full URL or relative path if Base URL is defined. Supports expressions like {{$pipeline.auth.data.ID}}.',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Global Settings',
        name: 'globalSettings',
        type: 'collection',
        placeholder: 'Add Global Setting',
        default: {},
        options: [
          {
            displayName: 'Authentication Type',
            name: 'authType',
            type: 'options',
            options: [
              { name: 'Basic Auth', value: 'basic' },
              { name: 'Bearer Token', value: 'bearer' },
              { name: 'Custom Header', value: 'header' },
              { name: 'None', value: 'none' },
            ],
            default: 'none',
          },
          {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: '',
            placeholder: 'https://api.example.com/v1',
            description: 'Optional default URL prefix for relative endpoint paths',
          },
          {
            displayName: 'Bearer Token',
            name: 'bearerToken',
            type: 'string',
            typeOptions: { password: true },
            displayOptions: {
              show: {
                authType: ['bearer'],
              },
            },
            default: '',
          },
          {
            displayName: 'Concurrency Limit',
            name: 'concurrencyLimit',
            type: 'number',
            default: 5,
            description: 'Maximum concurrent requests when running in parallel mode',
          },
          {
            displayName: 'Delay Between Steps (Ms)',
            name: 'delayBetweenStepsMs',
            type: 'number',
            default: 0,
            description: 'Pause duration between consecutive requests in pipeline mode',
          },
          {
            displayName: 'Header Name',
            name: 'headerAuthName',
            type: 'string',
            displayOptions: {
              show: {
                authType: ['header'],
              },
            },
            default: 'X-API-Key',
          },
          {
            displayName: 'Header Value',
            name: 'headerAuthValue',
            type: 'string',
            typeOptions: { password: true },
            displayOptions: {
              show: {
                authType: ['header'],
              },
            },
            default: '',
          },
          {
            displayName: 'Output Mode',
            name: 'outputMode',
            type: 'options',
            options: [
              {
                name: 'All Responses as Array',
                value: 'allAsArray',
                description: 'Output [ step1Response, step2Response, ... ].',
              },
              {
                name: 'All Responses as Object (Keyed by Alias)',
                value: 'allAsObject',
                description: 'Output { step1: { data, status }, step2: { ... } }.',
              },
              {
                name: 'Last Step Only',
                value: 'lastStepOnly',
                description: 'Output data only from the final executed endpoint',
              },
              {
                name: 'Merge Into Input Item',
                value: 'mergeIntoInput',
                description: 'Merge output properties into the incoming $JSON object',
              },
              {
                name: 'Split Each Response to New Item',
                value: 'splitToItems',
                description: 'Emit an n8n item for each endpoint execution',
              },
            ],
            default: 'allAsObject',
            description: 'How the collected responses should be structured in n8n output',
          },
          {
            displayName: 'Password',
            name: 'basicAuthPass',
            type: 'string',
            typeOptions: { password: true },
            displayOptions: {
              show: {
                authType: ['basic'],
              },
            },
            default: '',
          },
          {
            displayName: 'Timeout (Ms)',
            name: 'timeoutMs',
            type: 'number',
            default: 500,
            description: 'Global request timeout in milliseconds (default: 500ms)',
          },
          {
            displayName: 'Username',
            name: 'basicAuthUser',
            type: 'string',
            displayOptions: {
              show: {
                authType: ['basic'],
              },
            },
            default: '',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const mode = this.getNodeParameter('mode', itemIndex, 'pipeline') as
          | 'pipeline'
          | 'parallel';
        const rawEndpoints = this.getNodeParameter(
          'endpoints.endpointValues',
          itemIndex,
          [],
        ) as any[];
        const globalConfig = this.getNodeParameter(
          'globalSettings',
          itemIndex,
          {},
        ) as Record<string, any>;

        const globalTimeout = (this.getNodeParameter('timeoutMs', itemIndex, 500) ??
          globalConfig.timeoutMs ??
          500) as number;

        // Construct Global Settings
        const globalSettings: GlobalPipeSettings = {
          baseUrl: globalConfig.baseUrl || undefined,
          authType: globalConfig.authType || 'none',
          bearerToken: globalConfig.bearerToken,
          headerAuthName: globalConfig.headerAuthName || 'Authorization',
          headerAuthValue: globalConfig.headerAuthValue,
          basicAuthUser: globalConfig.basicAuthUser,
          basicAuthPass: globalConfig.basicAuthPass,
          delayBetweenStepsMs: globalConfig.delayBetweenStepsMs || 0,
          concurrencyLimit: globalConfig.concurrencyLimit || 5,
          timeoutMs: globalTimeout,
        };

        const topResponseMode = this.getNodeParameter(
          'responseMode',
          itemIndex,
          '',
        ) as string;
        const outputMode = (topResponseMode ||
          globalConfig.outputMode ||
          'mergeAllToObject') as OutputAggregationMode;

        // Normalize Endpoints
        const endpoints: EndpointDefinition[] = rawEndpoints.map((ep, idx) => {
          let bodyPayload = ep.bodyPayload;
          if (ep.bodyContentType === 'raw' && ep.rawBody) {
            bodyPayload = ep.rawBody;
          }

          return {
            alias: ep.alias ? ep.alias.trim() : `step_${idx + 1}`,
            method: ep.method || 'GET',
            url: ep.url || '',
            dataPath: ep.dataPath || undefined,
            headers: ep.headers?.headerValues || [],
            queryParams: ep.queryParams?.paramValues || [],
            sendBody: ep.sendBody === true,
            bodyContentType: ep.bodyContentType || 'json',
            bodyInputMethod: ep.bodyJsonType || 'jsonEditor',
            bodyPayload: bodyPayload || undefined,
            bodyFields: ep.bodyFields?.fieldValues || [],
            formFields: ep.formFields?.fieldValues || [],
            rawContentType: ep.rawContentType || 'text/plain',
            continueOnFail: ep.continueOnFail === true,
            timeoutMs:
              ep.timeoutMs !== undefined && ep.timeoutMs !== null
                ? ep.timeoutMs
                : globalTimeout,
            retryAttempts: ep.retryAttempts || 0,
            retryDelayMs: 500,
          };
        });

        if (endpoints.length === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'At least one endpoint must be defined in Fox Multi-Endpoint Pipe',
            { itemIndex },
          );
        }

        // Initialize Runtime Context
        const context: PipelineRuntimeContext = {
          json: items[itemIndex].json,
          pipeline: {},
          steps: [],
          prev: undefined,
          itemIndex,
        };

        // HTTP helper wrapper
        const httpHelper = async (opts: any) => {
          return await this.helpers.httpRequest(opts);
        };

        if (mode === 'pipeline') {
          // --- Sequential Pipeline ---
          for (let sIdx = 0; sIdx < endpoints.length; sIdx++) {
            const ep = endpoints[sIdx];

            if (
              sIdx > 0 &&
              globalSettings.delayBetweenStepsMs &&
              globalSettings.delayBetweenStepsMs > 0
            ) {
              await sleep(globalSettings.delayBetweenStepsMs);
            }

            const stepResult = await executeSingleEndpoint(
              ep,
              context,
              globalSettings,
              httpHelper,
            );

            context.pipeline[stepResult.alias] = stepResult;
            context.steps.push(stepResult);
            context.prev = stepResult;
          }
        } else {
          // --- Parallel Execution ---
          const concurrency = Math.max(1, globalSettings.concurrencyLimit || 5);
          const results: EndpointExecutionResult[] = [];

          for (let i = 0; i < endpoints.length; i += concurrency) {
            const batch = endpoints.slice(i, i + concurrency);
            const batchPromises = batch.map((ep) =>
              executeSingleEndpoint(ep, context, globalSettings, httpHelper),
            );
            const settled = await Promise.allSettled(batchPromises);

            for (let bIdx = 0; bIdx < settled.length; bIdx++) {
              const res = settled[bIdx];
              const ep = batch[bIdx];
              if (res.status === 'fulfilled') {
                results.push(res.value);
                context.pipeline[res.value.alias] = res.value;
                context.steps.push(res.value);
              } else {
                if (ep.continueOnFail) {
                  const failedRes: EndpointExecutionResult = {
                    alias: ep.alias,
                    statusCode: 500,
                    success: false,
                    data: null,
                    error: res.reason?.message || String(res.reason),
                    durationMs: 0,
                  };
                  results.push(failedRes);
                  context.pipeline[ep.alias] = failedRes;
                  context.steps.push(failedRes);
                } else {
                  throw new NodeOperationError(
                    this.getNode(),
                    `Parallel endpoint "${ep.alias}" failed: ${res.reason?.message || res.reason}`,
                    { itemIndex },
                  );
                }
              }
            }
          }
        }

        // Format Output Data
        const formattedItems = formatExecutionOutput(
          context,
          outputMode,
          items[itemIndex],
        );
        returnData.push(...formattedItems);
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, {
          itemIndex,
        });
      }
    }

    return [returnData];
  }
}

function formatExecutionOutput(
  context: PipelineRuntimeContext,
  outputMode: OutputAggregationMode,
  originalItem: INodeExecutionData,
): INodeExecutionData[] {
  switch (outputMode) {
    case 'firstResponse': {
      const firstStep = context.steps[0];
      const rawData = firstStep?.data !== undefined ? firstStep.data : {};
      const json =
        typeof rawData === 'object' && rawData !== null
          ? rawData
          : { data: rawData };
      return [
        {
          json,
          pairedItem: { item: context.itemIndex },
        },
      ];
    }

    case 'lastResponse':
    case 'lastStepOnly': {
      const lastStep =
        context.prev || context.steps[context.steps.length - 1];
      const rawData = lastStep?.data !== undefined ? lastStep.data : {};
      const json =
        typeof rawData === 'object' && rawData !== null
          ? rawData
          : { data: rawData };
      return [
        {
          json,
          pairedItem: { item: context.itemIndex },
        },
      ];
    }

    case 'allAsArray': {
      return [
        {
          json: {
            results: context.steps.map((s) => ({
              alias: s.alias,
              statusCode: s.statusCode,
              success: s.success,
              data: s.data,
              error: s.error,
              durationMs: s.durationMs,
            })),
          },
          pairedItem: { item: context.itemIndex },
        },
      ];
    }

    case 'splitToItems': {
      return context.steps.map((s) => ({
        json: {
          alias: s.alias,
          statusCode: s.statusCode,
          success: s.success,
          data: s.data,
          error: s.error,
          durationMs: s.durationMs,
        },
        pairedItem: { item: context.itemIndex },
      }));
    }

    case 'mergeIntoInput': {
      const stepMap: Record<string, any> = {};
      for (const s of context.steps) {
        stepMap[s.alias] = s.data;
      }
      return [
        {
          json: {
            ...originalItem.json,
            ...stepMap,
          },
          pairedItem: { item: context.itemIndex },
        },
      ];
    }

    case 'mergeAllToObject':
    case 'allAsObject':
    default: {
      const outputObj: Record<string, any> = {};
      for (const s of context.steps) {
        outputObj[s.alias] = {
          statusCode: s.statusCode,
          success: s.success,
          data: s.data,
          error: s.error,
          durationMs: s.durationMs,
        };
      }
      return [
        {
          json: outputObj,
          pairedItem: { item: context.itemIndex },
        },
      ];
    }
  }
}
