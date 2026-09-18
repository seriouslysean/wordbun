/**
 * A --word or --page that names nothing in the data is the operator's typo,
 * not an application fault: generate-images must refuse it with exit 1 at a
 * level the CLI logger does not forward to Sentry (only `error` is). Real
 * subprocesses against the demo data, writing to a temp dir; the preloaded
 * helper marks each warn and error line with its level.
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
