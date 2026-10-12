/**
 * Architecture test for the two directories that belong to downstream sites.
 *
 * A downstream site is a full copy of this repository that keeps its words in
 * `data/words/` and its cards in `public/images/`, and takes each release by
 * merging this repository's `main` (`npm run tool:sync`). Those merges stay
 * clean only while this repository tracks nothing in either directory: one
 * file here would collide with a site's own, or land in every site as content
 * it never added. This repository's own words and cards are the demo's, under
 * `data/demo/` and `public/demo/`.
 *
 * `.gitignore` cannot hold the rule, because the sites get that file too and
 * must track both directories. So this asks Git what is tracked, and only
 * where `origin` is this repository: the suite runs in every site, in its
 * sync gates and its CI, where tracking them is the point.
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const UPSTREAM = /[/:]seriouslysean\/occasional-wotd(\.git)?\/?$/;

const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
};

const isUpstream = UPSTREAM.test(git('remote', 'get-url', 'origin'));

describe.skipIf(!isUpstream)('Architecture: site content stays out of the engine', () => {
  it.each(['data/words', 'public/images'])('tracks nothing under %s', (directory) => {
    // Proves Git answered: an empty reply from a failed command would pass
    expect(git('ls-files', '--', 'package.json')).toBe('package.json');
    expect(git('ls-files', '--', directory)).toBe('');
  });
});
