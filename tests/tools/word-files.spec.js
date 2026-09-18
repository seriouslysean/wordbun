/**
 * Word discovery (getWordFiles), which every tool reads the corpus through.
 * Runs against a temp words tree through a mocked #config/paths, with the
 * logger mocked to see what is reported.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const STORED = { word: 'alpha', date: '20250701', adapter: 'wordnik', data: [{ text: 'a letter', partOfSpeech: 'noun' }] };

const ctx = { root: '', logger: null };

const wordsDir = () => path.join(ctx.root, 'words');

beforeEach(() => {
  ctx.root = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-word-files-'));
  ctx.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

  vi.resetModules();
  vi.doMock('#config/paths', () => ({
    paths: { words: wordsDir(), images: ctx.root, fonts: ctx.root, pages: ctx.root },
  }));
  vi.doMock('#utils/logger', async (importOriginal) => ({
    ...await importOriginal(),
    logger: ctx.logger,
  }));
});

afterEach(() => {
  vi.doUnmock('#config/paths');
  vi.doUnmock('#utils/logger');
  vi.resetModules();
  fs.rmSync(ctx.root, { recursive: true, force: true });
});

describe('getWordFiles', () => {
  it('skips the AppleDouble file macOS writes beside a word file', async () => {
    const yearDir = path.join(wordsDir(), '2025');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(path.join(yearDir, '20250701.json'), JSON.stringify(STORED));
    // Resource-fork metadata, not JSON
    fs.writeFileSync(path.join(yearDir, '._20250701.json'), Buffer.from([0, 5, 22, 7, 0, 2, 0, 0]));
    const { getWordFiles } = await import('#tools/utils');

    expect(getWordFiles()).toEqual({
      files: [{ word: 'alpha', date: '20250701', path: path.join(yearDir, '20250701.json') }],
      failures: [],
    });
    expect(ctx.logger.error).not.toHaveBeenCalled();
  });
});
