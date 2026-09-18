/**
 * Architecture test for how environment variables reach CI.
 *
 * astro.config.ts declares what the site reads, but a workflow only sees the
 * repository variables that .github/actions/setup-env copies into the job by
 * name. A variable declared in the schema and absent from those lists builds
 * fine locally and is silently its default in production: the COLOR_DARK_*
 * set was missing, so no deployed site could turn dark mode on.
 *
 * The action reads VAR_NAMES from repository variables and SECRET_NAMES from
 * secrets, never both. A name in the wrong list is read from the store the
 * owner did not fill, exported empty, and falls back to its default just as
 * silently: SITE_LOCALE in SECRET_NAMES builds <html lang="en-US"> whatever
 * the repository variable says.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf-8');

// `NAME: envField.string(...)` entries of env.schema
const DECLARED = /^\s+([A-Z][A-Z0-9_]*): envField\./gm;
// Values the action sets itself, such as SENTRY_ENVIRONMENT
const SET_BY_ACTION = /^\s+put_env ([A-Z][A-Z0-9_]*) /gm;

const names = (text, pattern) => [...text.matchAll(pattern)].map(match => match[1]);

// The lines of a `KEY: |` block scalar, which run until a line indented no
// deeper than the key. Lines stay as written, so a commented-out name is not
// mistaken for a listed one.
const blockLines = (text, key) => {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.trim() === `${key}: |`);
  if (start < 0) {
    return [];
  }
  const indent = lines[start].search(/\S/);
  const end = lines.findIndex((line, index) => index > start && line.trim() !== '' && line.search(/\S/) <= indent);
  return lines.slice(start + 1, end < 0 ? undefined : end).map(line => line.trim()).filter(Boolean);
};

// Where docs/technical.md tells site owners to store each setting: API keys,
// GA_* and SENTRY_* are secrets and everything else is a variable.
// SENTRY_ENVIRONMENT is the exception because the action sets it itself.
// The lists have to follow the same rule, or the action reads a store the
// owner never filled.
const isSecret = name =>
  name.endsWith('_API_KEY') || name.startsWith('GA_') || (name.startsWith('SENTRY_') && name !== 'SENTRY_ENVIRONMENT');

describe('Architecture: environment transport', () => {
  const action = read('.github/actions/setup-env/action.yml');
  const variables = blockLines(action, 'VAR_NAMES');
  const secrets = blockLines(action, 'SECRET_NAMES');

  it('exports every variable in the Astro env schema from setup-env', () => {
    const declared = names(read('astro.config.ts'), DECLARED);
    const exported = new Set([...variables, ...secrets, ...names(action, SET_BY_ACTION)]);

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter(name => !exported.has(name))).toEqual([]);
  });

  it('reads secrets from SECRET_NAMES and everything else from VAR_NAMES', () => {
    expect(variables.length).toBeGreaterThan(0);
    expect(secrets.length).toBeGreaterThan(0);
    expect(variables.filter(isSecret)).toEqual([]);
    expect(secrets.filter(name => !isSecret(name))).toEqual([]);
  });
});
