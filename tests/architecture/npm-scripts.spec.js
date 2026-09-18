/**
 * Architecture tests for package.json scripts.
 *
 * `npm run <script> --flag` hands the flag to npm, not to the script; only
 * arguments after a bare `--` reach the tool. A script that forgets the
 * separator silently runs the default invocation instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const { scripts } = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));

describe('Architecture: npm scripts', () => {
  it('nested npm run calls pass flags after a -- separator', () => {
    const swallowed = Object.entries(scripts)
      .filter(([, command]) => /npm run \S+ -(?!- )/.test(command))
      .map(([name]) => name);

    expect(swallowed).toEqual([]);
  });

  it('every node tools/*.ts script points at a file that exists', () => {
    const missing = Object.entries(scripts)
      .flatMap(([name, command]) => [...command.matchAll(/node (tools\/\S+\.ts)/g)].map(match => [name, match[1]]))
      .filter(([, file]) => !fs.existsSync(path.join(process.cwd(), file)))
      .map(([name]) => name);

    expect(missing).toEqual([]);
  });

  it('tool:generate-all-images runs the generator exactly once', () => {
    // The default invocation already covers every word and every generic page.
    expect(scripts['tool:generate-all-images']).toBe('node tools/generate-images.ts');
  });
});
