import type { APIRoute } from 'astro';

import { getUrl, getWordUrl } from '#astro-utils/url-utils';
import { allWords } from '#astro-utils/word-data-utils';

/** Collapses HTML and whitespace so definition text is searchable as plain text. */
const toPlainText = (text: string): string => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Build-time search index: one entry per word with its name, all definition text
 * (for recall), and a BASE_PATH-correct URL baked in so the client never
 * recomputes paths. Consumed by the progressive-enhancement search on /word.
 */
export const GET: APIRoute = () => {
  const entries = allWords.map(wordData => ({
    word: wordData.word,
    definition: toPlainText(
      wordData.data
        .map(definition => (Array.isArray(definition.text) ? definition.text.join(' ') : definition.text ?? ''))
        .join(' '),
    ),
    url: getUrl(getWordUrl(wordData.word)),
  }));

  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
