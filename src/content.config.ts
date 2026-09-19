import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { isValidDate } from '#utils/date-utils';

const dictionaryDefinitionSchema = z.looseObject({
  id: z.string().optional(),
  partOfSpeech: z.string().optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
  references: z.array(z.object({
    start: z.number().int(),
    end: z.number().int(),
    url: z.string(),
  })).optional(),
  attributionText: z.string().optional(),
  sourceDictionary: z.string().optional(),
  sourceUrl: z.string().optional(),
  examples: z.array(z.string()).optional(),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
});

export const collections = {
  words: defineCollection({
    loader: glob({
      pattern: '**/*.json',
      base: __WORD_DATA_PATH__,
    }),
    schema: z.object({
      word: z.string().refine(word => word.trim().length > 0, 'Word must not be empty'),
      date: z.string().refine(isValidDate, 'Date must be a valid YYYYMMDD date'),
      adapter: z.string(),
      preserveCase: z.boolean().default(false),
      data: z.array(dictionaryDefinitionSchema).min(1),
      // Optional word-level enrichment. z.object strips unknown keys, so this
      // MUST be declared or stored enrichment never reaches render.
      enrichment: z
        .object({
          synonyms: z.array(z.string()).optional(),
          antonyms: z.array(z.string()).optional(),
          related: z.array(z.string()).optional(),
          pronunciation: z.string().optional(),
          audio: z.string().optional(),
          etymology: z.string().optional(),
        })
        .optional(),
    }),
  }),
};
