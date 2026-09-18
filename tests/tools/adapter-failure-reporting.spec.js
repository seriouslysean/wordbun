/**
 * How add-word and regenerate-all-words react when the adapter chain is
 * exhausted. A fallback's 404 must not hide a rate limit or a shape error
 * from the primary. Runs the real Wordnik and Wiktionary adapters with fetch
 * stubbed per host, writes through a mocked #config/paths, and replaces the
 * backoff delay so retries do not wait.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const WORD = 'zzyzx';
const NOT_FOUND = `Word "${WORD}" not found in dictionary. Please check the spelling.`;
const RATE_LIMITED = 'Rate limit exceeded. Please try again later.';
const SHAPE = `Wordnik returned an unexpected response shape for "${WORD}"`;

const STATUS_TEXT = { 200: 'OK', 404: 'Not Found', 429: 'Too Many Requests' };
const httpResponse = (status, body = []) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: STATUS_TEXT[status],
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const ctx = {
  wordsDir: '',
  wordnik: null,
  merriamWebster: null,
  wiktionary: null,
  logger: null,
  delay: null,
};

const responseFor = (url) => {
  if (url.startsWith('https://wordnik.test')) {
    return ctx.wordnik;
  }
  return url.startsWith('https://mw.test') ? ctx.merriamWebster : ctx.wiktionary;
};

const addWord = async () => {
  const tool = await import('#tools/add-word');
  await tool.addWord(WORD);
};

const regenerateWordFile = async (word = WORD) => {
  const tool = await import('#tools/regenerate-all-words');
  return tool.regenerateWordFile(word, '20240101', path.join(ctx.wordsDir, '2024', '20240101.json'));
};

beforeEach(() => {
  ctx.wordsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-adapter-failures-'));
  // An empty year directory keeps the existing-word scan from logging an error
  fs.mkdirSync(path.join(ctx.wordsDir, '2024'));
  ctx.wordnik = httpResponse(404);
  ctx.wiktionary = httpResponse(404);
  ctx.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  ctx.delay = vi.fn().mockResolvedValue(undefined);

  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(url => Promise.resolve(responseFor(String(url)))));
  vi.stubEnv('DICTIONARY_ADAPTER', 'wordnik');
  vi.stubEnv('DICTIONARY_FALLBACK', 'wiktionary');
  vi.stubEnv('WORDNIK_API_KEY', 'test-key');
  vi.stubEnv('WORDNIK_API_URL', 'https://wordnik.test/v4');
  vi.doMock('#config/paths', () => ({
    paths: { words: ctx.wordsDir, images: ctx.wordsDir, fonts: ctx.wordsDir, pages: ctx.wordsDir },
  }));
  vi.doMock('#utils/logger', async (importOriginal) => ({
    ...await importOriginal(),
    logger: ctx.logger,
    exit: vi.fn(),
  }));
  vi.doMock('node:timers/promises', () => ({ setTimeout: ctx.delay }));
});

afterEach(() => {
  vi.doUnmock('#config/paths');
  vi.doUnmock('#utils/logger');
  vi.doUnmock('node:timers/promises');
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  fs.rmSync(ctx.wordsDir, { recursive: true, force: true });
});

describe('add-word failure reporting', () => {
  it('reports a rate limit, not "not found", when only the fallback said not found', async () => {
    ctx.wordnik = httpResponse(429);

    await addWord();

    expect(ctx.logger.error).toHaveBeenCalledExactlyOnceWith('Failed to add word', {
      word: WORD,
      errorMessage: `All dictionary adapters failed for "${WORD}": wordnik: ${RATE_LIMITED} | wiktionary: ${NOT_FOUND}`,
    });
  });

  it('reports an unexpected shape, not "not found", when only the fallback said not found', async () => {
    ctx.wordnik = httpResponse(200, { message: 'unexpected' });

    await addWord();

    expect(ctx.logger.error).toHaveBeenCalledExactlyOnceWith('Failed to add word', {
      word: WORD,
      errorMessage: `All dictionary adapters failed for "${WORD}": wordnik: ${SHAPE} | wiktionary: ${NOT_FOUND}`,
    });
  });

  it('reports "not found" when every adapter said not found', async () => {
    await addWord();

    expect(ctx.logger.error).toHaveBeenCalledExactlyOnceWith('Word not found in dictionary', {
      word: WORD,
      errorMessage: `All dictionary adapters failed for "${WORD}": wordnik: ${NOT_FOUND} | wiktionary: ${NOT_FOUND}`,
    });
  });

  it.each([
    ['suggestions', ['zydeco', 'zyzzyva']],
    ['no entry from the configured dictionary', [{ meta: { id: WORD, src: 'learners' }, shortdef: ['a place'] }]],
  ])('reports "not found" when Merriam-Webster answered with %s and the fallback said not found', async (_, body) => {
    vi.stubEnv('DICTIONARY_ADAPTER', 'merriam-webster');
    vi.stubEnv('MERRIAM_WEBSTER_API_KEY', 'test-key');
    vi.stubEnv('MERRIAM_WEBSTER_API_URL', 'https://mw.test/api/v3/references');
    ctx.merriamWebster = httpResponse(200, body);

    await addWord();

    expect(ctx.logger.error).toHaveBeenCalledExactlyOnceWith('Word not found in dictionary', expect.objectContaining({ word: WORD }));
  });

  it('keeps the single-adapter message unchanged when no fallback is configured', async () => {
    vi.stubEnv('DICTIONARY_FALLBACK', 'none');

    await addWord();

    expect(ctx.logger.error).toHaveBeenCalledExactlyOnceWith('Word not found in dictionary', {
      word: WORD,
      errorMessage: NOT_FOUND,
    });
  });
});

describe('regenerate-all-words rate-limit backoff', () => {
  it('backs off when the primary was rate limited and the fallback said not found', async () => {
    ctx.wordnik = httpResponse(429);

    const success = await regenerateWordFile();

    expect(success).toBe(false);
    expect(ctx.delay.mock.calls).toEqual([[30000], [60000], [120000]]);
  });

  it('does not back off when every adapter said not found', async () => {
    const success = await regenerateWordFile();

    expect(success).toBe(false);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('does not mistake a word containing "429" for a rate limit', async () => {
    const success = await regenerateWordFile('zz429');

    expect(success).toBe(false);
    expect(ctx.delay).not.toHaveBeenCalled();
  });
});
