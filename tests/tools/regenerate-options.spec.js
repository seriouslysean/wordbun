/**
 * regenerate-all-words option handling: every documented option does
 * something, defaults in the help are the defaults in the code, and bad
 * numbers stop the run before any word is touched. Real subprocesses in a
 * temp cwd with --dry-run, so no network and nothing under data/.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnTool } from '#tests/helpers/spawn.js';

const TOOL = path.join(process.cwd(), 'tools', 'regenerate-all-words.ts');

const ctx = { tempDir: '' };

const run = (args) => spawnTool([TOOL, ...args], {
  env: { SOURCE_DIR: '', DICTIONARY_ADAPTER: '' },
  cwd: ctx.tempDir,
});

beforeEach(() => {
  ctx.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-regen-options-'));
  const yearDir = path.join(ctx.tempDir, 'data', 'words', '2024');
  fs.mkdirSync(yearDir, { recursive: true });
  fs.writeFileSync(path.join(yearDir, '20240101.json'), JSON.stringify({ word: 'alpha' }));
});

afterEach(() => {
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
});

describe('regenerate-all-words options', () => {
  it.each([
    ['--batch-size=0', 'batch-size'],
    ['--batch-size=abc', 'batch-size'],
    ['--batch-size=2.5', 'batch-size'],
    ['--timeout=-5', 'timeout'],
    ['--timeout=12abc', 'timeout'],
    ['--batch-timeout=NaN', 'batch-timeout'],
  ])('rejects %s with a clear error and exit 1', async (flag, option) => {
    const { stdout, stderr, code } = await run(['--dry-run', flag]);

    expect(code).toBe(1);
    expect(stderr).toContain('Invalid numeric option');
    expect(stderr).toContain(option);
    expect(stdout).not.toContain('alpha');
  });

  it('accepts a zero delay', async () => {
    const { code, stdout } = await run(['--dry-run', '--timeout=0', '--batch-timeout=0']);

    expect(code).toBe(0);
    expect(stdout).toContain('alpha');
  });

  it.each(['--word-field=word', '--date-field=date', '--rate-limit-timeout=1000'])(
    'no longer accepts the unused %s',
    async (flag) => {
      const { code, stderr } = await run(['--dry-run', flag]);

      expect(code).not.toBe(0);
      expect(stderr).toContain('Unknown option');
    },
  );

  it('documents the defaults the code actually uses', async () => {
    const { DEFAULTS } = await import(TOOL);
    const { stdout, code } = await run(['--help']);

    expect(code).toBe(0);
    expect(stdout).toContain(`--timeout <ms>             Delay between API calls (default: ${DEFAULTS.timeout})`);
    expect(stdout).toContain(`--batch-size <num>         Words per batch (default: ${DEFAULTS.batchSize})`);
    expect(stdout).toContain(`--batch-timeout <ms>       Pause between batches (default: ${DEFAULTS.batchTimeout})`);
    expect(stdout).not.toMatch(/word-field|date-field|rate-limit-timeout/);
  });
});
