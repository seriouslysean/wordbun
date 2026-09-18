import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

import {
  ADAPTER_FETCH_TIMEOUT_MS,
  adapterFetch,
  normalizePOS,
  parseJsonResponse,
  throwOnHttpError,
  throwUnexpectedShape,
  throwWordNotFound,
  transformToWordData,
  transformWordData,
} from '#utils/adapter-utils';

const TEST_POS_MAP = {
  'transitive verb': 'verb',
  'proper noun': 'noun',
};

describe('adapter-utils', () => {
  describe('adapterFetch', () => {
    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns the response on success', async () => {
      const mockResponse = { ok: true, status: 200 };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await adapterFetch('https://example.com', 'TestAPI');

      expect(result).toBe(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com', { signal: expect.any(AbortSignal) });
    });

    it('wraps TypeError from DNS/network failure with adapter context', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      await expect(adapterFetch('https://bad.invalid', 'Merriam-Webster'))
        .rejects.toThrow('Merriam-Webster network request failed: fetch failed');
    });

    it('aborts a request that never responds once the deadline passes', async () => {
      // Stands in for a hung connection: settles only when the caller's signal aborts, as real fetch does
      globalThis.fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
        if (!init?.signal) {
          reject(new Error('fetch called without an abort signal'));
          return;
        }
        if (init.signal.aborted) {
          reject(init.signal.reason);
          return;
        }
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      }));
      // AbortSignal.timeout runs on an internal timer that fake timers cannot advance, so hand back an expired signal
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
        AbortSignal.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
      );

      const error = await adapterFetch('https://slow.invalid', 'Wordnik').catch(e => e);

      expect(timeoutSpy).toHaveBeenCalledWith(ADAPTER_FETCH_TIMEOUT_MS);
      expect(error.message).toBe(`Wordnik request timed out after ${ADAPTER_FETCH_TIMEOUT_MS}ms`);
      expect(error.cause.name).toBe('TimeoutError');
    });

    it('wraps non-Error throws with adapter context', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue('connection reset');

      await expect(adapterFetch('https://example.com', 'Wordnik'))
        .rejects.toThrow('Wordnik network request failed: connection reset');
    });
  });

  describe('normalizePOS', () => {
    it('returns base POS unchanged', () => {
      expect(normalizePOS('noun', TEST_POS_MAP)).toBe('noun');
      expect(normalizePOS('verb', TEST_POS_MAP)).toBe('verb');
      expect(normalizePOS('adjective', TEST_POS_MAP)).toBe('adjective');
    });

    it('normalizes case and whitespace before checking', () => {
      expect(normalizePOS('  Noun  ', TEST_POS_MAP)).toBe('noun');
      expect(normalizePOS('VERB', TEST_POS_MAP)).toBe('verb');
    });

    it('maps known variants via the provided map', () => {
      expect(normalizePOS('transitive verb', TEST_POS_MAP)).toBe('verb');
      expect(normalizePOS('proper noun', TEST_POS_MAP)).toBe('noun');
    });

    it('returns undefined for unmappable values', () => {
      expect(normalizePOS('biographical name', TEST_POS_MAP)).toBeUndefined();
      expect(normalizePOS('abbreviation', TEST_POS_MAP)).toBeUndefined();
    });
  });

  describe('transformToWordData', () => {
    it('produces correct WordData structure', () => {
      const response = {
        word: 'test',
        definitions: [{ text: 'a test', partOfSpeech: 'noun' }],
        meta: { source: 'Test', attribution: 'test', url: '' },
      };

      const result = transformToWordData('test-adapter', response, '20250101');

      expect(result).toEqual({
        word: 'test',
        date: '20250101',
        adapter: 'test-adapter',
        data: response.definitions,
        rawData: response,
      });
    });
  });

  describe('transformWordData', () => {
    it('extracts the first valid definition', () => {
      const wordData = {
        data: [
          { text: 'a definition', partOfSpeech: 'noun', attributionText: 'from Test', sourceUrl: 'https://example.com' },
        ],
      };

      const result = transformWordData(wordData, 'default attribution');

      expect(result.definition).toBe('a definition');
      expect(result.partOfSpeech).toBe('noun');
      expect(result.meta.attributionText).toBe('from Test');
    });

    it('returns empty result for null input', () => {
      expect(transformWordData(null, 'default')).toEqual({
        partOfSpeech: '', definition: '', meta: null,
      });
    });

    it('returns empty result for empty data array', () => {
      expect(transformWordData({ data: [] }, 'default')).toEqual({
        partOfSpeech: '', definition: '', meta: null,
      });
    });

    it('uses default attribution when definition has none', () => {
      const wordData = {
        data: [{ text: 'a definition', partOfSpeech: 'noun' }],
      };

      const result = transformWordData(wordData, 'from Fallback');

      expect(result.meta.attributionText).toBe('from Fallback');
    });

    it('applies processText hook when provided', () => {
      const wordData = {
        data: [{ text: 'raw text', partOfSpeech: 'noun' }],
      };

      const result = transformWordData(wordData, 'default', text => text.toUpperCase());

      expect(result.definition).toBe('RAW TEXT');
    });

    it('skips processText hook when not provided', () => {
      const wordData = {
        data: [{ text: 'raw text', partOfSpeech: 'noun' }],
      };

      const result = transformWordData(wordData, 'default');

      expect(result.definition).toBe('raw text');
    });
  });

  describe('throwOnHttpError', () => {
    it('does nothing for ok responses', () => {
      const response = { ok: true, status: 200 };
      expect(() => throwOnHttpError(response, 'test')).not.toThrow();
    });

    it('throws rate limit error for 429', () => {
      const response = { ok: false, status: 429 };
      expect(() => throwOnHttpError(response, 'test')).toThrow('Rate limit exceeded');
    });

    it('throws word not found for 404', () => {
      const response = { ok: false, status: 404 };
      expect(() => throwOnHttpError(response, 'serendipity')).toThrow(
        'Word "serendipity" not found in dictionary',
      );
    });

    it('throws generic error with statusText for other failures', () => {
      const response = { ok: false, status: 500, statusText: 'Internal Server Error' };
      expect(() => throwOnHttpError(response, 'test')).toThrow(
        'Failed to fetch word data: Internal Server Error',
      );
    });
  });

  describe('parseJsonResponse', () => {
    it('names the adapter when the body cannot be read', async () => {
      const cause = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      const body = new ReadableStream({
        start(controller) {
          controller.error(cause);
        },
      });
      const error = await parseJsonResponse(new Response(body), 'TestAPI').catch(e => e);
      expect(error.message).toBe(
        'Failed to read TestAPI response body: The operation was aborted due to timeout',
      );
      expect(error.cause).toBe(cause);
    });

    it('parses valid JSON response', async () => {
      const response = new Response(JSON.stringify({ word: 'test' }));
      const result = await parseJsonResponse(response, 'TestAPI');
      expect(result).toEqual({ word: 'test' });
    });

    it('throws with response text on parse failure', async () => {
      const response = new Response('<html>Invalid API Key</html>');
      const error = await parseJsonResponse(response, 'TestAPI').catch(e => e);
      expect(error.message).toBe(
        'Invalid API response (not JSON) from TestAPI. Response: <html>Invalid API Key</html>',
      );
      expect(error.cause).toBeInstanceOf(SyntaxError);
    });

    it('truncates long error responses', async () => {
      const response = new Response('x'.repeat(500));
      const error = await parseJsonResponse(response, 'TestAPI').catch(e => e);
      expect(error.message).toContain('Invalid API response (not JSON) from TestAPI');
      expect(error.message.length).toBeLessThan(300);
    });
  });

  describe('throwWordNotFound', () => {
    it('throws with consistent message format', () => {
      expect(() => throwWordNotFound('serendipity')).toThrow(
        'Word "serendipity" not found in dictionary. Please check the spelling.',
      );
    });
  });

  describe('throwUnexpectedShape', () => {
    it('names the adapter and the word', () => {
      expect(() => throwUnexpectedShape('Wordnik', 'serendipity')).toThrow(
        'Wordnik returned an unexpected response shape for "serendipity"',
      );
    });
  });
});
