/**
 * Architecture test to keep browser bundles small
 *
 * Bundled <script> blocks in .astro files import a few pure modules from
 * utils/. Vite ships everything those modules import as values, so a single
 * re-export in one of them (say, of a dictionary helper) pulls the
 * part-of-speech vocabulary into every page's JavaScript while every other
 * gate stays green. Each client-reachable module in utils/ and types/ may
 * import values only from the allowlist below. `import type` and
 * `export type` are erased at build time and always allowed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

// Growing this list grows the client bundle: build and compare the shared
// chunk in dist/_astro/ before adding to it.
const CLIENT_VALUE_IMPORTS = new Set(['#utils/type-guards']);

// is:inline scripts (JSON-LD, analytics) are emitted verbatim, not bundled
const BUNDLED_SCRIPT = /<script(?![^>]*\bis:inline\b)[^>]*>([\s\S]*?)<\/script>/g;
// import/export statements with a module specifier; the clause before
// `from` never contains quotes or semicolons, which keeps a match inside one
// statement
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\bfrom\s*)?['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const valueImports = source => [
  ...[...source.matchAll(STATIC_IMPORT)]
    .filter(([, typeOnly]) => !typeOnly)
    .map(([, , specifier]) => specifier),
  ...[...source.matchAll(DYNAMIC_IMPORT)].map(([, specifier]) => specifier),
];

// Only utils/ and types/ are followed: src/ modules have their own rules
const resolveLocal = specifier => {
  if (specifier === '#types') {
    return 'types/index.ts';
  }
  const match = /^#(utils|types)\/(.+)$/.exec(specifier);
  return match ? `${match[1]}/${match[2]}.ts` : null;
};

const clientEntryModules = () => {
  const astroFiles = fs.readdirSync(SRC_DIR, { recursive: true })
    .filter(file => file.endsWith('.astro'));
  const specifiers = astroFiles.flatMap(file => {
    const content = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
    return [...content.matchAll(BUNDLED_SCRIPT)].flatMap(([, body]) => valueImports(body));
  });
  return [...new Set(specifiers.map(resolveLocal).filter(Boolean))];
};

describe('Architecture: client bundle imports', () => {
  it('finds the modules client scripts import from utils/ and types/', () => {
    expect(clientEntryModules().length).toBeGreaterThan(0);
  });

  it('client-reachable modules import values only from the allowlist', () => {
    const queue = clientEntryModules();
    const seen = new Set(queue);

    while (queue.length > 0) {
      const modulePath = queue.shift();
      const content = fs.readFileSync(path.join(ROOT, modulePath), 'utf-8');

      for (const specifier of valueImports(content)) {
        expect(
          CLIENT_VALUE_IMPORTS.has(specifier),
          `${modulePath} is bundled into client scripts and imports values from ${specifier}; `
          + 'use `import type`, move the code out of this module, or add the specifier to '
          + 'CLIENT_VALUE_IMPORTS after checking the bundle size',
        ).toBe(true);

        const resolved = resolveLocal(specifier);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          queue.push(resolved);
        }
      }
    }
  });
});
