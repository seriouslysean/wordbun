/**
 * Common adapter interfaces for dictionary services
 */

import type { DictionaryDefinition, FetchOptions } from '#types';

/**
 * What an adapter answers for a lookup. Like its definitions, every string is
 * nonblank and every URL absolute http(s); a field the partner did not supply
 * is omitted rather than left empty. isCanonicalResponse checks it.
 */
export interface DictionaryResponse {
  word: string;
  definitions: DictionaryDefinition[];
  meta: {
    source: string;
    attribution?: string;
    url?: string;
  };
  // Optional per-headword capture (pronunciation/audio/etymology) folded into
  // WordEnrichment by buildWordData. Absent for adapters that don't supply it.
  headword?: {
    pronunciation?: string;
    audio?: string;
    etymology?: string;
  };
}

/**
 * A dictionary adapter fetches and translates, and nothing else: the site
 * renders stored records without asking which adapter wrote them.
 */
export interface DictionaryAdapter {
  name: string;

  /**
   * Fetch a word from the dictionary service, translated into the canonical
   * contract
   */
  fetchWordData(word: string, options?: FetchOptions): Promise<DictionaryResponse>;
}


// TODO: Future consideration for data format abstraction
// Currently, WordData.data contains adapter-specific response format (WordnikDefinition[])
// For true adapter independence, we'd need:
// 1. Generic storage format that's adapter-agnostic
// 2. Migration strategy for existing Wordnik-formatted data
// 3. Versioning system for data format changes
//
// Potential approach:
// interface WordDataV2 {
//   word: string;
//   date: string;
//   adapter: string;
//   version: number;
//   definitions: DictionaryDefinition[]; // Generic format
//   rawData?: unknown; // Optional original adapter response
// }
//
// This would allow:
// - Adapter-independent queries and processing
// - Backward compatibility through migration
// - Future-proof data storage