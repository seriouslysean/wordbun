import { adapterFetch, parseJsonResponse } from '#utils/adapter-utils';

/**
 * Word-level related-word lists from the Datamuse API. Datamuse returns no
 * definitions, so it is NOT a DictionaryAdapter and is never part of the
 * fetchWithFallback chain — it is fetched separately at add-word time and the
 * results are stored in the committed word JSON (builds stay offline).
 *
 * Attribution-only license; we request word lists (rel_*) only, never md=d
 * definitions (which would re-import Wiktionary/WordNet definition licenses).
 */
export interface DatamuseRelations {
  synonyms: string[];
  antonyms: string[];
  related: string[];
}

interface DatamuseWord {
  word: string;
  score?: number;
}

const DATAMUSE_BASE_URL = process.env.DATAMUSE_API_URL || 'https://api.datamuse.com/words';
const MAX_RELATIONS = 20;

/**
 * Fetches one Datamuse relation list (rel_<code>) and returns just the words.
 * Pass-through: reports exactly what Datamuse returns, capped at MAX_RELATIONS.
 */
async function fetchRelation(word: string, code: string): Promise<string[]> {
  const url = `${DATAMUSE_BASE_URL}?rel_${code}=${encodeURIComponent(word)}&max=${MAX_RELATIONS}`;
  const response = await adapterFetch(url, 'Datamuse');
  if (!response.ok) {
    throw new Error(`Datamuse request failed (${response.status}) for rel_${code}`);
  }
  const data = (await parseJsonResponse(response, 'Datamuse')) as DatamuseWord[];
  return data.map(item => item.word).filter(Boolean);
}

/**
 * Fetches synonyms (rel_syn), antonyms (rel_ant), and statistically associated
 * words (rel_trg) for a word. Throws if any request fails; the caller wraps this
 * in try/catch so enrichment is best-effort and never blocks word creation.
 */
export async function fetchDatamuseRelations(word: string): Promise<DatamuseRelations> {
  const [synonyms, antonyms, related] = await Promise.all([
    fetchRelation(word, 'syn'),
    fetchRelation(word, 'ant'),
    fetchRelation(word, 'trg'),
  ]);
  return { synonyms, antonyms, related };
}
