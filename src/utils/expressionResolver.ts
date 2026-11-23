import { PipelineRuntimeContext } from '../types';
import { extractByPath } from './schemaMapper';

/**
 * Resolves template expressions in strings, objects, or arrays.
 * Handles tokens like:
 *   - {{ $json.userId }}
 *   - {{ $pipeline.auth.data.token }}
 *   - {{ $steps[0].data.id }}
 *   - {{ $prev.data }}
 */
export function resolveTemplateValue(template: any, context: PipelineRuntimeContext): any {
  if (template === null || template === undefined) {
    return template;
  }

  if (typeof template === 'string') {
    return evaluateTemplateString(template, context);
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolveTemplateValue(item, context));
  }

  if (typeof template === 'object') {
    const resolvedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(template)) {
      const resolvedKey = evaluateTemplateString(k, context);
      resolvedObj[typeof resolvedKey === 'string' ? resolvedKey : k] = resolveTemplateValue(v, context);
    }
    return resolvedObj;
  }

  return template;
}

/**
 * Resolves an individual string template.
 */
export function evaluateTemplateString(input: string, context: PipelineRuntimeContext): any {
  const trimmed = input.trim();

  // If the string is purely a single placeholder e.g. "{{ $pipeline.auth.data }}",
  // return the underlying raw value (preserves objects, numbers, booleans, arrays).
  const singlePlaceholderRegex = /^\{\{\s*([^{}]+?)\s*\}\}$/;
  const singleMatch = trimmed.match(singlePlaceholderRegex);
  if (singleMatch) {
    return resolveSingleToken(singleMatch[1], context);
  }

  // Otherwise, interpolate multiple occurrences as strings
  return input.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expression) => {
    const val = resolveSingleToken(expression, context);
    if (val === undefined || val === null) {
      return '';
    }
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  });
}

/**
 * Evaluates a single token or expression against the pipeline context.
 */
function resolveSingleToken(rawExpr: string, context: PipelineRuntimeContext): any {
  const expr = rawExpr.trim();

  // 1. $json.<path>
  if (expr === '$json') {
    return context.json;
  }
  if (expr.startsWith('$json.')) {
    return extractByPath(context.json, expr.slice(6));
  }

  // 2. $pipeline.<alias>.<path>
  if (expr === '$pipeline') {
    return context.pipeline;
  }
  if (expr.startsWith('$pipeline.')) {
    const remainder = expr.slice(10);
    const firstDot = remainder.indexOf('.');
    if (firstDot === -1) {
      return context.pipeline[remainder];
    }
    const alias = remainder.slice(0, firstDot);
    const subpath = remainder.slice(firstDot + 1);
    const stepResult = context.pipeline[alias];
    return stepResult ? extractByPath(stepResult, subpath) : undefined;
  }

  // 3. $steps[index].<path>
  const stepsMatch = expr.match(/^\$steps\[(\d+)\](?:\.(.+))?$/);
  if (stepsMatch) {
    const index = parseInt(stepsMatch[1], 10);
    const stepResult = context.steps[index];
    if (!stepResult) return undefined;
    const subpath = stepsMatch[2];
    return subpath ? extractByPath(stepResult, subpath) : stepResult;
  }

  // 4. $prev.<path>
  if (expr === '$prev') {
    return context.prev;
  }
  if (expr.startsWith('$prev.')) {
    return context.prev ? extractByPath(context.prev, expr.slice(6)) : undefined;
  }

  // 5. $itemIndex
  if (expr === '$itemIndex') {
    return context.itemIndex;
  }

  // 6. Direct property lookup on context.json as default fallback
  return extractByPath(context.json, expr);
}
