/**
 * Bulk tools must report partial failure through their exit code: CI and
 * `npm run a && npm run b` chains only see the code, never the log lines.
 * Real subprocesses, no network, all output in temp dirs.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnTool } from '#tests/helpers/spawn.js';

const TOOLS_DIR = path.join(process.cwd(), 'tools');

const ctx = { tempDir: '' };

beforeEach(() => {
  ctx.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-bulk-'));
});

afterEach(() => {
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
});

describe('generate-images bulk run', () => {
  it('exits 1 with a failure count when jobs fail', async () => {
    // A regular file where the pages directory belongs makes every write fail.
    fs.mkdirSync(path.join(ctx.tempDir, 'social'));
    fs.writeFileSync(path.join(ctx.tempDir, 'social', 'pages'), '');

    const { stdout, stderr, code } = await spawnTool(
      ['tools/generate-images.ts', '--generic', '--force'],
      { env: { SOURCE_DIR: 'demo', IMAGES_OUTPUT_DIR: ctx.tempDir }, timeout: 30000 },
    );

    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toMatch(/Image generation finished with failures.*failed: \d+/s);
  }, 35000);
});

describe('regenerate-all-words bulk run', () => {
  it('processes every word, then exits 1 when any failed', async () => {
    // The tool resolves data/words from its cwd, so a temp cwd isolates it.
    const yearDir = path.join(ctx.tempDir, 'data', 'words', '2024');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(path.join(yearDir, '20240101.json'), JSON.stringify({ word: 'alpha' }));
    fs.writeFileSync(path.join(yearDir, '20240102.json'), JSON.stringify({ word: 'beta' }));
    // tools/utils.ts parses the image fonts from <cwd>/tools/fonts at import.
    fs.mkdirSync(path.join(ctx.tempDir, 'tools'));
    fs.symlinkSync(path.join(TOOLS_DIR, 'fonts'), path.join(ctx.tempDir, 'tools', 'fonts'));

    // No adapter configured: every word fails before any network call.
    const { stdout, stderr, code } = await spawnTool(
      [path.join(TOOLS_DIR, 'regenerate-all-words.ts'), '--force', '--timeout', '1', '--batch-timeout', '1'],
      { env: { SOURCE_DIR: '', DICTIONARY_ADAPTER: '' }, cwd: ctx.tempDir, timeout: 30000 },
    );

    const output = `${stdout}${stderr}`;
    expect(output).toContain('alpha');
    expect(output).toContain('beta');
    expect(output).toMatch(/failed: 2/);
    expect(code).toBe(1);
  }, 35000);
});
