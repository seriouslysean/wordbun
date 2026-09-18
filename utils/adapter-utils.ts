import type { DictionaryDefinition, DictionaryResponse, WordData, WordProcessedData } from '#types';
import { isBasePartOfSpeech } from '#constants/parts-of-speech';
import { flattenErrors, getErrorMessage } from '#utils/text-utils';
import { findValidDefinition } from '#utils/word-data-utils';

/**
 * The dictionary has no entry for the word: a misspelling, or a word it does
 * not carry. Expected input, not a fault. Callers classify by type, never by
 * message, so a suggestion list or a word that happens to contain "429"
 * cannot change the verdict.
 */
export class WordNotFoundError extends Error {
  name = 'WordNotFoundError';
}

/**
 * The dictionary refused the request because too many were sent (HTTP 429).
 * Worth backing off and retrying.
 */
export class RateLimitError extends Error {
  name = 'RateLimitError';
}

/**
 * True when every adapter that was asked said the word does not exist, so a
 * rate limit or an outage anywhere in the fallback chain is not reported as
 * a misspelling.
 */
export const isWordNotFound = (error: unknown): boolean =>
  flattenErrors(error).every(failure => failure instanceof WordNotFoundError);

/**
 * True when any adapter in the fallback chain was rate limited.
 */
export const isRateLimited = (error: unknown): boolean =>
  flattenErrors(error).some(failure => failure instanceof RateLimitError);

/**
 * Deadline for a single dictionary API request. Without one, a connection
 * that is accepted but never answered hangs the CLI indefinitely.
 */
export const ADAPTER_FETCH_TIMEOUT_MS = 15000;

/**
 * Wraps fetch to convert network-level failures (DNS, connection refused,
 * timeout) into descriptive errors with adapter context.
 * fetch throws TypeError on network failures and a TimeoutError DOMException
 * when the deadline passes — this ensures callers get a meaningful message
 * instead of a raw "fetch failed" or "The operation was aborted".
 */
export async function adapterFetch(url: string, adapterName: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`${adapterName} request timed out after ${ADAPTER_FETCH_TIMEOUT_MS}ms`, { cause: error });
    }
    throw new Error(`${adapterName} network request failed: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Throws a structured error for non-OK HTTP responses.
 * Handles 429 (rate limit), 404 (not found), and generic failures.
 */
export function throwOnHttpError(response: Response, word: string): void {
  if (response.status === 429) {
    throw new RateLimitError('Rate limit exceeded. Please try again later.');
  }
  if (response.status === 404) {
    throwWordNotFound(word);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch word data: ${response.statusText}`);
  }
}

/**
 * Reads a response body as text, adding adapter context to read failures.
 * The adapterFetch deadline also aborts a stalled body, which would otherwise
 * surface as an anonymous TimeoutError.
 */
async function readResponseText(response: Response, apiName: string): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to read ${apiName} response body: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Parses a fetch response as JSON with defensive error handling.
 * Surfaces the raw response text on parse failure for debugging.
 * The body is read once as text: a Response body can only be consumed once,
 * so falling back to text() after a failed json() would throw instead.
 */
export async function parseJsonResponse(response: Response, apiName: string): Promise<unknown> {
  const text = await readResponseText(response, apiName);
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    throw new Error(`Invalid API response (not JSON) from ${apiName}. Response: ${text.slice(0, 200)}`, { cause: error });
  }
}

/**
 * Throws "word not found" with a consistent message.
 */
export function throwWordNotFound(word: string): never {
  throw new WordNotFoundError(`Word "${word}" not found in dictionary. Please check the spelling.`);
}

/**
 * Throws when a 2xx response parsed as JSON but is not the shape the adapter
 * reads. Names the adapter so a fallback log says which API changed.
 */
export function throwUnexpectedShape(apiName: string, word: string): never {
  throw new Error(`${apiName} returned an unexpected response shape for "${word}"`);
}

/**
 * Normalizes a raw POS string using the provided adapter-specific map.
 * Returns a base POS, a mapped POS, or undefined for unmappable values.
 */
export function normalizePOS(raw: string, posMap: Record<string, string>): string | undefined {
  const cleaned = raw.toLowerCase().trim();
  if (isBasePartOfSpeech(cleaned)) {
    return cleaned;
  }
  return posMap[cleaned];
}

/**
 * Assembles the standard DictionaryResponse envelope used by all adapters.
 * Every field is reported as supplied, the word included: case is the
 * caller's decision (--preserve-case), not the adapter's.
 */
export function buildDictionaryResponse(
  word: string,
  definitions: DictionaryDefinition[],
  source: string,
  attribution: string,
  url: string,
  headword?: DictionaryResponse['headword'],
): DictionaryResponse {
  return {
    word,
    definitions,
    meta: { source, attribution, url },
    ...(headword && Object.values(headword).some(Boolean) ? { headword } : {}),
  };
}

/**
 * Shared transformToWordData for all adapters.
 * Converts a DictionaryResponse + date into the stored WordData format.
 */
export function transformToWordData(adapterName: string, response: DictionaryResponse, date: string): WordData {
  return {
    word: response.word,
    date,
    adapter: adapterName,
    data: response.definitions,
    rawData: response,
  };
}

/**
 * Shared transformWordData for all adapters.
 * Extracts the first valid definition for display.
 * Optional processText hook for adapter-specific text transforms (e.g. Wordnik xrefs).
 */
export function transformWordData(
  wordData: WordData,
  defaultAttribution: string,
  processText?: (text: string) => string,
): WordProcessedData {
  if (!wordData?.data || wordData.data.length === 0) {
    return { partOfSpeech: '', definition: '', meta: null };
  }

  const validDefinition = findValidDefinition(wordData.data);
  if (!validDefinition) {
    return { partOfSpeech: '', definition: '', meta: null };
  }

  const fullDefinition = wordData.data.find(d => d.partOfSpeech === validDefinition.partOfSpeech);
  const text = processText ? processText(validDefinition.text) : validDefinition.text;

  return {
    partOfSpeech: validDefinition.partOfSpeech,
    definition: text,
    meta: {
      attributionText: fullDefinition?.attributionText || defaultAttribution,
      sourceDictionary: fullDefinition?.sourceDictionary,
      sourceUrl: fullDefinition?.sourceUrl || '',
    },
  };
}
