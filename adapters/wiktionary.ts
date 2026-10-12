import { decodeHTML } from 'entities';

import type {
  DictionaryAdapter,
  DictionaryResponse,
  WiktionaryDefinition,
  WiktionaryUsage,
} from '#types';
import type { BasePartOfSpeech } from '#constants/parts-of-speech';
import {
  adapterFetch,
  buildDefinition,
  buildDictionaryResponse,
  parseJsonResponse,
  throwOnHttpError,
  throwUnexpectedShape,
  throwWordNotFound,
} from '#utils/adapter-utils';
import { isOptional, isRecord, isString, isStringArray } from '#utils/type-guards';

// Wikimedia's own definition endpoint for English Wiktionary. Overridable as
// MERRIAM_WEBSTER_API_URL is, so a test can answer for it.
const DEFAULT_API_URL = 'https://en.wiktionary.org/api/rest_v1';
const PAGE_URL = 'https://en.wiktionary.org/wiki';

// The endpoint keys its answer by language code; only English entries are read
const ENGLISH = 'en';

/**
 * Wikimedia asks every client for a User-Agent that names it and gives a way
 * to reach its operator: "Set a unique `User-Agent` or `Api-User-Agent`
 * header that allows us to contact you quickly. Email addresses or URLs of
 * contact pages work well." (https://en.wiktionary.org/api/rest_v1/, Global
 * Rules). The repository URL is that contact; a generic agent may be blocked
 * (https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy).
 */
const USER_AGENT = 'occasional-wotd (https://github.com/seriouslysean/occasional-wotd)';

/**
 * What a page shows beside a definition from here. Wiktionary's text is
 * CC BY-SA 4.0, which asks a reuser to credit it, name the licence and
 * "indicate if You modified the Licensed Material" (section 3(a)(1),
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode.en): this text is
 * modified, its markup and links removed, hence "Adapted". The link to the
 * material that the licence also asks for is the definition's sourceUrl.
 */
const ATTRIBUTION = 'Adapted from Wiktionary (CC BY-SA 4.0)';

/**
 * Maps Wiktionary's part-of-speech headings to elementary types. Most are
 * already vocabulary values once lowercased ("Noun"); any other heading
 * ("Phrase", "Numeral", "Suffix") is kept as the definition's `label`.
 */
const POS_MAP = {
  'proper noun': 'noun',
} satisfies Readonly<Record<string, BasePartOfSpeech>>;

const isDefinition = (value: unknown): value is WiktionaryDefinition =>
  isRecord(value)
  && isString(value.definition)
  && isOptional(value.examples, isStringArray);

const isUsage = (value: unknown): value is WiktionaryUsage =>
  isRecord(value)
  && isString(value.partOfSpeech)
  && Array.isArray(value.definitions) && value.definitions.every(isDefinition);

/**
 * Checks every field fetchWordData reads from the English entries, down to
 * each definition, so a malformed one is refused before the transform runs.
 */
export const isWiktionaryUsages = (value: unknown): value is WiktionaryUsage[] =>
  Array.isArray(value) && value.every(isUsage);

/**
 * Reads the endpoint's HTML as plain text: tags are dropped and their content
 * kept, character references are decoded, and runs of whitespace become
 * single spaces. Links
 * to other entries are dropped with the rest of the markup, as the
 * Merriam-Webster adapter drops its cross-references: Wiktionary links nearly
 * every content word of a definition. A `<style>` element goes with its
 * content, which is a template's stylesheet and no part of the text
 * ("antidisestablishmentarianism" carries one). A literal `<` is always
 * written `&lt;` in HTML, so every raw one opens a tag.
 */
export const htmlToText = (html: string): string =>
  decodeHTML(html.replaceAll(/<style\b[^>]*>.*?<\/style>/gis, '').replaceAll(/<[^>]*>/g, ''))
    .replaceAll(/\s+/g, ' ')
    .trim();

// Where a sense's subsenses begin: the ordered list nested in its HTML
const SUBSENSES = /<ol\b/i;

/**
 * A sense's own HTML, without its subsenses. The endpoint sends a sense that
 * has subsenses twice over: its text is followed by a nested `<ol>` holding
 * every subsense, and each subsense then comes again as a definition of its
 * own. "water" has "A combination of water and other substance(s)." with
 * "Mineral water." nested in it and again as the next item; "Paris" has "A
 * locale in the United States." with twenty-five places nested and then
 * listed. So the sense's own text ends where the list opens. The list is cut
 * to the end rather than to its closing tag, which the endpoint leaves out.
 * The subsenses stay as the definitions the endpoint makes of them: each is a
 * sense of the word, often the specific one a reader is after, and dropping
 * them would leave "water" without mineral water and "Paris" without Texas.
 */
const ownSenseHtml = (html: string): string => html.slice(0, SUBSENSES.exec(html)?.index);

/**
 * True for an item that is a footnote of the page and no sense of the word.
 * The endpoint lists every numbered item under a part of speech, and a
 * footnote list is one: "pneumonoultramicroscopicsilicovolcanoconiosis"
 * comes back with a note on its pronunciation as its second definition.
 * MediaWiki's Cite extension marks the text of every footnote with this class.
 */
const isFootnote = (html: string): boolean => html.includes('mw-reference-text');

/**
 * The entry's page on Wiktionary, whose history lists its authors. A title
 * is written with underscores for spaces.
 */
const getPageUrl = (word: string): string => `${PAGE_URL}/${encodeURIComponent(word.replaceAll(' ', '_'))}`;

export const wiktionaryAdapter: DictionaryAdapter = {
  name: 'wiktionary',

  async fetchWordData(word: string): Promise<DictionaryResponse> {
    const baseUrl = process.env.WIKTIONARY_API_URL || DEFAULT_API_URL;
    const url = `${baseUrl}/page/definition/${encodeURIComponent(word)}`;
    const response = await adapterFetch(url, 'Wiktionary', { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT });
    throwOnHttpError(response, word);

    const data = await parseJsonResponse(response, 'Wiktionary');

    // Usages come keyed by language: anything else means the API changed,
    // which is a fault to report, not a misspelling
    if (!isRecord(data)) {
      throwUnexpectedShape('Wiktionary', word);
    }
    // A page with entries in other languages only has no English word on it
    const usages = data[ENGLISH];
    if (usages === undefined) {
      throwWordNotFound(word);
    }
    if (!isWiktionaryUsages(usages)) {
      throwUnexpectedShape('Wiktionary', word);
    }
    const sourceUrl = getPageUrl(word);

    // No `id`: the endpoint answers for one page, and names no other entry
    const definitions = usages.flatMap(usage =>
      usage.definitions.filter(def => !isFootnote(def.definition)).map(def => buildDefinition({
        partOfSpeech: usage.partOfSpeech,
        text: htmlToText(ownSenseHtml(def.definition)),
        attributionText: ATTRIBUTION,
        sourceDictionary: 'wiktionary',
        sourceUrl,
        // A sense with subsenses is sent with their examples, and those of
        // senses after them, mixed into its own: none can be called its own
        examples: SUBSENSES.test(def.definition) ? undefined : def.examples?.map(htmlToText),
      }, POS_MAP)));

    return buildDictionaryResponse(word, definitions, 'Wiktionary', ATTRIBUTION, sourceUrl);
  },
};
