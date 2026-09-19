import type {
  DictionaryClassification, DictionaryDefinition, DictionaryResponse, WordData, WordProcessedData,
} from '#types';
import { type BasePartOfSpeech, isBasePartOfSpeech } from '#constants/parts-of-speech';
import { flattenErrors, getErrorMessage } from '#utils/text-utils';
import { isNonblankString, isOptional, isRecord, isString } from '#utils/type-guards';
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
export function normalizePOS(raw: string, posMap: Readonly<Record<string, BasePartOfSpeech>>): BasePartOfSpeech | undefined {
  const cleaned = raw.toLowerCase().trim();
  if (isBasePartOfSpeech(cleaned)) {
    return cleaned;
  }
  // Own keys only: a term such as "constructor" must not read Object.prototype
  return Object.hasOwn(posMap, cleaned) ? posMap[cleaned] : undefined;
}

/**
 * Translates a partner's raw part-of-speech term into the canonical
 * classification: the vocabulary value it maps to, or, when it maps to none,
 * the raw term as `label` so it is kept rather than silently dropped. No term
 * means no classification.
 */
export function classifyPartOfSpeech(
  raw: string | undefined,
  posMap: Readonly<Record<string, BasePartOfSpeech>>,
): DictionaryClassification {
  if (!isNonblankString(raw)) {
    return {};
  }
  const partOfSpeech = normalizePOS(raw, posMap);
  return partOfSpeech ? { partOfSpeech } : { label: raw };
}

/**
 * A definition as an adapter has read it from its partner: the text, the raw
 * part-of-speech term, and whatever optional values the partner supplied,
 * which may be missing, blank or empty.
 */
export interface DefinitionSource {
  text: string;
  partOfSpeech?: string;
  id?: string;
  attributionText?: string;
  sourceDictionary?: string;
  sourceUrl?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
}

const nonblankEntries = (values: string[] | undefined): string[] => values?.filter(isNonblankString) ?? [];

/**
 * Builds a canonical definition from what an adapter read. The part of speech
 * is classified through the adapter's map, and an optional value that is
 * missing, blank or empty is omitted, as is a blank entry in a list, so no
 * stored record carries `""` or `[]`. Keys follow the order stored records
 * already use.
 */
