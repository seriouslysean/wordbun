import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('#astro-utils/page-metadata', () => ({
  getAllPageMetadata: vi.fn(() => [
    { pathname: '/', title: 'Home' },
    { pathname: '/words', title: 'Words' },
    { pathname: '/stats', title: 'Stats' },
  ]),
}));

import { getSocialImageUrl, getStaticPages } from '#astro-utils/image-utils';

describe('image-utils', () => {
  describe('getSocialImageUrl', () => {
    afterEach(() => {
      mockEnv.SOURCE_DIR = '';
    });

    it('links a word page to its word card', () => {
      const url = getSocialImageUrl({ pathname: '/word/test', wordData: { word: 'test', date: '20240115' } });

      expect(url).toBe('/images/social/2024/20240115-test.png');
    });

    it('reads SOURCE_DIR from the env schema and puts it before images', () => {
      mockEnv.SOURCE_DIR = 'custom';

      const url = getSocialImageUrl({ pathname: '/word/test', wordData: { word: 'test', date: '20240115' } });

      expect(url).toBe('/custom/images/social/2024/20240115-test.png');
    });

    it('links a page without word data to its page card', () => {
      expect(getSocialImageUrl({ pathname: '/browse/2023/april' }))
        .toBe('/images/social/pages/browse-2023-april.png');
      expect(getSocialImageUrl({ pathname: '/stats', wordData: null }))
        .toBe('/images/social/pages/stats.png');
    });

    it('names the page card without BASE_PATH and links it under BASE_PATH once', () => {
      mockEnv.BASE_PATH = '/blog';

      const url = getSocialImageUrl({ pathname: '/blog/browse/2023/april' });

      expect(url).toBe('/blog/images/social/pages/browse-2023-april.png');
    });
  });

  describe('getStaticPages', () => {
    it('returns array of page metadata', async () => {
      const pages = await getStaticPages();

      expect(Array.isArray(pages)).toBe(true);
      expect(pages.length).toBeGreaterThan(0);
    });

    it('includes expected page properties', async () => {
      const pages = await getStaticPages();

      pages.forEach(page => {
        expect(page).toHaveProperty('pathname');
        expect(page).toHaveProperty('title');
      });
    });
  });
});
