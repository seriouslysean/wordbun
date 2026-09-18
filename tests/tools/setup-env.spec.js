/**
 * The setup-env composite action's script, run the way the runner runs it:
 * bash with -e and pipefail, and its env block with the inputs filled in.
 * $GITHUB_ENV is the process's stdout, so the workflow commands the script
 * prints and the variables it writes land in one stream in the order the
 * runner would see them.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ACTION = load(fs.readFileSync(path.join(process.cwd(), '.github/actions/setup-env/action.yml'), 'utf-8'));
const [STEP] = ACTION.runs.steps;

const VAR_NAMES = STEP.env.VAR_NAMES.split('\n').filter(Boolean);

const runAction = ({ vars, secrets }) => {
  const inputs = {
    '${{ inputs.vars-json }}': JSON.stringify(vars),
    '${{ inputs.secrets-json }}': JSON.stringify(secrets),
  };
  const env = Object.fromEntries(Object.entries(STEP.env).map(([key, value]) => [key, inputs[value] ?? value]));
  if (Object.values(env).some(value => value.includes('${{'))) {
    throw new Error('The action reads an input this test does not supply');
  }
  const { promise, resolve, reject } = Promise.withResolvers();
  const proc = spawn('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', STEP.run], {
    env: { PATH: process.env.PATH, GITHUB_ENV: '/dev/stdout', ...env },
  });
  const out = [];
  const err = [];
  proc.stdout.on('data', data => out.push(data.toString()));
  proc.stderr.on('data', data => err.push(data.toString()));
  proc.on('error', reject);
  proc.on('close', code => resolve({ code, stdout: out.join(''), stderr: err.join('') }));
  return promise;
};

/**
 * The stream as a list of events: a mask, or a variable written in the
 * NAME<<delimiter form with its value.
 */
const parse = stdout => {
  const lines = stdout.split('\n');
  const events = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (line.startsWith('::add-mask::')) {
      events.push({ mask: line.slice('::add-mask::'.length) });
      continue;
    }
    const heredoc = line.match(/^([A-Z][A-Z0-9_]*)<<(EOF_[0-9a-f]{32})$/);
    if (!heredoc) {
      expect(line).toBe('');
      continue;
    }
    const end = lines.indexOf(heredoc[2], index + 1);
    events.push({ name: heredoc[1], value: lines.slice(index + 1, end).join('\n') });
    index = end;
  }
  return events;
};

describe('setup-env action', () => {
  const SECRETS = {
    WORDNIK_API_KEY: 'wordnik-key-123',
    MERRIAM_WEBSTER_API_KEY: 'first line\n\n  \nsecond line\r\nthird line',
    SENTRY_DSN: 'https://abc%40def@sentry.example/1',
    SENTRY_AUTH_TOKEN: '',
    GA_ENABLED: 'true',
  };
  const VARS = {
    SITE_TITLE: 'Word Bug',
    SITE_DESCRIPTION: 'Two\nlines',
    DICTIONARY_ADAPTER: 'wordnik',
    SITE_TZ: 'America/Chicago',
  };

  it('masks each line of every secret value before writing it, and no variable', async () => {
    const result = await runAction({ vars: VARS, secrets: SECRETS });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const events = parse(result.stdout);
    const masks = events.filter(event => 'mask' in event).map(event => event.mask);

    // Blank lines are skipped and % is escaped, since the runner reads
    // command data with %25 as %
    expect(masks).toEqual([
      'true',
      'first line',
      'second line',
      'third line',
      'https://abc%2540def@sentry.example/1',
      'wordnik-key-123',
    ]);

    // Each secret's masks come straight before its write, and an empty
    // secret has none
    const at = name => events.findIndex(event => event.name === name);
    const before = (name, count) => events.slice(at(name) - count, at(name));
    expect(before('GA_ENABLED', 1)).toEqual([{ mask: 'true' }]);
    expect(before('MERRIAM_WEBSTER_API_KEY', 3)).toEqual([{ mask: 'first line' }, { mask: 'second line' }, { mask: 'third line' }]);
    expect(before('SENTRY_AUTH_TOKEN', 1)).toEqual([{ name: 'MERRIAM_WEBSTER_API_KEY', value: SECRETS.MERRIAM_WEBSTER_API_KEY }]);
    expect(before('SENTRY_DSN', 1)).toEqual([{ mask: 'https://abc%2540def@sentry.example/1' }]);
    expect(before('WORDNIK_API_KEY', 1)).toEqual([{ mask: 'wordnik-key-123' }]);

    // Variables are written before any mask and none is masked
    const lastVariable = Math.max(...VAR_NAMES.map(at));
    expect(events.findIndex(event => 'mask' in event)).toBeGreaterThan(lastVariable);
    expect(masks.filter(mask => Object.values(VARS).some(value => value.split('\n').includes(mask)))).toEqual([]);

    // The values themselves are written unchanged
    const byName = Object.fromEntries(events.filter(event => 'name' in event).map(event => [event.name, event.value]));
    expect(byName.MERRIAM_WEBSTER_API_KEY).toBe(SECRETS.MERRIAM_WEBSTER_API_KEY);
    expect(byName.SENTRY_DSN).toBe(SECRETS.SENTRY_DSN);
    expect(byName.SITE_DESCRIPTION).toBe('Two\nlines');
    expect(byName.TZ).toBe('America/Chicago');
  });

  it('masks nothing when no secret has a value', async () => {
    const result = await runAction({ vars: VARS, secrets: {} });

    expect(result.code).toBe(0);
    expect(parse(result.stdout).filter(event => 'mask' in event)).toEqual([]);
  });
});
