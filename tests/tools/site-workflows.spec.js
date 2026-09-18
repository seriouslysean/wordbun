/**
 * The shell steps of the reusable site workflows, run the way GitHub runs
 * them: bash with -e, the step's env and working-directory, and outputs
 * written to $GITHUB_OUTPUT. Each step comes straight out of the checked-in
 * YAML, and expression values in its env come from the context a test
 * supplies, so a renamed input or a changed script fails here rather than in
 * a live run. Fixture checkouts live in a temp dir.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const workflow = file => load(fs.readFileSync(path.join(ROOT, '.github/workflows', file), 'utf-8'));

const SHA = '0123456789abcdef0123456789abcdef01234567';

const ctx = { dir: '' };

// A whole-value ${{ expression }} becomes the context entry of that name
const evaluate = (value, context) => {
  const expression = String(value).match(/^\$\{\{\s*(.+?)\s*\}\}$/)?.[1];
  if (expression === undefined) {
    if (String(value).includes('${{')) {
      throw new Error(`Unsupported expression in ${value}`);
    }
    return String(value);
  }
  if (!(expression in context)) {
    throw new Error(`The test supplies no ${expression}`);
  }
  return context[expression];
};

/**
 * Runs one named step of a workflow in ctx.dir, the runner's workspace.
 * env stands in for what earlier steps exported through $GITHUB_ENV.
 */
const runStep = (file, name, { env = {}, context = {} } = {}) => {
  const doc = workflow(file);
  const [job, step] = Object.values(doc.jobs)
    .flatMap(candidate => (candidate.steps ?? []).map(found => [candidate, found]))
    .find(([, found]) => found.name === name) ?? [];
  if (!step) {
    throw new Error(`${file} has no step named ${name}`);
  }
  // Workflows keep expressions out of scripts, so an input is always data
  if (step.run.includes('${{')) {
    throw new Error(`${file}: ${name} expands an expression inside its script`);
  }

  const declared = { ...doc.env, ...job.env, ...step.env };
  const output = path.join(ctx.dir, 'github_output');
  fs.writeFileSync(output, '');

  const shell = ['--noprofile', '--norc', '-e', ...(step.shell === 'bash' ? ['-o', 'pipefail'] : [])];
  const { promise, resolve, reject } = Promise.withResolvers();
  const proc = spawn('bash', [...shell, '-c', step.run], {
    cwd: path.join(ctx.dir, step['working-directory'] ?? '.'),
    env: {
      PATH: process.env.PATH,
      HOME: ctx.dir,
      GITHUB_OUTPUT: output,
      ...env,
      ...Object.fromEntries(Object.entries(declared).map(([key, value]) => [key, evaluate(value, context)])),
    },
  });
  const chunks = [];
  proc.stdout.on('data', data => chunks.push(data.toString()));
  proc.stderr.on('data', data => chunks.push(data.toString()));
  proc.on('error', reject);
  proc.on('close', code => resolve({ code, output: chunks.join(''), outputs: fs.readFileSync(output, 'utf-8') }));
  return promise;
};

