import { describe, expect, it, vi } from 'vitest';

// tests/setup.ts swaps the locale for a small fixture; these are the strings
// the site ships.
vi.unmock('#locales/en.json');

import { tp } from '#utils/i18n-utils';

describe('shipped locale plurals', () => {
  it.each([
    ['stats.shortest', 'Shortest (1 Letter)', 'Shortest (2 Letters)'],
    ['stats.longest', 'Longest (1 Letter)', 'Longest (2 Letters)'],
    ['stats.least_syllables', 'Least Syllables (1 Syllable)', 'Least Syllables (2 Syllables)'],
    ['stats.most_syllables', 'Most Syllables (1 Syllable)', 'Most Syllables (2 Syllables)'],
    ['stats.most_vowels', 'Most Vowels (1 Vowel)', 'Most Vowels (2 Vowels)'],
    ['stats.most_consonants', 'Most Consonants (1 Consonant)', 'Most Consonants (2 Consonants)'],
    ['stats.most_common_letter', 'Most Common Letter (1 Word)', 'Most Common Letter (2 Words)'],
    ['stats.least_common_letter', 'Least Common Letter (1 Word)', 'Least Common Letter (2 Words)'],
    ['stats.days', '1 Day', '2 Days'],
    ['words.length_words_description', 'Words containing exactly 1 letter.', 'Words containing exactly 2 letters.'],
  ])('%s agrees with a count of one and of two', (key, one, two) => {
    expect(tp(key, 1)).toBe(one);
    expect(tp(key, 2)).toBe(two);
  });

  // A word with no vowels ("hmm", which also counts no syllables), one with no
  // consonants ("a") and a site with no streak all reach zero
  it.each([
    ['stats.least_syllables', 'Least Syllables (0 Syllables)'],
    ['stats.most_syllables', 'Most Syllables (0 Syllables)'],
    ['stats.most_vowels', 'Most Vowels (0 Vowels)'],
    ['stats.most_consonants', 'Most Consonants (0 Consonants)'],
    ['stats.days', '0 Days'],
  ])('%s has a form for zero', (key, zero) => {
    expect(tp(key, 0)).toBe(zero);
  });
});
