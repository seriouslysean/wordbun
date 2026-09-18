import { decodeHTML } from 'entities';

import type {
  DictionaryAdapter,
  DictionaryResponse,
  WordnikConfig,
  WordnikDefinition,
} from '#types';
import type { BasePartOfSpeech } from '#constants/parts-of-speech';
import {
  adapterFetch,
  buildDefinition,
  buildDictionaryResponse,
  parseJsonResponse,
  throwOnHttpError,
  throwUnexpectedShape,
  throwWordNotFound,
  transformToWordData,
  transformWordData,
} from '#utils/adapter-utils';
import { isOptional, isRecord, isString, isStringArray } from '#utils/type-guards';

/**
 * Maps Wordnik POS strings to elementary POS types.
 * A value not in this map and not already a base POS is kept as the
 * definition's `label` instead of a part of speech.
 */
const POS_MAP = {
  'auxiliary-verb': 'verb',
  'intransitive verb': 'verb',
  'transitive verb': 'verb',
  'phrasal verb': 'verb',
  'proper-noun': 'noun',
  'noun-plural': 'noun',
  'proper noun': 'noun',
  'noun plural': 'noun',
} satisfies Readonly<Record<string, BasePartOfSpeech>>;

/**
 * Configuration constants for Wordnik API integration
 */
export const CONFIG: WordnikConfig = {
  BASE_URL: process.env.WORDNIK_API_URL,
  DEFAULT_LIMIT: 10,
  /** Delay between requests in milliseconds (1 second - Wordnik API best practice) */
  RATE_LIMIT_DELAY: 1000,
  /** Backoff delay after rate limit hit (65 seconds - slightly over 1 minute per Wordnik 429 docs) */
  RATE_LIMIT_BACKOFF: 65000,
};


// Wordnik's ExampleUsage model declares `text` optional, so an example without
// it is well-formed; fetchWordData skips it rather than refusing the response.
const isExampleUses = (value: unknown): value is NonNullable<WordnikDefinition['exampleUses']> =>
  Array.isArray(value) && value.every(example => isRecord(example) && isOptional(example.text, isString));

const isRelatedWords = (value: unknown): value is NonNullable<WordnikDefinition['relatedWords']> =>
  Array.isArray(value) && value.every(related => isRecord(related) && isOptional(related.words, isStringArray));

const isTextProns = (value: unknown): value is NonNullable<WordnikDefinition['textProns']> =>
  Array.isArray(value) && value.every(pron => isRecord(pron) && isOptional(pron.raw, isString));

/**
 * Checks every field fetchWordData reads from a definition, including the
 * `words` of each relatedWords entry and the `raw` of each textProns entry.
 * All are optional in Wordnik's responses, so a field is either absent or must
 * have the read type.
 */
const isWordnikDefinition = (value: unknown): value is WordnikDefinition =>
  isRecord(value)
  && isOptional(value.id, isString)
  && isOptional(value.partOfSpeech, isString)
  && isOptional(value.text, (text): text is string | string[] => isString(text) || isStringArray(text))
  && isOptional(value.attributionText, isString)
  && isOptional(value.sourceDictionary, isString)
  && isOptional(value.wordnikUrl, isString)
  && isOptional(value.attributionUrl, isString)
  && isOptional(value.exampleUses, isExampleUses)
  && isOptional(value.relatedWords, isRelatedWords)
  && isOptional(value.textProns, isTextProns);

export const isWordnikDefinitions = (value: unknown): value is WordnikDefinition[] =>
  Array.isArray(value) && value.every(isWordnikDefinition);

/**
 * Fetches definitions from Wordnik for a single word.
 * Throws on rate-limit (429), server errors, 404, or empty results.
 */
async function fetchDefinitions(word: string, buildUrl: (w: string) => string): Promise<WordnikDefinition[]> {
  const response = await adapterFetch(buildUrl(word), 'Wordnik');
  throwOnHttpError(response, word);

  const data = await parseJsonResponse(response, 'Wordnik');
  if (!isWordnikDefinitions(data)) {
    throwUnexpectedShape('Wordnik', word);
  }
  if (data.length === 0) {
    throwWordNotFound(word);
  }
  return data;
}

/**
 * Wordnik adapter implementing the generic DictionaryAdapter interface.
 * Provides methods to fetch, transform, and validate word data from the Wordnik API.
 */
