import { dateToYYYYMMDD, YYYYMMDDToDate } from '~utils/date-utils';
import { logger } from '~utils/logger';
import type {
  WordData,
  WordStatsResult,
  WordLetterStatsResult,
  WordMilestoneResult,
  WordPatternStatsResult,
  WordEndingStatsResult,
  WordStreakStatsResult,
} from '~types/word';

/**
 * Calculate comprehensive statistics for a collection of words
 */
export const getWordStats = (words: WordData[]): WordStatsResult => {
  return words.reduce((acc, word) => {
    // Length stats
    if (!acc.longest || word.word.length > acc.longest.word.length) {
      acc.longest = { word: word.word, length: word.word.length };
    }
    if (!acc.shortest || word.word.length < acc.shortest.word.length) {
      acc.shortest = { word: word.word, length: word.word.length };
    }

    // Palindrome stats
    const isPalindrome = word.word.toLowerCase() === word.word.toLowerCase().split('').reverse().join('');
    if (isPalindrome) {
      if (!acc.longestPalindrome || word.word.length > acc.longestPalindrome.word.length) {
        acc.longestPalindrome = { word: word.word, length: word.word.length };
      }
      if (!acc.shortestPalindrome || word.word.length < acc.shortestPalindrome.word.length) {
        acc.shortestPalindrome = { word: word.word, length: word.word.length };
      }
    }

    // Letter frequency - count all letters in each word
    const letters = word.word.toLowerCase().split('');
    letters.forEach(letter => {
      acc.letterFrequency[letter] = (acc.letterFrequency[letter] || 0) + 1;
    });

    return acc;
  }, {
    longest: null,
    shortest: null,
    longestPalindrome: null,
    shortestPalindrome: null,
    letterFrequency: {},
  });
};

/**
 * Convert letter frequency data to sorted array
 */
export const getLetterStats = (letterFrequency: Record<string, number>): WordLetterStatsResult => {
  return Object.entries(letterFrequency)
    .sort(([, a], [, b]) => b - a);
};

/**
 * Get words at specific milestone positions
 */
export const getMilestoneWords = (words: WordData[]): WordMilestoneResult => ({
  25: words[24],
  50: words[49],
  100: words[99],
});

/**
 * Analyze words for interesting letter patterns
 */
export const getLetterPatternStats = (words: WordData[]): WordPatternStatsResult => {
  const patterns = {
    startEndSame: [],
    doubleLetters: [],
    tripleLetters: [],
    alphabetical: [],
  };

  words.forEach(wordObj => {
    const word = wordObj.word.toLowerCase();

    // Same start and end letter
    if (word.length > 1 && word[0] === word[word.length - 1]) {
      patterns.startEndSame.push(wordObj);
    }

    // Double letters
    if (/(.)\1/.test(word)) {
      patterns.doubleLetters.push(wordObj);
    }

    // Triple or more same letters
    if (/(.)\1{2,}/.test(word)) {
      patterns.tripleLetters.push(wordObj);
    }

    // Alphabetical order (consecutive letters)
    const letters = word.split('');
    let isAlphabetical = false;
    for (let i = 0; i < letters.length - 2; i++) {
      const a = letters[i].charCodeAt(0);
      const b = letters[i + 1].charCodeAt(0);
      const c = letters[i + 2].charCodeAt(0);
      if (b === a + 1 && c === b + 1) {
        isAlphabetical = true;
        break;
      }
    }
    if (isAlphabetical) {
      patterns.alphabetical.push(wordObj);
    }
  });

  return patterns;
};

/**
 * Analyze words by common endings
 */
export const getWordEndingStats = (words: WordData[]): WordEndingStatsResult => {
  const endings = {
    ing: [],
    ed: [],
    ly: [],
  };

  words.forEach(wordObj => {
    const word = wordObj.word.toLowerCase();

    if (word.endsWith('ing')) {
      endings.ing.push(wordObj);
    }
    if (word.endsWith('ed')) {
      endings.ed.push(wordObj);
    }
    if (word.endsWith('ly')) {
      endings.ly.push(wordObj);
    }
  });

  return endings;
};

/**
 * Calculate current and longest word streaks
 */
export const getCurrentStreakStats = (words: WordData[]): WordStreakStatsResult => {
  if (!words.length) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      isActive: false,
    };
  }

  const sortedWords = [...words].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date();
  const todayString = dateToYYYYMMDD(today);
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(today.getDate() - 1);
  const yesterdayString = dateToYYYYMMDD(yesterdayDate);

  // Check if streak is active (a word exists for today or yesterday)
  const mostRecentWord = sortedWords[0];
  const isActive = mostRecentWord.date === todayString || mostRecentWord.date === yesterdayString;

  // Calculate current streak
  const calculateCurrentStreak = () => {
    if (!isActive) {
      return 0;
    }

    const streakData = {
      count: 1,
      lastDate: mostRecentWord.date,
    };

    for (const word of sortedWords.slice(1)) {
      if (areConsecutiveDays(word.date, streakData.lastDate)) {
        streakData.count++;
        streakData.lastDate = word.date;
      } else {
        break;
      }
    }

    return streakData.count;
  };

  // Calculate longest streak
  const calculateLongestStreak = () => {
    if (words.length === 1) {
      return 1;
    }

    const streakData = {
      longest: 0,
      current: 1,
    };

    for (const [index, word] of sortedWords.entries()) {
      if (index === 0) {
        continue;
      }

      if (areConsecutiveDays(word.date, sortedWords[index - 1].date)) {
        streakData.current++;
      } else {
        streakData.longest = Math.max(streakData.longest, streakData.current);
        streakData.current = 1;
      }
    }

    return Math.max(streakData.longest, streakData.current);
  };

  const currentStreak = calculateCurrentStreak();
  const longestStreak = calculateLongestStreak();

  return {
    currentStreak,
    longestStreak,
    isActive,
  };
};

/**
 * Check if two dates are consecutive days
 */
const areConsecutiveDays = (olderDate: string, newerDate: string): boolean => {
  const dOlder = YYYYMMDDToDate(olderDate);
  const dNewer = YYYYMMDDToDate(newerDate);

  if (!dOlder || !dNewer) {
    logger.warn('Invalid date in areConsecutiveDays', { olderDate, newerDate });
    return false;
  }

  const diffTime = dNewer.getTime() - dOlder.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays === 1;
};