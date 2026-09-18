import { merriamWebsterAdapter } from '#adapters/merriam-webster';
import { wiktionaryAdapter } from '#adapters/wiktionary';
import { wordnikAdapter } from '#adapters/wordnik';
import type { DictionaryAdapter, DictionaryResponse, FetchOptions } from '#types';
import { logger } from '#utils/logger';
import { isValidDictionaryData } from '#utils/word-validation';

const ADAPTER_REGISTRY: Record<string, DictionaryAdapter> = {
  'wordnik': wordnikAdapter,
  'merriam-webster': merriamWebsterAdapter,
  'wiktionary': wiktionaryAdapter,
};

/**
 * Returns a dictionary adapter by its canonical name.
 * Used at build time to dispatch on `wordData.adapter` field.
 */
export function getAdapterByName(name: string): DictionaryAdapter {
  const adapter = ADAPTER_REGISTRY[name.toLowerCase()];
  if (!adapter) {
    throw new Error(`Unknown adapter: ${name}`);
  }
  return adapter;
}

/**
 * Gets the configured primary dictionary adapter based on DICTIONARY_ADAPTER env var.
 */
export function getAdapter(): DictionaryAdapter {
  const name = process.env.DICTIONARY_ADAPTER || 'wordnik';
  logger.info('Using dictionary adapter', { adapter: name });
  return getAdapterByName(name);
}

export interface FetchResult {
  response: DictionaryResponse;
  adapterName: string;
}

/**
 * Parses DICTIONARY_FALLBACK into an ordered list of adapter names.
 * Supports comma-separated values (e.g. "wordnik,wiktionary").
 * Defaults to "wiktionary" when unset. Set to "none" or "" to disable.
 */
function parseFallbackChain(): string[] {
  const raw = process.env.DICTIONARY_FALLBACK ?? 'wiktionary';
  if (!raw || raw === 'none') {
    return [];
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Fetches from one adapter and refuses a response without usable definitions.
 * Throwing keeps "answered with nothing usable" on the same path as any other
 * adapter failure, so the chain moves on instead of returning an empty result.
 */
async function fetchUsable(adapter: DictionaryAdapter, word: string, options?: FetchOptions): Promise<DictionaryResponse> {
  const response = await adapter.fetchWordData(word, options);
  if (!isValidDictionaryData(response.definitions)) {
    throw new Error(`${adapter.name} returned no usable definitions for "${word}"`);
  }
  return response;
}

/**
 * Fetches word data using the primary adapter, then tries each fallback
 * in DICTIONARY_FALLBACK order (comma-separated) until one succeeds.
 * An adapter succeeds only when its response has usable definitions.
 */
export async function fetchWithFallback(word: string, options?: FetchOptions): Promise<FetchResult> {
  const primary = getAdapter();
  try {
    const response = await fetchUsable(primary, word, options);
    return { response, adapterName: primary.name };
  } catch (primaryError) {
    const fallbacks = parseFallbackChain();
    if (fallbacks.length === 0) {
      throw primaryError;
    }

    let lastError: unknown = primaryError;
    let previousName = primary.name;
    for (const fallbackName of fallbacks) {
      logger.warn('Adapter failed, trying fallback', {
        previous: previousName, fallback: fallbackName, word,
      });
      try {
        const fallback = getAdapterByName(fallbackName);
        const response = await fetchUsable(fallback, word, options);
        return { response, adapterName: fallback.name };
      } catch (fallbackError) {
        lastError = fallbackError;
        previousName = fallbackName;
      }
    }

    throw lastError;
  }
}