export const wordnikAdapter: DictionaryAdapter = {
  name: 'wordnik',

  /**
   * Fetches word data from the Wordnik API
   * @param word - The word to look up (with original capitalization)
   * @param options - Optional fetch parameters (limit, etc.)
   * @returns Promise resolving to a standardized DictionaryResponse
   * @throws Error if API key missing, word not found, rate limited, or request fails
   */
  async fetchWordData(word: string, options: Record<string, unknown> = {}): Promise<DictionaryResponse> {
    const apiKey = process.env.WORDNIK_API_KEY;
    if (!apiKey) {
      throw new Error('Wordnik API key is required');
    }
    const limit = typeof options.limit === 'number' ? options.limit : CONFIG.DEFAULT_LIMIT;
    const baseUrl = CONFIG.BASE_URL;
    if (!baseUrl) {
      throw new Error('WORDNIK_API_URL environment variable is required');
    }

    const buildUrl = (queryWord: string): string =>
      `${baseUrl}/word.json/${encodeURIComponent(queryWord)}/definitions?limit=${limit}&includeRelated=false&useCanonical=false&includeTags=false&api_key=${apiKey}`;

    const data = await fetchDefinitions(word, buildUrl);
    const definitions = data.flatMap((def) => {
      // Wordnik occasionally splits text into fragments; the contract has one string
      const text = Array.isArray(def.text) ? def.text.join(' ') : def.text;
      // Wordnik's Definition model declares text optional, so a definition
      // without any is well-formed but has nothing to show: it is skipped
      // rather than refusing the response
      if (!text?.trim()) {
        return [];
      }
      // Wordnik's definitions carry no antonyms, so none are set
      return [buildDefinition({
        id: def.id,
        partOfSpeech: def.partOfSpeech,
        text,
        attributionText: def.attributionText,
        sourceDictionary: def.sourceDictionary,
        sourceUrl: def.wordnikUrl || def.attributionUrl,
        examples: def.exampleUses?.flatMap(example => (example.text ? [example.text] : [])),
        synonyms: def.relatedWords?.flatMap(related => related.words ?? []),
      }, POS_MAP)];
    });
    const headword = { pronunciation: data[0]?.textProns?.[0]?.raw };
    return buildDictionaryResponse(
      word,
      definitions,
      'Wordnik',
      data[0]?.attributionText,
      data[0]?.wordnikUrl,
      headword,
    );
  },

  transformToWordData(response: DictionaryResponse, date: string) {
    return transformToWordData('wordnik', response, date);
  },

  transformWordData(wordData) {
    return transformWordData(wordData, 'from Wordnik', processCrossReferences);
  },

  /**
   * Validates if the API response contains usable word data
   * @param response - The raw API response to validate
   * @returns True if response contains valid data, false otherwise
   */
  isValidResponse(response: unknown): boolean {
    return isWordnikDefinitions(response) && response.length > 0;
  },
};

/**
 * Generates a Wordnik website URL for a given word
 * @param word - The word to create a URL for
 * @returns The complete Wordnik URL for the word
 * @throws Error if WORDNIK_WEBSITE_URL environment variable is not set
 */
export function generateWordnikWordUrl(word: string): string {
  const baseUrl = process.env.WORDNIK_WEBSITE_URL;
  if (!baseUrl) {
    throw new Error('WORDNIK_WEBSITE_URL environment variable is required');
  }
  return `${baseUrl}/words/${encodeURIComponent(word.toLowerCase())}`;
}

/**
 * Processes cross-reference tags in Wordnik text and converts them to clickable links
 * @param text - The text containing <xref> tags
 * @returns Text with <xref> tags converted to anchor links
 */
export function processCrossReferences(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text.replaceAll(/<xref[^>]*>(.*?)<\/xref>/g, (_match, word) => {
    const cleanWord = word.trim();
    const wordnikUrl = generateWordnikWordUrl(cleanWord);
    return `<a href="${wordnikUrl}" target="_blank" rel="noopener noreferrer" class="xref-link">${cleanWord}</a>`;
  });
}

/**
 * Processes HTML content with Wordnik-specific formatting, handling cross-references and HTML entities
 * @param htmlString - The HTML string to process
 * @param options - Processing options (preserveXrefs: whether to convert xref tags to links)
 * @returns Processed HTML string with cross-references and entities handled
 */
export function processWordnikHTML(
  htmlString: string,
  options: { preserveXrefs?: boolean } = {},
): string {
  if (typeof htmlString !== 'string') {
    return htmlString;
  }

  const { preserveXrefs = true } = options;
  const xrefProcessed = preserveXrefs
    ? processCrossReferences(htmlString)
    : htmlString.replaceAll(/<xref[^>]*>(.*?)<\/xref>/g, '$1');

  return decodeHTML(xrefProcessed);
}
