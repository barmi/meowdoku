type JsonObject = Record<string, unknown>;

const object = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/**
 * RFC 7396 방식의 JSON Merge Patch를 만든다.
 * 배열은 통째로 바꾸고, 객체 키 삭제는 null로 나타낸다. 변경이 없으면 undefined다.
 */
export function createMergePatch(before: unknown, after: unknown): unknown | undefined {
  if (JSON.stringify(before) === JSON.stringify(after)) return undefined;
  if (!object(before) || !object(after)) return clone(after);

  const patch: JsonObject = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      patch[key] = null;
      continue;
    }
    const change = createMergePatch(before[key], after[key]);
    if (change !== undefined) patch[key] = change;
  }
  return Object.keys(patch).length ? patch : undefined;
}

/** JSON Merge Patch를 적용한다. 입력은 바꾸지 않고 새 값을 반환한다. */
export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (!object(patch)) return clone(patch);
  const out: JsonObject = object(target) ? clone(target) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    if (value === null) delete out[key];
    else out[key] = applyMergePatch(out[key], value);
  }
  return out;
}