export function buildDefinition(
  source: DefinitionSource,
  posMap: Readonly<Record<string, BasePartOfSpeech>>,
): DictionaryDefinition {
  const { text, partOfSpeech, id, attributionText, sourceDictionary, sourceUrl } = source;
  const examples = nonblankEntries(source.examples);
  const synonyms = nonblankEntries(source.synonyms);
  const antonyms = nonblankEntries(source.antonyms);
  return {
    ...(isNonblankString(id) ? { id } : {}),
    ...classifyPartOfSpeech(partOfSpeech, posMap),
    text,
    ...(isNonblankString(attributionText) ? { attributionText } : {}),
    ...(isNonblankString(sourceDictionary) ? { sourceDictionary } : {}),
    ...(isNonblankString(sourceUrl) ? { sourceUrl } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(synonyms.length > 0 ? { synonyms } : {}),
    ...(antonyms.length > 0 ? { antonyms } : {}),
  };
}

/**
 * Assembles the standard DictionaryResponse envelope used by all adapters.
 * Every field is reported as supplied, the word included: case is the
 * caller's decision (--preserve-case), not the adapter's. A blank attribution
 * or URL and a blank headword field are omitted, and so is a headword with
 * nothing left in it. A definition whose text is blank is dropped: a partner
 * sense with nothing to show (Wordnik's optional text, a blank
 * Merriam-Webster shortdef) is not a reason to refuse the others. A response
 * left with no definition is the partner not having the word.
 */
export function buildDictionaryResponse(
  word: string,
  definitions: DictionaryDefinition[],
  source: string,
  attribution: string | undefined,
  url: string | undefined,
  headword?: DictionaryResponse['headword'],
): DictionaryResponse {
  const { pronunciation, audio, etymology } = headword ?? {};
  const captured = {
    ...(isNonblankString(pronunciation) ? { pronunciation } : {}),
    ...(isNonblankString(audio) ? { audio } : {}),
    ...(isNonblankString(etymology) ? { etymology } : {}),
  };
  return {
    word,
    definitions: definitions.filter(definition => isNonblankString(definition.text)),
    meta: {
      source,
      ...(isNonblankString(attribution) ? { attribution } : {}),
      ...(isNonblankString(url) ? { url } : {}),
    },
    ...(Object.keys(captured).length > 0 ? { headword: captured } : {}),
  };
}

const RESPONSE_KEYS: ReadonlySet<string> = new Set(['word', 'definitions', 'meta', 'headword']);
const META_KEYS: ReadonlySet<string> = new Set(['source', 'attribution', 'url']);
const HEADWORD_KEYS: ReadonlySet<string> = new Set(['pronunciation', 'audio', 'etymology']);
const DEFINITION_KEYS: ReadonlySet<string> = new Set([
  'id', 'partOfSpeech', 'label', 'text', 'attributionText', 'sourceDictionary', 'sourceUrl',
  'examples', 'synonyms', 'antonyms',
]);

/**
 * True when the object carries no key outside the contract. A key whose value
 * is undefined counts as absent, as it does once written to JSON.
 */
const hasOnlyKeys = (value: Record<string, unknown>, keys: ReadonlySet<string>): boolean =>
  Object.entries(value).every(([key, field]) => field === undefined || keys.has(key));

const isHttpUrl = (value: unknown): value is string => {
  if (!isString(value) || !URL.canParse(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === 'https:' || protocol === 'http:';
};

const isNonblankStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(isNonblankString);

const isVocabularyPartOfSpeech = (value: unknown): value is BasePartOfSpeech =>
  isString(value) && isBasePartOfSpeech(value);

const isCanonicalDefinition = (value: unknown): value is DictionaryDefinition =>
  isRecord(value)
  && hasOnlyKeys(value, DEFINITION_KEYS)
  && isNonblankString(value.text)
  && isOptional(value.partOfSpeech, isVocabularyPartOfSpeech)
  && isOptional(value.label, isNonblankString)
  && (value.partOfSpeech === undefined || value.label === undefined)
  && isOptional(value.id, isNonblankString)
  && isOptional(value.attributionText, isNonblankString)
  && isOptional(value.sourceDictionary, isNonblankString)
  && isOptional(value.sourceUrl, isHttpUrl)
  && isOptional(value.examples, isNonblankStringList)
  && isOptional(value.synonyms, isNonblankStringList)
  && isOptional(value.antonyms, isNonblankStringList);

const isCanonicalMeta = (value: unknown): value is DictionaryResponse['meta'] =>
  isRecord(value)
  && hasOnlyKeys(value, META_KEYS)
  && isNonblankString(value.source)
  && isOptional(value.attribution, isNonblankString)
  && isOptional(value.url, isHttpUrl);

const isCanonicalHeadword = (value: unknown): value is NonNullable<DictionaryResponse['headword']> =>
  isRecord(value)
  && hasOnlyKeys(value, HEADWORD_KEYS)
  && Object.values(value).some(field => field !== undefined)
  && isOptional(value.pronunciation, isNonblankString)
  && isOptional(value.audio, isHttpUrl)
  && isOptional(value.etymology, isNonblankString);

/**
 * The canonical contract, checked at runtime: what an adapter returns must
 * be a DictionaryResponse for exactly the word requested, with at least one
 * definition, and every string, list and URL in it holding a real value.
 * fetchWithFallback applies it once to every adapter's answer, before asking
 * whether any definition is displayable, and refuses the whole response on
 * any violation: dropping only the offending definition would hide a partner
 * API that changed. Markup inside text is not judged here.
 */
export const isCanonicalResponse = (value: unknown, word: string): value is DictionaryResponse =>
  isRecord(value)
  && hasOnlyKeys(value, RESPONSE_KEYS)
  && value.word === word
  && Array.isArray(value.definitions) && value.definitions.length > 0
  && value.definitions.every(isCanonicalDefinition)
  && isCanonicalMeta(value.meta)
  && isOptional(value.headword, isCanonicalHeadword);

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
