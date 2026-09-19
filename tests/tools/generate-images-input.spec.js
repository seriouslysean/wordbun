/**
 * A --word or --page that names nothing in the data is the operator's typo,
 * not an application fault: generate-images must refuse it with exit 1 at a
 * level the CLI logger does not forward to Sentry (only `error` is). Word data
 * that cannot be read is a fault in the site's setup, not a typo, and is
 * reported at error. Real subprocesses against the demo data, writing to a
 * temp dir; the preloaded helper marks each warn and error line with its
 * level.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnTool } from '#tests/helpers/spawn.js';

const LOG_LEVELS = pathToFileURL(path.join(process.cwd(), 'tests', 'helpers', 'log-levels.js')).href;

const ctx = { outputDir: '' };

beforeEach(() => {
  ctx.outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-generate-images-input-'));
});

afterEach(() => {
  fs.rmSync(ctx.outputDir, { recursive: true, force: true });
});

describe('generate-images input errors', () => {
  it.each([
    ['a word that is not in the data', ['--word', 'notaword'], 'Word not found in data files'],
    ['a page that does not exist', ['--page', '/not-a-page'], 'Page not found in available pages'],
  ])('refuses %s without reporting an error', async (_, args, message) => {
    const { code, stderr } = await spawnTool(
      ['--import', LOG_LEVELS, 'tools/generate-images.ts', ...args],
      { env: { SOURCE_DIR: 'demo', IMAGES_OUTPUT_DIR: ctx.outputDir }, timeout: 30000 },
    );

    expect(code).toBe(1);
    expect(stderr).toContain(`[warn] ${message}`);
    expect(stderr).not.toContain('[error]');
  }, 35000);
});

describe('generate-images without word data', () => {
  // A mistyped SOURCE_DIR: no words directory under data/
  const missingSource = { SOURCE_DIR: 'not-a-source-dir' };

  it('reports the missing words directory at error for --word', async () => {
    const { code, stderr } = await spawnTool(
      ['--import', LOG_LEVELS, 'tools/generate-images.ts', '--word', 'amblypygi'],
      { env: { ...missingSource, IMAGES_OUTPUT_DIR: ctx.outputDir }, timeout: 30000 },
    );

    expect(code).toBe(1);
    expect(stderr).toContain('[error] Word directory does not exist');
  }, 35000);

  it('fails --page rather than draw its card from a partial corpus', async () => {
    const { code, stderr } = await spawnTool(
      ['--import', LOG_LEVELS, 'tools/generate-images.ts', '--page', '/stats'],
      { env: { ...missingSource, IMAGES_OUTPUT_DIR: ctx.outputDir }, timeout: 30000 },
    );

    expect(code).toBe(1);
    expect(stderr).toContain('[error] Word directory does not exist');
    expect(fs.readdirSync(ctx.outputDir)).toEqual([]);
  }, 35000);
});
