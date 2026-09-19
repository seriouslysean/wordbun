import { describe, expect, it, vi } from 'vitest';

vi.mock('#utils/i18n-utils', () => ({
  t: (key, values = {}) => key.replaceAll(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  tp: (key, count, values = {}) => `${key}_${Number(count) === 1 ? 'one' : 'other'}`
    .replaceAll(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? (name === 'count' ? count : name))),
}));

import { generateLlmsTxt, generateRobotsTxt } from '#astro-utils/static-file-utils';

const words = Array.from({ length: 6 }, (_, index) => {
  const day = String(21 - index).padStart(2, '0');
  return {
    word: `word${index + 1}`,
    date: `202501${day}`,
    adapter: 'wordnik',
    data: [{ text: `Definition ${index + 1}`, partOfSpeech: 'noun' }],
  };
});

describe('generateLlmsTxt', () => {
  it('lists newest words and applies BASE_PATH to every internal link', () => {
    mockEnv.BASE_PATH = '/demo';

    const output = generateLlmsTxt(words);
    const recentSection = output?.split('## Pages')[0] ?? '';

    expect(recentSection).toContain('- [word1](https://test.com/demo/word/word1): Jan 21, 2025');
    expect(recentSection).toContain('- [word5](https://test.com/demo/word/word5): Jan 17, 2025');
    expect(recentSection).not.toContain('[word6]');
    expect(output).toContain('](https://test.com/demo/word/word1)');
    expect(output).toContain('](https://test.com/demo/word)');
  });
});

describe('generateRobotsTxt', () => {
  it('applies BASE_PATH to the sitemap URL', () => {
    mockEnv.BASE_PATH = '/demo';

    expect(generateRobotsTxt('https://test.com')).toContain('Sitemap: https://test.com/demo/sitemap-index.xml');
  });
});
