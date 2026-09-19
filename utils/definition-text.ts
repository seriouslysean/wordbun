import { decodeHTML } from 'entities';

import type { DictionaryReference } from '#types';
import { isHttpUrl, isNonblankString, isRecord } from '#utils/type-guards';

/**
 * A definition's text read out of markup: plain text, and each
 * cross-reference in it as a range of that text.
 */
export interface DefinitionText {
  text: string;
  references: DictionaryReference[];
}

// An HTML-style tag: `<`, an optional `/`, a name that starts with a letter,
// then anything but angle brackets up to `>`. A `<` without a name after it,
// as in "a < b" or "(<20 mg/dL)", is text.
const TAG = /<(\/?)([A-Za-z][\w-]*)([^<>]*)>/;
const TAGS = new RegExp(TAG.source, 'g');

// Wordnik's <internalXref> names its target already URL-encoded
const INTERNAL_XREF_TARGET = /\burlencoded\s*=\s*(["'])(.*?)\1/i;
const URL_PATH_SEGMENT = /^(?:[\w.~-]|%[\dA-Fa-f]{2})+$/;

const WORDNIK_WEBSITE_URL = 'https://www.wordnik.com';

// Read at call time rather than import time so the build, the CLI and tests
// each see their own environment. Defaults like MERRIAM_WEBSTER_API_URL: the
// Add Word workflow does not set it, and a fetched cross-reference needs it.
const wordnikWordsUrl = (path: string): string =>
  `${process.env.WORDNIK_WEBSITE_URL || WORDNIK_WEBSITE_URL}/words/${path}`;

/**
 * The Wordnik page for a word, lowercased as Wordnik's own word URLs are.
 */
const generateWordnikWordUrl = (word: string): string => wordnikWordsUrl(encodeURIComponent(word.toLowerCase()));

/**
 * True when the text holds anything shaped like an HTML tag. Canonical text
 * is plain, so a tag in it is markup an adapter failed to translate.
 */
export const hasMarkup = (text: string): boolean => TAG.test(text);

// A cross-reference opened and not yet closed. An <xref> links the word it
// wraps, so its URL waits for the closing tag; an <internalXref> names its
// target when it opens.
type OpenReference =
  | { type: 'xref'; start: number }
  | { type: 'internalxref'; start: number; url: string };

const openReference = (name: string, attributes: string, start: number): OpenReference | null => {
  if (name === 'xref') {
    return { type: 'xref', start };
  }
  const target = INTERNAL_XREF_TARGET.exec(attributes)?.[2];
  if (name === 'internalxref' && target && URL_PATH_SEGMENT.test(target)) {
    return { type: 'internalxref', start, url: wordnikWordsUrl(target) };
  }
  return null;
};

/**
 * The reference an open tag makes now that it has closed on the text read so
 * far: the wrapped text less its outer whitespace, or none when that is blank.
 */
const closeReference = (open: OpenReference, text: string): DictionaryReference | null => {
  const wrapped = text.slice(open.start);
  const start = open.start + wrapped.length - wrapped.trimStart().length;
  const end = text.length - (wrapped.length - wrapped.trimEnd().length);
  if (start >= end) {
    return null;
  }
  const url = open.type === 'xref' ? generateWordnikWordUrl(text.slice(start, end)) : open.url;
  return { start, end, url };
};

/**
 * Reads Wordnik's definition markup as plain text and cross-references.
 * `<xref>word</xref>` links the Wordnik page for the word it wraps, and
 * `<internalXref urlencoded="target">label</internalXref>` the page it names.
 * Any other tag is dropped and its content kept as text, so nothing in the
 * result is markup. Character references (`&lt;`, `&amp;`) are decoded, as a
 * browser would. Cross-references do not nest: a new one opening abandons the
 * one still open, whose text stays plain; a closing tag that matches nothing
 * open is dropped, and so is a reference never closed.
 *
 * The one parser of this markup: the Wordnik adapter translates fetched text
 * with it, and the site reads stored text written before the canonical
 * contract through it.
 */
export function parseDefinitionMarkup(markup: string): DefinitionText {
  const references: DictionaryReference[] = [];
  let text = '';
  let cursor = 0;
  let open: OpenReference | null = null;

  for (const match of markup.matchAll(TAGS)) {
    const [tag, closing, name = '', attributes = ''] = match;
    text += decodeHTML(markup.slice(cursor, match.index));
    cursor = match.index + tag.length;
    const tagName = name.toLowerCase();

    if (!closing) {
      open = openReference(tagName, attributes, text.length) ?? open;
    } else if (open?.type === tagName) {
      const reference = closeReference(open, text);
      if (reference) {
        references.push(reference);
      }
      open = null;
    }
  }

  return { text: text + decodeHTML(markup.slice(cursor)), references };
}

const REFERENCE_KEYS: ReadonlySet<string> = new Set(['start', 'end', 'url']);

const isReference = (value: unknown): value is DictionaryReference =>
  isRecord(value)
  && Object.keys(value).every(key => REFERENCE_KEYS.has(key))
  && Number.isInteger(value.start)
  && Number.isInteger(value.end)
  && isHttpUrl(value.url);

/**
 * True when the value is a list of cross-references that fit the text: each
 * starts no earlier than the previous one ended, covers at least one
 * character, stays inside the text, covers nonblank text, and links an
 * absolute http(s) URL. An empty list fits any text.
 */
export const areValidReferences = (text: string, value: unknown): value is DictionaryReference[] =>
  Array.isArray(value)
  && value.every(isReference)
  && value.every(({ start, end }, index) =>
    start >= (value[index - 1]?.end ?? 0)
    && start < end
    && end <= text.length
    && isNonblankString(text.slice(start, end)));
