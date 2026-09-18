/**
 * Wordnik API types - External API structures
 */

import type { RateLimit } from '#types';

export interface WordnikDefinition {
  id?: string;
  partOfSpeech?: string;
  attributionText?: string;
  sourceDictionary?: string;
  // Usually a string; Wordnik occasionally returns an array of fragments
  text?: string | string[];
  sequence?: string | number;
  score?: number;
  word?: string;
  attributionUrl?: string;
  wordnikUrl?: string;
  citations?: Array<{
    source?: string;
    cite?: string;
  }>;
  exampleUses?: Array<{
    text: string;
    position?: number;
  }>;
  labels?: Array<{
    text: string;
    type?: string;
  }>;
  notes?: string[];
  relatedWords?: string[];
  textProns?: string[];
}

export interface WordnikResponse extends Array<WordnikDefinition> {
  rateLimits?: RateLimit;
}

export interface WordnikConfig {
  BASE_URL: string | undefined;
  DEFAULT_LIMIT: number;
  RATE_LIMIT_DELAY: number;
  RATE_LIMIT_BACKOFF: number;
}


