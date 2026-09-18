/**
 * Primitive type guards for narrowing `unknown` values at data boundaries
 * (API responses, parsed JSON). Shape-specific guards build on these.
 */

/**
 * True for plain key/value objects. Arrays and null are excluded so property
 * reads on the narrowed value are always safe.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

/**
 * True when the value is absent or satisfies the guard. JSON has no
 * `undefined`, so an optional field is either missing or must be well-formed.
 */
export const isOptional = <T>(value: unknown, guard: (candidate: unknown) => candidate is T): value is T | undefined =>
  value === undefined || guard(value);
