/**
 * Safely extracts a nested property using dot/bracket notation.
 * e.g., "data.users[0].id" or "response.body"
 */
export function extractByPath(source: any, path?: string): any {
  if (!path || path.trim() === '' || source === null || source === undefined) {
    return source;
  }

  const cleanPath = path.trim().replace(/^(\$json\.|\$response\.|\$data\.)/, '');
  const segments = cleanPath
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current = source;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Key-value array to object converter.
 */
export function keyValueArrayToObject(
  entries?: Array<{ key: string; value: string }> | Record<string, string>
): Record<string, string> {
  if (!entries) return {};
  if (!Array.isArray(entries)) {
    return { ...entries };
  }
  const result: Record<string, string> = {};
  for (const item of entries) {
    if (item.key && item.key.trim() !== '') {
      result[item.key.trim()] = item.value ?? '';
    }
  }
  return result;
}
