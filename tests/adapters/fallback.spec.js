import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('#utils/logger', () => ({
  logger: mockLogger,
}));

const RATE_LIMITED = 'Rate limit exceeded. Please try again later.';
const NOT_FOUND = 'Word "test" not found in dictionary. Please check the spelling.';
const UNEXPECTED_SHAPE = 'Wordnik returned an unexpected response shape for "test"';

const mockFailingAdapter = (modulePath, exportName, name, error) => {
  vi.doMock(modulePath, () => ({
    [exportName]: {
      name,
      fetchWordData: vi.fn().mockRejectedValue(error),
      transformToWordData: vi.fn(),
      transformWordData: vi.fn(),
      isValidResponse: vi.fn(),
    },
  }));
};

const catchError = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
};

describe('fetchWithFallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns primary adapter result when primary succeeds', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');

    const mockResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wordnik', attribution: '', url: '' } };

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockResolvedValue(mockResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wordnik');
    expect(result.response).toEqual(mockResponse);
  });

  it('falls back when primary fails and fallback is configured', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');

    const fallbackResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wiktionary', attribution: '', url: '' } };

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Word not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockResolvedValue(fallbackResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wiktionary');
    expect(result.response).toEqual(fallbackResponse);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Adapter failed, trying fallback',
      expect.objectContaining({ adapter: 'merriam-webster', fallback: 'wiktionary' }),
    );
  });

  it('defaults to wiktionary fallback when DICTIONARY_FALLBACK is unset', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    delete process.env.DICTIONARY_FALLBACK;

    const fallbackResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wiktionary', attribution: '', url: '' } };

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Word not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockResolvedValue(fallbackResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wiktionary');
  });

  it('throws primary error when fallback is "none"', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'none');

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Word not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');

    const error = await catchError(fetchWithFallback('test'));
    expect(error).not.toBeInstanceOf(AggregateError);
    expect(error.message).toBe('Word not found');
  });

  it('throws one error naming both failures when primary and fallback fail', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockRejectedValue(new Error('MW: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Wiktionary: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');

    await expect(fetchWithFallback('test')).rejects.toThrow(
      'All dictionary adapters failed for "test": merriam-webster: MW: not found | wiktionary: Wiktionary: not found',
    );
  });

  it('tries each fallback in chain order until one succeeds', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wordnik,wiktionary');

    const wiktionaryResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wiktionary', attribution: '', url: '' } };

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockRejectedValue(new Error('MW: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Wordnik: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockResolvedValue(wiktionaryResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wiktionary');
    expect(result.response).toEqual(wiktionaryResponse);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenNthCalledWith(1,
      'Adapter failed, trying fallback',
      expect.objectContaining({ adapter: 'merriam-webster', fallback: 'wordnik' }),
    );
    expect(mockLogger.warn).toHaveBeenNthCalledWith(2,
      'Adapter failed, trying fallback',
      expect.objectContaining({ adapter: 'wordnik', fallback: 'wiktionary' }),
    );
  });

  it('returns first successful fallback in chain', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wordnik,wiktionary');

    const wordnikResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wordnik', attribution: '', url: '' } };

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockRejectedValue(new Error('MW: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockResolvedValue(wordnikResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wordnik');
    expect(result.response).toEqual(wordnikResponse);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps every failure in chain order when all fallbacks fail', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wordnik,wiktionary');

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockRejectedValue(new Error('MW: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Wordnik: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockRejectedValue(new Error('Wiktionary: not found')),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');

    const error = await catchError(fetchWithFallback('test'));
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors.map(e => e.message)).toEqual(['MW: not found', 'Wordnik: not found', 'Wiktionary: not found']);
  });

  it.each([
    ['a rate limit', RATE_LIMITED],
    ['an unexpected shape', UNEXPECTED_SHAPE],
  ])('does not let a fallback 404 mask %s from the primary', async (_label, primaryMessage) => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');
    const primaryError = new Error(primaryMessage);
    const fallbackError = new Error(NOT_FOUND);
    mockFailingAdapter('#adapters/wordnik', 'wordnikAdapter', 'wordnik', primaryError);
    mockFailingAdapter('#adapters/wiktionary', 'wiktionaryAdapter', 'wiktionary', fallbackError);

    const { fetchWithFallback } = await import('#adapters');

    const error = await catchError(fetchWithFallback('test'));
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toEqual([primaryError, fallbackError]);
    expect(error.message).toBe(
      `All dictionary adapters failed for "test": wordnik: ${primaryMessage} | wiktionary: ${NOT_FOUND}`,
    );
  });

  it('reports an unknown fallback adapter alongside the primary failure', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'nonesuch');
    mockFailingAdapter('#adapters/wordnik', 'wordnikAdapter', 'wordnik', new Error(RATE_LIMITED));

    const { fetchWithFallback } = await import('#adapters');

    await expect(fetchWithFallback('test')).rejects.toThrow(
      `All dictionary adapters failed for "test": wordnik: ${RATE_LIMITED} | nonesuch: Unknown adapter: nonesuch`,
    );
  });

  it.each([
    ['empty, as CI exports an unset repository variable', ''],
    ['blank', '  '],
  ])('defaults to the wiktionary fallback when DICTIONARY_FALLBACK is %s', async (_, value) => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', value);
    mockFailingAdapter('#adapters/wordnik', 'wordnikAdapter', 'wordnik', new Error(RATE_LIMITED));

    const fallbackResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wiktionary', attribution: '', url: '' } };
    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockResolvedValue(fallbackResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wiktionary');
  });

  it.each(['NONE', ' None '])('treats DICTIONARY_FALLBACK=%j as no fallback', async (value) => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', value);
    mockFailingAdapter('#adapters/wordnik', 'wordnikAdapter', 'wordnik', new Error(RATE_LIMITED));

    const { fetchWithFallback } = await import('#adapters');

    const error = await catchError(fetchWithFallback('test'));
    expect(error).not.toBeInstanceOf(AggregateError);
    expect(error.message).toBe(RATE_LIMITED);
  });

  it('logs which adapter failed and why before trying the next', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'merriam-webster,wiktionary');
    mockFailingAdapter('#adapters/wordnik', 'wordnikAdapter', 'wordnik', new Error(RATE_LIMITED));
    mockFailingAdapter('#adapters/merriam-webster', 'merriamWebsterAdapter', 'merriam-webster', new Error(NOT_FOUND));
    mockFailingAdapter('#adapters/wiktionary', 'wiktionaryAdapter', 'wiktionary', new Error(NOT_FOUND));

    const { fetchWithFallback } = await import('#adapters');
    await catchError(fetchWithFallback('test'));

    expect(mockLogger.warn.mock.calls).toEqual([
      ['Adapter failed, trying fallback', { adapter: 'wordnik', error: RATE_LIMITED, fallback: 'merriam-webster', word: 'test' }],
      ['Adapter failed, trying fallback', { adapter: 'merriam-webster', error: NOT_FOUND, fallback: 'wiktionary', word: 'test' }],
    ]);
  });

  it('falls through when the primary answers with text but no part of speech', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');

    // No page could display this, so it is not a usable answer
    const unlabelledResponse = { word: 'test', definitions: [{ text: 'Charles Francis 1900-1985' }], meta: { source: 'Merriam-Webster', attribution: '', url: '' } };
    const fallbackResponse = { word: 'test', definitions: [{ text: 'a test', partOfSpeech: 'noun' }], meta: { source: 'Wiktionary', attribution: '', url: '' } };

    vi.doMock('#adapters/merriam-webster', () => ({
      merriamWebsterAdapter: {
        name: 'merriam-webster',
        fetchWordData: vi.fn().mockResolvedValue(unlabelledResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    vi.doMock('#adapters/wiktionary', () => ({
      wiktionaryAdapter: {
        name: 'wiktionary',
        fetchWordData: vi.fn().mockResolvedValue(fallbackResponse),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');
    const result = await fetchWithFallback('test');

    expect(result.adapterName).toBe('wiktionary');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Adapter failed, trying fallback',
      expect.objectContaining({ adapter: 'merriam-webster', fallback: 'wiktionary' }),
    );
  });

  it('throws a named error when the last adapter has no usable definitions', async () => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
    vi.stubEnv('DICTIONARY_FALLBACK', 'none');

    vi.doMock('#adapters/wordnik', () => ({
      wordnikAdapter: {
        name: 'wordnik',
        fetchWordData: vi.fn().mockResolvedValue({ word: 'test', definitions: [{ text: '  ' }], meta: { source: 'Wordnik', attribution: '', url: '' } }),
        transformToWordData: vi.fn(),
        transformWordData: vi.fn(),
        isValidResponse: vi.fn(),
      },
    }));

    const { fetchWithFallback } = await import('#adapters');

    await expect(fetchWithFallback('test')).rejects.toThrow('wordnik returned no usable definitions for "test"');
  });
});
