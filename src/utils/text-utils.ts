import type { TextSyllableSpecialCases } from '~types/utils';

/**
 * @param word - The word to analyze
 * @returns Number of vowels found (case-insensitive)
 */
export const getVowelCount = (word: string): number => {
  if (!word) {
    return 0;
  }
  return (word.match(/[aeiou]/gi) || []).length;
};

/**
 * @param word - The word to analyze
 * @returns Number of consonants found (case-insensitive)
 */
export const getConsonantCount = (word: string): number => {
  if (!word) {
    return 0;
  }
  return (word.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
};

/**
 * Checks if a word reads the same forwards and backwards
 * @param word - The word to check
 * @returns True if the word is a palindrome (case-insensitive)
 */
export const isPalindrome = (word: string): boolean => {
  if (!word) {
    return false;
  }
  const lower = word.toLowerCase();
  return lower === lower.split('').reverse().join('');
};

/**
 * Estimates syllable count using vowel groups and special cases
 * @param word - The word to analyze
 * @returns Estimated number of syllables (minimum 1)
 */
export const countSyllables = (word: string): number => {
  if (!word) {
    return 0;
  }

  const cleanWord = word.toLowerCase().trim();

  const specialCases: TextSyllableSpecialCases = {
    'ululated': 4,
  };
  if (specialCases[cleanWord]) {
    return specialCases[cleanWord];
  }

  const processedWord = cleanWord.replace(/([^aeiou])e$/, '$1');
  const syllableGroups = processedWord.match(/[aeiouy]+/gi) || [];
  const endsWithE = /[^aeiou]e$/i.test(cleanWord);
  const syllableCount = syllableGroups.length - (endsWithE ? 1 : 0);

  return Math.max(1, syllableCount);
};

/**
 * @param count - Number of words
 * @returns Formatted string with proper singular/plural form
 */
export const formatWordCount = (count: number): string => {
  return `${count} ${count === 1 ? 'word' : 'words'}`;
};
