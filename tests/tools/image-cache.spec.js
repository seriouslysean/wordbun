/**
 * Image cache invalidation is settled once per run: a settings change
 * regenerates every existing image, and the marker that certifies the corpus
 * only advances after a complete run with no failures. Real subprocesses
 * writing to a temp dir; nothing under public/ is touched.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnTool } from '#tests/helpers/spawn.js';

const ALL_GENERATED = /(word|generic) generation complete \{ total: (\d+), generated: \2, skipped: 0, errors: 0 \}/g;

const ctx = { outputDir: '', markerPath: '' };

const run = (args, colorPrimary) => spawnTool(
  ['tools/generate-images.ts', ...args],
  { env: { SOURCE_DIR: 'demo', IMAGES_OUTPUT_DIR: ctx.outputDir, COLOR_PRIMARY: colorPrimary }, timeout: 60000 },
);

const readMarker = () => fs.readFileSync(ctx.markerPath, 'utf-8');

beforeEach(() => {
  ctx.outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-image-cache-'));
  ctx.markerPath = path.join(ctx.outputDir, 'social', '.image-settings-hash');
});

afterEach(() => {
  fs.rmSync(ctx.outputDir, { recursive: true, force: true });
});

describe('generate-images cache invalidation', () => {
  it('regenerates every existing image after a settings change, then skips them all', async () => {
    const first = await run([], '#111111');
    expect(first.code).toBe(0);
    const firstMarker = readMarker();

    const changed = await run([], '#222222');
    expect(changed.code).toBe(0);
    expect(changed.stdout.match(ALL_GENERATED)).toHaveLength(2);
    expect(readMarker()).not.toBe(firstMarker);

    const unchanged = await run([], '#222222');
    expect(unchanged.code).toBe(0);
    expect(unchanged.stdout).not.toMatch(/generated: [1-9]/);
  }, 120000);

  it('does not advance the marker when the run has failures', async () => {
    await run([], '#111111');
    const firstMarker = readMarker();

    // A regular file where the pages directory belongs fails every generic job
    // after the word jobs have already succeeded.
    const pagesDir = path.join(ctx.outputDir, 'social', 'pages');
    fs.rmSync(pagesDir, { recursive: true });
    fs.writeFileSync(pagesDir, '');

    const { code } = await run([], '#222222');
    expect(code).toBe(1);
    expect(readMarker()).toBe(firstMarker);
  }, 120000);

  it('never certifies the corpus from a partial run', async () => {
    const single = await run(['--page', '/stats'], '#111111');
    expect(single.code).toBe(0);
    expect(fs.existsSync(ctx.markerPath)).toBe(false);

    const generic = await run(['--generic'], '#111111');
    expect(generic.code).toBe(0);
    expect(fs.existsSync(ctx.markerPath)).toBe(false);
  }, 120000);

  it('certifies the corpus when --words and --generic together cover everything', async () => {
    const covered = await run(['--words', '--generic'], '#111111');
    expect(covered.code).toBe(0);
    expect(covered.stdout.match(ALL_GENERATED)).toHaveLength(2);
    expect(fs.existsSync(ctx.markerPath)).toBe(true);

    const unchanged = await run([], '#111111');
    expect(unchanged.code).toBe(0);
    expect(unchanged.stdout).not.toMatch(/generated: [1-9]/);
  }, 120000);
});
