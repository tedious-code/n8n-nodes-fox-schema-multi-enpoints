import {
  EndpointDefinition,
  EndpointExecutionResult,
  GlobalPipeSettings,
  PipelineRuntimeContext,
} from '../types';
import { resolveTemplateValue } from './expressionResolver';
import { extractByPath, keyValueArrayToObject } from './schemaMapper';

export interface HttpRequestHelper {
  (options: any): Promise<any>;
}

/**
 * Builds the effective target URL.
 */
export function buildTargetUrl(rawUrl: string, baseUrl?: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (!baseUrl) {
    return trimmed;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Executes a single endpoint with retry logic and template resolution.
 */
export async function executeSingleEndpoint(
  endpoint: EndpointDefinition,
  context: PipelineRuntimeContext,
  globalSettings: GlobalPipeSettings,
  httpHelper?: HttpRequestHelper
): Promise<EndpointExecutionResult> {
  const startTime = Date.now();
  const alias = endpoint.alias || `step_${context.steps.length + 1}`;

  // 1. Resolve Dynamic URL
  const resolvedRawUrl = resolveTemplateValue(endpoint.url, context);
  const targetUrl = buildTargetUrl(String(resolvedRawUrl), globalSettings.baseUrl);

  // 2. Resolve Headers
  const baseHeaders = keyValueArrayToObject(globalSettings.defaultHeaders);
  const endpointHeaders = keyValueArrayToObject(endpoint.headers);
  const mergedHeaders: Record<string, string> = {
    ...baseHeaders,
    ...endpointHeaders,
  };

  // Resolve headers dynamic values
  const resolvedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(mergedHeaders)) {
    resolvedHeaders[k] = String(resolveTemplateValue(v, context));
  }

  // Apply Global Auth if not overridden in headers
  if (globalSettings.authType === 'bearer' && globalSettings.bearerToken && !resolvedHeaders['Authorization']) {
    resolvedHeaders['Authorization'] = `Bearer ${globalSettings.bearerToken}`;
  } else if (globalSettings.authType === 'header' && globalSettings.headerAuthName && globalSettings.headerAuthValue) {
    resolvedHeaders[globalSettings.headerAuthName] = globalSettings.headerAuthValue;
  } else if (globalSettings.authType === 'basic' && globalSettings.basicAuthUser) {
    const creds = Buffer.from(
      `${globalSettings.basicAuthUser}:${globalSettings.basicAuthPass || ''}`
    ).toString('base64');
    resolvedHeaders['Authorization'] = `Basic ${creds}`;
  }

  // 3. Resolve Query Params
  const queryParamsObj = keyValueArrayToObject(endpoint.queryParams);
  const resolvedQueryParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(queryParamsObj)) {
    resolvedQueryParams[k] = String(resolveTemplateValue(v, context));
  }

  // 4. Resolve Body
  let resolvedBody: any = undefined;
  const shouldSendBody =
    endpoint.sendBody === true ||
    (endpoint.sendBody === undefined &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method) &&
      (Boolean(endpoint.bodyPayload) ||
        Boolean(endpoint.bodyFields?.length) ||
        Boolean(endpoint.formFields?.length)));

  if (shouldSendBody) {
    const contentType = endpoint.bodyContentType || 'json';

    if (contentType === 'json') {
      if (endpoint.bodyInputMethod === 'fields' && endpoint.bodyFields && endpoint.bodyFields.length > 0) {
        const bodyObj: Record<string, any> = {};
        for (const f of endpoint.bodyFields) {
          if (!f.key) continue;
          const evaluated = resolveTemplateValue(f.value, context);
          if (f.type === 'number') {
            bodyObj[f.key] = Number(evaluated);
          } else if (f.type === 'boolean') {
            bodyObj[f.key] = String(evaluated).toLowerCase() === 'true';
          } else if (f.type === 'json') {
            try {
              bodyObj[f.key] = typeof evaluated === 'string' ? JSON.parse(evaluated) : evaluated;
            } catch {
              bodyObj[f.key] = evaluated;
            }
          } else {
            bodyObj[f.key] = evaluated;
          }
        }
        resolvedBody = bodyObj;
      } else if (endpoint.bodyPayload) {
        const strResolved = resolveTemplateValue(endpoint.bodyPayload, context);
        if (typeof strResolved === 'string') {
          try {
            resolvedBody = JSON.parse(strResolved);
          } catch {
            resolvedBody = strResolved;
          }
        } else {
          resolvedBody = strResolved;
        }
      }
      if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
        resolvedHeaders['Content-Type'] = 'application/json';
      }
    } else if (contentType === 'formUrlencoded') {
      const searchParams = new URLSearchParams();
      if (endpoint.formFields && endpoint.formFields.length > 0) {
        for (const item of endpoint.formFields) {
          if (item.key) {
            searchParams.append(item.key, String(resolveTemplateValue(item.value, context)));
          }
        }
      }
      resolvedBody = searchParams.toString();
      if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
        resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (contentType === 'raw') {
      resolvedBody = resolveTemplateValue(endpoint.bodyPayload || '', context);
      if (endpoint.rawContentType && !resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
        resolvedHeaders['Content-Type'] = endpoint.rawContentType;
      }
    }
  }

  // 5. Execution parameters
  const isJsonBody =
    (endpoint.bodyContentType === 'json' || !endpoint.bodyContentType) &&
    typeof resolvedBody === 'object' &&
    resolvedBody !== null;

  const requestOptions: any = {
    method: endpoint.method,
    url: targetUrl,
    headers: resolvedHeaders,
    qs: resolvedQueryParams,
    body: resolvedBody,
    json: isJsonBody,
    timeout: endpoint.timeoutMs || 30000,
    returnFullResponse: true,
  };

  const maxAttempts = Math.max(1, (endpoint.retryAttempts || 0) + 1);
  const retryDelay = endpoint.retryDelayMs || 500;

  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let rawResponse: any;

      if (httpHelper) {
        rawResponse = await httpHelper(requestOptions);
      } else {
        // Fallback using global fetch (Node 18+)
        rawResponse = await performNativeFetch(requestOptions);
      }

      const durationMs = Date.now() - startTime;
      const statusCode = rawResponse.statusCode || rawResponse.status || 200;
      let responseBody = rawResponse.body !== undefined ? rawResponse.body : rawResponse.data;

      // Extract path if specified
      if (endpoint.dataPath) {
        responseBody = extractByPath(responseBody, endpoint.dataPath);
      }

      return {
        alias,
        statusCode,
        success: true,
        data: responseBody,
        headers: rawResponse.headers,
        durationMs,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, retryDelay * attempt));
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const errorMessage = lastError?.message || String(lastError);

  if (endpoint.continueOnFail) {
    return {
      alias,
      statusCode: lastError?.statusCode || 500,
      success: false,
      data: null,
      error: errorMessage,
      durationMs,
    };
  }

  throw new Error(`Endpoint "${alias}" failed: ${errorMessage}`);
}

/**
 * Fallback HTTP executor using Node's native fetch.
 */
async function performNativeFetch(options: any): Promise<any> {
  const urlObj = new URL(options.url);
  if (options.qs) {
    for (const [k, v] of Object.entries(options.qs)) {
      if (v !== undefined && v !== null) {
        urlObj.searchParams.append(k, String(v));
      }
    }
  }

  const init: RequestInit = {
    method: options.method,
    headers: options.headers,
  };

  if (options.body) {
    if (typeof options.body === 'object') {
      init.body = JSON.stringify(options.body);
    } else {
      init.body = String(options.body);
    }
  }

  const response = await fetch(urlObj.toString(), init);
  const contentType = response.headers.get('content-type') || '';
  let body: any;

  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text();
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (!response.ok) {
    const error: any = new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    error.statusCode = response.status;
    error.body = body;
    throw error;
  }

  return {
    statusCode: response.status,
    body,
    headers,
  };
}
