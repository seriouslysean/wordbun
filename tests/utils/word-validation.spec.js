import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isValidDictionaryData, isWordData, parseWordData } from '#utils/word-validation';

const DEMO_WORD_FILE = path.join(import.meta.dirname, '..', '..', 'data', 'demo', 'words', '2025', '20250101.json');
const VALID_WORD = { word: 'test', date: '20250101', adapter: 'wordnik', data: [{ text: 'a test', partOfSpeech: 'noun' }] };

describe('word-validation', () => {
  describe('isValidDictionaryData', () => {
    it('validates array with valid dictionary definitions', () => {
      const validData = [
        {
          text: 'A test definition',
          partOfSpeech: 'noun'
        },
        {
          text: 'To test something',
          partOfSpeech: 'verb'
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('validates array with entries having only text', () => {
      const validData = [
        {
          text: 'A definition with text only'
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('validates array with entries having only partOfSpeech', () => {
      const validData = [
        {
          partOfSpeech: 'noun'
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('rejects empty array', () => {
      expect(isValidDictionaryData([])).toBe(false);
    });

    it('rejects non-array input', () => {
      expect(isValidDictionaryData(null)).toBe(false);
      expect(isValidDictionaryData(undefined)).toBe(false);
      expect(isValidDictionaryData('string')).toBe(false);
      expect(isValidDictionaryData(123)).toBe(false);
      expect(isValidDictionaryData({})).toBe(false);
    });

    it('rejects array with entries missing both text and partOfSpeech', () => {
      const invalidData = [
        {
          someOtherField: 'value'
        }
      ];

      expect(isValidDictionaryData(invalidData)).toBe(false);
    });

    it('rejects array with entries having empty text and partOfSpeech', () => {
      const invalidData = [
        {
          text: '',
          partOfSpeech: '  '
        }
      ];

      expect(isValidDictionaryData(invalidData)).toBe(false);
    });

    it('accepts array with entries having non-string text if partOfSpeech is valid', () => {
      const validData = [
        {
          text: 123, // not a string
          partOfSpeech: 'noun' // but this is valid
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('accepts array with entries having non-string partOfSpeech if text is valid', () => {
      const validData = [
        {
          text: 'Valid text',
          partOfSpeech: 456 // not a string, but text is valid
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('accepts mixed array where at least one entry is valid', () => {
      const mixedData = [
        {
          invalidField: 'value'
        },
        {
          text: 'Valid definition'
        }
      ];

      expect(isValidDictionaryData(mixedData)).toBe(true);
    });

    it('handles whitespace in text and partOfSpeech', () => {
      const validData = [
        {
          text: '  Valid text with whitespace  ',
          partOfSpeech: '  noun  '
        }
      ];

      expect(isValidDictionaryData(validData)).toBe(true);
    });

    it('rejects array with only whitespace in text and partOfSpeech', () => {
      const invalidData = [
        {
          text: '   ',
          partOfSpeech: '\t\n  '
        }
      ];

      expect(isValidDictionaryData(invalidData)).toBe(false);
    });
  });

  describe('isWordData', () => {
    it('accepts a stored demo word file', () => {
      expect(isWordData(JSON.parse(fs.readFileSync(DEMO_WORD_FILE, 'utf-8')))).toBe(true);
    });

    it('accepts the minimal shape and the optional fields', () => {
      expect(isWordData(VALID_WORD)).toBe(true);
      expect(isWordData({
        ...VALID_WORD,
        preserveCase: true,
        rawData: { anything: 1 },
        enrichment: { synonyms: ['exam'], pronunciation: 'test', audio: 'https://example.com/t.mp3', etymology: 'Latin' },
        data: [{ id: 'test', text: ['a', 'test'], examples: ['x'], synonyms: [], antonyms: [], sourceUrl: '' }],
      })).toBe(true);
      expect(isWordData({ ...VALID_WORD, data: [] })).toBe(true);
    });

    it('rejects non-objects', () => {
      expect(isWordData(null)).toBe(false);
      expect(isWordData([])).toBe(false);
      expect(isWordData('test')).toBe(false);
    });

    it('rejects missing or mistyped required fields', () => {
      expect(isWordData({ ...VALID_WORD, word: undefined })).toBe(false);
      expect(isWordData({ ...VALID_WORD, word: 1 })).toBe(false);
      expect(isWordData({ ...VALID_WORD, date: 20250101 })).toBe(false);
      expect(isWordData({ ...VALID_WORD, adapter: undefined })).toBe(false);
      expect(isWordData({ ...VALID_WORD, data: undefined })).toBe(false);
      expect(isWordData({ ...VALID_WORD, data: {} })).toBe(false);
    });

    it('rejects malformed definitions', () => {
      const withDefinition = definition => ({ ...VALID_WORD, data: [definition] });
      expect(isWordData(withDefinition(null))).toBe(false);
      expect(isWordData(withDefinition('a test'))).toBe(false);
      expect(isWordData(withDefinition({ id: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ partOfSpeech: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ text: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ text: ['a', 1] }))).toBe(false);
      expect(isWordData(withDefinition({ attributionText: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ sourceDictionary: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ sourceUrl: 1 }))).toBe(false);
      expect(isWordData(withDefinition({ examples: 'x' }))).toBe(false);
      expect(isWordData(withDefinition({ synonyms: [1] }))).toBe(false);
      expect(isWordData(withDefinition({ antonyms: 'x' }))).toBe(false);
    });

    it('rejects malformed optional fields', () => {
      expect(isWordData({ ...VALID_WORD, preserveCase: 'true' })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: [] })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { synonyms: 'x' } })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { antonyms: 'x' } })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { related: [1] } })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { pronunciation: { raw: 'x' } } })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { audio: 1 } })).toBe(false);
      expect(isWordData({ ...VALID_WORD, enrichment: { etymology: ['x'] } })).toBe(false);
    });
  });

  describe('parseWordData', () => {
    it('returns the parsed word', () => {
      expect(parseWordData(JSON.stringify(VALID_WORD), 'words/2025/20250101.json')).toEqual(VALID_WORD);
    });

    it('names the file when the shape is wrong', () => {
      expect(() => parseWordData('{"word":"test"}', 'words/2025/20250101.json')).toThrow(
        'Invalid word data in words/2025/20250101.json',
      );
    });

    it('throws on invalid JSON', () => {
      expect(() => parseWordData('{not json', 'words/2025/20250101.json')).toThrow(SyntaxError);
    });
  });
});
