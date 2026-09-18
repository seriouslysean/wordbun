import type { DictionaryDefinition, WordData, WordEnrichment, WordIndexEntry } from '#types';
import { isOptional, isRecord, isString, isStringArray } from '#utils/type-guards';

/**
 * Validates dictionary data to ensure it contains meaningful content.
 * @param data - Array of dictionary definitions to validate
 * @returns True if the data contains at least one valid definition entry
 */
export function isValidDictionaryData(data: DictionaryDefinition[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  // Valid if at least one entry has definition text or part of speech
  return data.some(entry =>
    (typeof entry.text === 'string' && entry.text.trim().length > 0) ||
    (typeof entry.partOfSpeech === 'string' && entry.partOfSpeech.trim().length > 0),
  );
}

const isTextField = (value: unknown): value is string | string[] => isString(value) || isStringArray(value);

const isDictionaryDefinition = (value: unknown): value is DictionaryDefinition =>
  isRecord(value)
  && isOptional(value.id, isString)
  && isOptional(value.partOfSpeech, isString)
  && isOptional(value.text, isTextField)
  && isOptional(value.attributionText, isString)
  && isOptional(value.sourceDictionary, isString)
  && isOptional(value.sourceUrl, isString)
  && isOptional(value.examples, isStringArray)
  && isOptional(value.synonyms, isStringArray)
  && isOptional(value.antonyms, isStringArray);

const isWordEnrichment = (value: unknown): value is WordEnrichment =>
  isRecord(value)
  && isOptional(value.synonyms, isStringArray)
  && isOptional(value.antonyms, isStringArray)
  && isOptional(value.related, isStringArray)
  && isOptional(value.pronunciation, isString)
  && isOptional(value.audio, isString)
  && isOptional(value.etymology, isString);

/**
 * Type guard for a stored word file. Mirrors the fields of the content
 * collection schema in plain predicates, because CLI tools run as plain
 * Node.js and cannot import astro/zod.
 */
export const isWordData = (value: unknown): value is WordData =>
  isRecord(value)
  && isString(value.word)
  && isString(value.date)
  && isString(value.adapter)
  && Array.isArray(value.data) && value.data.every(isDictionaryDefinition)
  && isOptional(value.enrichment, isWordEnrichment)
  && isOptional(value.preserveCase, (flag): flag is boolean => typeof flag === 'boolean');

/**
 * Parses the contents of a stored word file. Throws on invalid JSON or on a
 * shape that is not WordData, naming the file so a log-and-skip caller says
 * which one to fix.
 */
export function parseWordData(json: string, filePath: string): WordData {
  const parsed: unknown = JSON.parse(json);
  if (!isWordData(parsed)) {
    throw new Error(`Invalid word data in ${filePath}`);
  }
  return parsed;
}

/**
 * Type guard for the fetched /words.json index. Client scripts check the
 * response with this before caching it, so a bad deploy or an intercepted
 * response degrades to "no words" instead of throwing mid-search.
 */
export const isWordIndex = (value: unknown): value is WordIndexEntry[] =>
  Array.isArray(value) && value.every(entry => isRecord(entry) && isString(entry.word) && isString(entry.date));
