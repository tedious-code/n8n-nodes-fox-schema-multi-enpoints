import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import {
  EndpointDefinition,
  EndpointExecutionResult,
  GlobalPipeSettings,
  OutputAggregationMode,
  PipelineRuntimeContext,
} from '../../src/types';
import { executeSingleEndpoint } from '../../src/utils/httpClient';
import { extractByPath } from '../../src/utils/schemaMapper';

export class FoxSchemaMultiEndpoints implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Fox Multi-Endpoint Pipe',
    name: 'foxSchemaMultiEndpoints',
    icon: 'file:foxMultiPipe.svg',
    group: ['transform', 'output'],
    version: 1,
    subtitle: '={{$parameter["mode"]}}',
    description:
      'Execute multiple HTTP endpoints sequentially (pipeline) or in parallel with dynamic variable propagation',
    defaults: {
      name: 'Fox Multi-Endpoint Pipe',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Execution Mode',
        name: 'mode',
        type: 'options',
        options: [
          {
            name: 'Sequential Pipe (Chained)',
            value: 'pipeline',
            description:
              'Execute requests in order. Downstream requests can access prior responses via {{$pipeline.alias.data}}',
          },
          {
            name: 'Parallel (Concurrent)',
            value: 'parallel',
            description: 'Execute requests concurrently and aggregate all responses',
          },
        ],
        default: 'pipeline',
        description: 'How configured endpoints should be processed',
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
                displayName: 'Method',
                name: 'method',
                type: 'options',
                options: [
                  { name: 'GET', value: 'GET' },
                  { name: 'POST', value: 'POST' },
                  { name: 'PUT', value: 'PUT' },
                  { name: 'PATCH', value: 'PATCH' },
                  { name: 'DELETE', value: 'DELETE' },
                  { name: 'HEAD', value: 'HEAD' },
                ],
                default: 'GET',
              },
              {
                displayName: 'URL / Path',
                name: 'url',
                type: 'string',
                default: '',
                placeholder: 'https://api.example.com/items or /relative/path',
                description:
                  'Full URL or relative path if Base URL is defined. Supports expressions like {{$pipeline.auth.data.id}}',
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
                displayName: 'Send Body',
                name: 'sendBody',
                type: 'boolean',
                default: false,
                description: 'Whether to include a request body with this endpoint',
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
                  { name: 'JSON', value: 'json' },
                  { name: 'Form-Urlencoded', value: 'formUrlencoded' },
                  { name: 'Raw / Text / XML / GraphQL', value: 'raw' },
                ],
                default: 'json',
                description: 'Format of the request body',
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
                    name: 'JSON Editor / Expression',
                    value: 'jsonEditor',
                    description: 'Write raw JSON string or expression',
                  },
                  {
                    name: 'Fields (Key-Value Builder)',
                    value: 'fields',
                    description: 'Add individual JSON fields',
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
                  '{\n  "userId": "{{ $json.id }}",\n  "token": "{{ $pipeline.auth.data.token }}",\n  "items": {{ $pipeline.cart.data }}\n}',
                description:
                  'JSON payload to send with the request. Supports expressions like {{$pipeline.step1.data}}',
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
                          { name: 'String', value: 'string' },
                          { name: 'Number', value: 'number' },
                          { name: 'Boolean', value: 'boolean' },
                          { name: 'Object / Array (JSON)', value: 'json' },
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
                displayName: 'Continue on Fail',
                name: 'continueOnFail',
                type: 'boolean',
                default: false,
                description:
                  'Whether to continue pipeline execution if this endpoint fails',
              },
              {
                displayName: 'Retry Attempts',
                name: 'retryAttempts',
                type: 'number',
                default: 0,
                description: 'Number of times to retry this endpoint on HTTP error',
              },
              {
                displayName: 'Timeout (ms)',
                name: 'timeoutMs',
                type: 'number',
                default: 30000,
                description: 'Request timeout in milliseconds',
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
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: '',
            placeholder: 'https://api.example.com/v1',
            description: 'Optional default URL prefix for relative endpoint paths',
          },
          {
            displayName: 'Output Mode',
            name: 'outputMode',
            type: 'options',
            options: [
              {
                name: 'All Responses as Object (Keyed by Alias)',
                value: 'allAsObject',
                description: 'Output { step1: { data, status }, step2: { ... } }',
              },
              {
                name: 'Last Step Only',
                value: 'lastStepOnly',
                description: 'Output data only from the final executed endpoint',
              },
              {
                name: 'All Responses as Array',
                value: 'allAsArray',
                description: 'Output [ step1Response, step2Response, ... ]',
              },
              {
                name: 'Split Each Response to New Item',
                value: 'splitToItems',
                description: 'Emit an n8n item for each endpoint execution',
              },
              {
                name: 'Merge into Input Item',
                value: 'mergeIntoInput',
                description: 'Merge output properties into the incoming $json object',
              },
            ],
            default: 'allAsObject',
            description: 'How the collected responses should be structured in n8n output',
          },
          {
            displayName: 'Delay Between Steps (ms)',
            name: 'delayBetweenStepsMs',
            type: 'number',
            default: 0,
            description: 'Pause duration between consecutive requests in pipeline mode',
          },
          {
            displayName: 'Concurrency Limit',
            name: 'concurrencyLimit',
            type: 'number',
            default: 5,
            description: 'Maximum concurrent requests when running in parallel mode',
          },
          {
            displayName: 'Authentication Type',
            name: 'authType',
            type: 'options',
            options: [
              { name: 'None', value: 'none' },
              { name: 'Bearer Token', value: 'bearer' },
              { name: 'Custom Header', value: 'header' },
              { name: 'Basic Auth', value: 'basic' },
            ],
            default: 'none',
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
          []
        ) as any[];
        const globalConfig = this.getNodeParameter(
          'globalSettings',
          itemIndex,
          {}
        ) as Record<string, any>;

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
        };

        const outputMode = (globalConfig.outputMode ||
          'allAsObject') as OutputAggregationMode;

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
            timeoutMs: ep.timeoutMs || 30000,
            retryAttempts: ep.retryAttempts || 0,
            retryDelayMs: 500,
          };
        });

        if (endpoints.length === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'At least one endpoint must be defined in Fox Multi-Endpoint Pipe',
            { itemIndex }
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

            if (sIdx > 0 && globalSettings.delayBetweenStepsMs && globalSettings.delayBetweenStepsMs > 0) {
              await new Promise((res) =>
                setTimeout(res, globalSettings.delayBetweenStepsMs)
              );
            }

            const stepResult = await executeSingleEndpoint(
              ep,
              context,
              globalSettings,
              httpHelper
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
              executeSingleEndpoint(ep, context, globalSettings, httpHelper)
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
                    { itemIndex }
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
          items[itemIndex]
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
        throw error;
      }
    }

    return [returnData];
  }
}

function formatExecutionOutput(
  context: PipelineRuntimeContext,
  outputMode: OutputAggregationMode,
  originalItem: INodeExecutionData
): INodeExecutionData[] {
    switch (outputMode) {
      case 'lastStepOnly': {
        const lastStep = context.prev || context.steps[context.steps.length - 1];
        return [
          {
            json: lastStep?.data !== undefined ? lastStep.data : {},
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
          },
          pairedItem: { item: context.itemIndex },
        }));
      }

      case 'mergeIntoInput': {
        const merged: Record<string, any> = { ...originalItem.json };
        for (const s of context.steps) {
          merged[s.alias] = s.data;
        }
        return [
          {
            json: merged,
            pairedItem: { item: context.itemIndex },
          },
        ];
      }

      case 'allAsObject':
      default: {
        const objOutput: Record<string, any> = {};
        for (const s of context.steps) {
          objOutput[s.alias] = {
            statusCode: s.statusCode,
            success: s.success,
            data: s.data,
            durationMs: s.durationMs,
            ...(s.error ? { error: s.error } : {}),
          };
        }
        return [
          {
            json: objOutput,
            pairedItem: { item: context.itemIndex },
          },
        ];
      }
    }
}
