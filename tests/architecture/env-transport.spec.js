/**
 * Architecture test for how environment variables reach CI.
 *
 * astro.config.ts declares what the site reads, but a workflow only sees the
 * repository variables that .github/actions/setup-env copies into the job by
 * name. A variable declared in the schema and absent from those lists builds
 * fine locally and is silently its default in production: the COLOR_DARK_*
 * set was missing, so no deployed site could turn dark mode on.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf-8');

// `NAME: envField.string(...)` entries of env.schema
const DECLARED = /^\s+([A-Z][A-Z0-9_]*): envField\./gm;
// A name alone on its line is a VAR_NAMES or SECRET_NAMES entry
const LISTED = /^\s+([A-Z][A-Z0-9_]*)$/gm;
// Values the action sets itself, such as SENTRY_ENVIRONMENT
const ECHOED = /^\s+put_env ([A-Z][A-Z0-9_]*) /gm;

const names = (text, pattern) => [...text.matchAll(pattern)].map(match => match[1]);

describe('Architecture: environment transport', () => {
  it('exports every variable in the Astro env schema from setup-env', () => {
    const declared = names(read('astro.config.ts'), DECLARED);
    const action = read('.github/actions/setup-env/action.yml');
    const exported = new Set([...names(action, LISTED), ...names(action, ECHOED)]);

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter(name => !exported.has(name))).toEqual([]);
  });
});