const write = (file, content) => {
  const target = path.join(ctx.dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

// Every file under a directory with its content, for before and after checks
const snapshot = dir => Object.fromEntries(
  fs.readdirSync(path.join(ctx.dir, dir), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(entry.parentPath, entry.name))
    .map(file => [path.relative(path.join(ctx.dir, dir), file), fs.readFileSync(file, 'utf-8')])
    .toSorted(([a], [b]) => a.localeCompare(b)),
);

const ENGINE_REPOSITORY = workflow('site-deploy.yml').env.ENGINE_REPOSITORY;

beforeEach(() => {
  ctx.dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wotd-site-workflow-')));
});

afterEach(() => {
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe('site workflows', { timeout: 20000 }, () => {
  describe.each([
    ['site-deploy.yml'],
  ])('%s engine ref', (file) => {
    const resolveRef = (workflowRef, repository = 'someone/wordbun') => runStep(file, 'Resolve engine ref', {
      env: { GITHUB_REPOSITORY: repository },
      context: { 'inputs.workflow-ref': workflowRef, 'github.workflow_sha': SHA },
    });
    const pinned = ref => `${ENGINE_REPOSITORY}/.github/workflows/${file}@${ref}`;

    it.each([
      ['a release tag', 'v3.23.0'],
      ['a full commit SHA', SHA],
    ])('takes %s from the pinned uses value', async (_, ref) => {
      const result = await resolveRef(pinned(ref));

      expect(result.code).toBe(0);
      expect(result.outputs).toBe(`ref=${ref}\n`);
    });

    it.each([
      ['a moving major tag', pinned('v3')],
      ['a partial version', pinned('v3.23')],
      ['a branch', pinned('main')],
      ['a full tag ref', pinned('refs/tags/v3.23.0')],
      ['a short SHA', pinned(SHA.slice(0, 12))],
      ['a second @', `${pinned('v3.23.0')}@v3.24.0`],
      ['another repository', `someone/occasional-wotd/.github/workflows/${file}@v3.23.0`],
      ['another workflow', `${ENGINE_REPOSITORY}/.github/workflows/build.yml@v3.23.0`],
      ['a bare version', 'v3.23.0'],
      ['junk', '$(touch PWNED)'],
    ])('refuses %s', async (_, workflowRef) => {
      const result = await resolveRef(workflowRef);

      expect(result.code).toBe(1);
      expect(result.output).toContain('::error::');
      expect(result.outputs).toBe('');
      expect(fs.existsSync(path.join(ctx.dir, 'PWNED'))).toBe(false);
    });

    it('checks out the calling commit when this repository calls its own copy', async () => {
      const result = await resolveRef('', ENGINE_REPOSITORY);

      expect(result.code).toBe(0);
      expect(result.outputs).toBe(`ref=${SHA}\n`);
    });

    it('refuses an empty workflow-ref from a site repository', async () => {
      const result = await resolveRef('');

      expect(result.code).toBe(1);
      expect(result.output).toContain('Pass workflow-ref');
      expect(result.outputs).toBe('');
    });
  });

  describe.each([
    ['site-deploy.yml'],
  ])('%s overlay', (file) => {
    const overlay = (repository, sourceDir) => runStep(file, 'Overlay site content', {
      env: { GITHUB_REPOSITORY: repository, SOURCE_DIR: sourceDir },
    });

    beforeEach(() => {
      write('engine/package.json', '{}\n');
      write('engine/src/pages/index.astro', 'engine page\n');
      write('engine/data/demo/words/2025/20250101.json', '{"word":"demo"}\n');
      write('engine/public/favicon.svg', 'engine favicon\n');
      write('engine/public/demo/images/social/2025/demo.png', 'demo card\n');
      write('engine/public/demo/images/social/.image-settings-hash', 'demo marker\n');
    });

    const thinSite = () => {
      write('site/data/words/2026/20260101.json', '{"word":"site"}\n');
      write('site/public/images/social/2026/site.png', 'site card\n');
      write('site/public/images/social/.image-settings-hash', 'site marker\n');
      write('site/public/robots.txt', 'site robots\n');
    };

    it('mirrors a thin site and drops the demo content, keeping the engine favicon', async () => {
      thinSite();
      const code = snapshot('engine/src');

      const result = await overlay('someone/wordbun', '');

      expect(result.code).toBe(0);
      expect(snapshot('engine/data')).toEqual(snapshot('site/data'));
      expect(snapshot('engine/public')).toEqual({ ...snapshot('site/public'), 'favicon.svg': 'engine favicon\n' });
      expect(snapshot('engine/src')).toEqual(code);
    });

    it("uses the site's favicon when it has one", async () => {
      thinSite();
      write('site/public/favicon.svg', 'site favicon\n');

      const result = await overlay('someone/wordbun', '');

      expect(result.code).toBe(0);
      expect(snapshot('engine/public')).toEqual(snapshot('site/public'));
    });

    it('leaves the demo content in place for this repository', async () => {
      fs.cpSync(path.join(ctx.dir, 'engine/data'), path.join(ctx.dir, 'site/data'), { recursive: true });
      fs.cpSync(path.join(ctx.dir, 'engine/public'), path.join(ctx.dir, 'site/public'), { recursive: true });
      const before = snapshot('engine');

      const result = await overlay(ENGINE_REPOSITORY, 'demo');

      expect(result.code).toBe(0);
      expect(snapshot('engine')).toEqual(before);
    });

    it.each([
      ['the demo content in a site repository', 'someone/wordbun', 'demo'],
      ['another directory in a site repository', 'someone/wordbun', 'wordbun'],
      ['the root content in this repository', ENGINE_REPOSITORY, ''],
    ])('refuses %s', async (_, repository, sourceDir) => {
      thinSite();
      write('site/data/demo/words/2025/20250101.json', '{"word":"demo"}\n');
      const before = snapshot('engine');

      const result = await overlay(repository, sourceDir);

      expect(result.code).toBe(1);
      expect(result.output).toContain('::error::SOURCE_DIR');
      expect(snapshot('engine')).toEqual(before);
    });

    it.each([
      ['words', 'site/public/favicon.svg'],
      ['public files', 'site/data/words/2026/20260101.json'],
    ])('refuses a site without %s instead of emptying the engine', async (_, onlyFile) => {
      write(onlyFile, 'only\n');
      const before = snapshot('engine');

      const result = await overlay('someone/wordbun', '');

      expect(result.code).toBe(1);
      expect(result.output).toContain('::error::The site needs');
      expect(snapshot('engine')).toEqual(before);
    });
  });
});
