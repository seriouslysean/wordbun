import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// tests/setup.js swaps the locale for a small fixture that lacks some page
// headings; building the page list reads them all.
vi.unmock('#locales/en.json');

import { getAllWords } from '#tools/utils';
import { getAllPageMetadata } from '#utils/page-metadata-utils';

const PAGES_DIR = 'src/pages';
const PAGE_EXTENSION = '.astro';

const isParam = name => /^\[[^\]]+\]$/.test(name);

// Whether a URL path's segments resolve to a page under dir. Only .astro
// files are pages; the .ts files beside them are endpoints (rss.xml.ts).
// A literal file or directory claims its name at that level, so a path that
// names one must resolve through it: `[year]` would otherwise accept any
// segment, including `part-of-speech`, and only its getStaticPaths (which
// needs the Astro runtime) knows the one it does not generate.
const resolvesToPage = (dir, [segment, ...rest]) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const pages = entries
    .filter(entry => entry.isFile() && entry.name.endsWith(PAGE_EXTENSION))
    .map(entry => entry.name.slice(0, -PAGE_EXTENSION.length));
  const dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
  const claimed = pages.includes(segment) || dirs.includes(segment);
  const matches = names => names.filter(name => (claimed ? name === segment : isParam(name)));

  if (rest.length === 0) {
    return matches(pages).length > 0
      || matches(dirs).some(name => existsSync(join(dir, name, `index${PAGE_EXTENSION}`)));
  }
  return matches(dirs).some(name => resolvesToPage(join(dir, name), rest));
};

// Architecture layer: page metadata drives the social card generator and
// llms.txt, while src/pages decides what the site serves. The social images
// spec compares metadata with the generator, which reads the same metadata,
// so only the route files can say a listed page is real. Runs against the
// demo dataset for the dynamic pages.
describe('Architecture: page routes', () => {
  it('every page with metadata has a route under src/pages', () => {
    const { words } = getAllWords();
    const paths = getAllPageMetadata(words).map(page => page.path);
    const unrouted = paths.filter(path => !resolvesToPage(PAGES_DIR, path.split('/').filter(Boolean)));

    expect(words.length).toBeGreaterThan(0);
    expect(unrouted).toEqual([]);
  });
});
