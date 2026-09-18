import { createHash } from 'node:crypto';
import fs from 'node:fs';
import opentype from 'opentype.js';
import path from 'node:path';
import sharp from 'sharp';

import { fetchWithFallback } from '#adapters';
import { getWordRelations } from '#adapters/wordnet';
import type { WordRelations } from '#adapters/wordnet';
import { paths } from '#config/paths';
import type { CreateWordEntryResult, DictionaryResponse, WordData, WordEnrichment } from '#types';
import { formatDate, isValidDate } from '#utils/date-utils';
import { getSocialCardPath, SOCIAL_DIR } from '#utils/image-path-utils';
import { getErrorMessage, logger } from '#utils/logger';
import { isRecord, isString } from '#utils/type-guards';
import { findValidDefinition, mergeEnrichment, normalizeToBasePOS } from '#utils/word-data-utils';
import { parseWordData } from '#utils/word-validation';

// ---------------------------------------------------------------------------
// Image generation constants
// ---------------------------------------------------------------------------

const imageColors = {
  primary: process.env.COLOR_PRIMARY || '#9a3412',
  primaryLight: process.env.COLOR_PRIMARY_LIGHT || '#c2410c',
  primaryDark: process.env.COLOR_PRIMARY_DARK || '#7c2d12',
  textLighter: '#8a8f98',
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
// 5% of shortest dimension
const PADDING = Math.floor(Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.05);
const FONT_SIZE = 160;
const TITLE_SIZE = 48;
const DATE_SIZE = 40;
// 20% of font size
const DESCENDER_OFFSET = Math.floor(FONT_SIZE * 0.2);
const MAX_WIDTH = CANVAS_WIDTH - (PADDING * 2);

const PNG_OPTIONS = {
  compressionLevel: 9,
  palette: true,
  quality: 90,
  colors: 128,
} as const;

const SOCIAL_BASE_DIR = path.join(paths.images, SOCIAL_DIR);
const SETTINGS_HASH_FILENAME = '.image-settings-hash';

// Fixed inputs rendered through the real template to fingerprint it.
const PROBE_TEXT = 'probe';
const PROBE_DATE = '20240101';

interface LoadedFont {
  font: ReturnType<typeof opentype.parse>;
  fingerprint: string;
}

interface ImageFonts {
  regular: LoadedFont;
  bold: LoadedFont;
}

// md5 here is a non-security content fingerprint, as in the settings hash.
const fingerprint = (content: string | Buffer): string =>
  createHash('md5').update(content).digest('hex');

// Liberation Sans for better web compatibility.
// opentype.js v2 removed loadSync; parse a read buffer instead
const loadFont = (fileName: string): LoadedFont => {
  const bytes = fs.readFileSync(path.join(paths.fonts, 'liberation-sans', fileName));
  return { font: opentype.parse(bytes), fingerprint: fingerprint(bytes) };
};

const fontCache: { value: ImageFonts | null } = { value: null };

/**
 * Parses both fonts on the first image, so tools that import this module
 * without rendering (add-word --help, regenerate-all-words) never pay for it.
 */
const getFonts = (): ImageFonts => {
  fontCache.value ??= {
    regular: loadFont('LiberationSans-Regular.ttf'),
    bold: loadFont('LiberationSans-Bold.ttf'),
  };
  return fontCache.value;
};

// ---------------------------------------------------------------------------
// Word file I/O
// ---------------------------------------------------------------------------

interface WordFileInfo {
  word: string;
  date: string;
  path: string;
}

interface WordFileScan {
  files: WordFileInfo[];
  /** Directories and files that could not be read, each already logged */
  failures: string[];
}

/**
 * Lists the word files in the data directory, newest first. Anything that
 * cannot be read is logged and reported in `failures` instead of silently
 * left out: a bulk tool counts it, so a partial corpus cannot pass for a
 * complete one. Single-word lookups may ignore it.
 */
export const getWordFiles = (): WordFileScan => {
  if (!fs.existsSync(paths.words)) {
    logger.error('Word directory does not exist', { path: paths.words });
    return { files: [], failures: [paths.words] };
  }

  const years = fs.readdirSync(paths.words).filter(dir => /^\d{4}$/.test(dir));

  if (years.length === 0) {
    logger.error('No year directories found', { path: paths.words });
    return { files: [], failures: [paths.words] };
  }

  const failures: string[] = [];
  const files = years.flatMap(year => {
    try {
      const yearDir = path.join(paths.words, year);
      const jsonFiles = fs.readdirSync(yearDir)
        .filter(file => file.endsWith('.json'));

      return jsonFiles.flatMap(file => {
        try {
          const filePath = path.join(yearDir, file);
          // Only the headword is read here, so a file regenerate-all-words can
          // still repair (any other field missing) stays listed.
          const data: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (!isRecord(data) || !isString(data.word)) {
            throw new Error('Word file has no "word" string');
          }
          return [{ word: data.word, date: file.replace('.json', ''), path: filePath }];
        } catch (error) {
          logger.error('Failed to read word file', { file, error: getErrorMessage(error) });
          failures.push(path.join(yearDir, file));
          return [];
        }
      });
    } catch (error) {
      logger.error('Failed to read year directory', { year, error: getErrorMessage(error) });
      failures.push(path.join(paths.words, year));
      return [];
    }
  });

  // Sort by date (newest first) for consistency
  return { files: files.toSorted((a, b) => b.date.localeCompare(a.date)), failures };
};

/**
 * Checks if a word already exists by scanning word files
 */
export function findExistingWord(word: string): WordData | null {
  const lowerWord = word.toLowerCase();
  const { files } = getWordFiles();

  for (const file of files) {
    try {
      const data = parseWordData(fs.readFileSync(file.path, 'utf-8'), file.path);
      if (data.word.toLowerCase() === lowerWord) {
        return data;
      }
    } catch (error) {
      logger.warn('Failed to read word file', { path: file.path, error: getErrorMessage(error) });
    }
  }

  return null;
}

interface WordCorpus {
  words: WordData[];
  /** Directories and files that could not be read or parsed, each already logged */
  failures: string[];
}

/**
 * Reads every stored word. Files that cannot be read or are not valid word
 * data are logged and reported in `failures`, as in getWordFiles.
 */
export function getAllWords(): WordCorpus {
  const { files, failures } = getWordFiles();
  const parseFailures: string[] = [];
  const words = files.flatMap(file => {
    try {
      return [parseWordData(fs.readFileSync(file.path, 'utf-8'), file.path)];
    } catch (error) {
      logger.error('Failed to parse word file', { path: file.path, error: getErrorMessage(error) });
      parseFailures.push(file.path);
      return [];
    }
  });
  return { words, failures: [...failures, ...parseFailures] };
}

// ---------------------------------------------------------------------------
// SVG / image generation
// ---------------------------------------------------------------------------

interface TextPathResult {
  pathData: string;
  width: number;
  height: number;
  scale: number;
  transform: string;
}

interface GetTextPathOptions {
  isExtraBold?: boolean;
  maxWidth?: number;
}

function getTextPath(text: string, fontSize: number, options: GetTextPathOptions = {}): TextPathResult {
  const { isExtraBold = false, maxWidth = Infinity } = options;
  const fonts = getFonts();
  const font = (isExtraBold ? fonts.bold : fonts.regular).font;
  const fontPath = font.getPath(text, 0, 0, fontSize);
  const bbox = fontPath.getBoundingBox();
  const width = bbox.x2 - bbox.x1;
  const scale = width > maxWidth ? maxWidth / width : 1;
  const transform = scale < 1 ? ` transform="scale(${scale})"` : '';

  return {
    // getPath already emits SVG's y-down coordinates. toPathData flips Y by
    // default (opentype.js 2), which would mirror that upright text.
    pathData: fontPath.toPathData({ flipY: false }),
    width: width * scale,
    height: (bbox.y2 - bbox.y1) * scale,
    scale,
    transform,
  };
}

/**
 * Creates an SVG social image. When date is provided, it renders below the site title.
 */
export function createSvg(text: string, date?: string): string {
  const mainWord = getTextPath(text, FONT_SIZE, { isExtraBold: true, maxWidth: MAX_WIDTH });
  const titleText = getTextPath(process.env.SITE_TITLE || '', TITLE_SIZE);
  const dateText = date ? getTextPath(formatDate(date), DATE_SIZE) : null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <!-- White background -->
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff"/>

    <defs>
        <linearGradient id="wordGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${imageColors.primaryLight}"/>
            <stop offset="60%" stop-color="${imageColors.primary}"/>
            <stop offset="100%" stop-color="${imageColors.primaryDark}"/>
        </linearGradient>
    </defs>

    <!-- Site title -->
    <g transform="translate(${PADDING}, ${PADDING + TITLE_SIZE})">
        <path d="${titleText.pathData}" fill="${imageColors.textLighter}"${titleText.transform}/>
    </g>
${dateText ? `
    <!-- Date -->
    <g transform="translate(${PADDING}, ${PADDING + TITLE_SIZE + DATE_SIZE + 16})">
        <path d="${dateText.pathData}" fill="${imageColors.textLighter}"${dateText.transform}/>
    </g>
` : ''}
    <!-- Main word -->
    <g transform="translate(${PADDING}, ${CANVAS_HEIGHT - PADDING - DESCENDER_OFFSET})">
        <path d="${mainWord.pathData}" fill="url(#wordGradient)"${mainWord.transform}/>
    </g>
</svg>`;
}

type RendererVersions = Readonly<Record<string, string | undefined>>;

/**
 * Fingerprints what determines the bytes of an image: the inputs and the
 * renderer. The probe SVGs come from the real template, so they carry the
 * colors, site title, dimensions and layout; the font fingerprints cover
 * glyphs the probe text does not use. The renderer versions are sharp, libvips
 * and the libraries bundled with it (librsvg, imagequant, libpng...): a sharp
 * upgrade re-quantizes the palette without any input changing. Entries are
 * sorted so the fingerprint does not depend on the order they are reported in.
 */
export const computeSettingsHash = (rendererVersions: RendererVersions = sharp.versions): string => {
  const fonts = getFonts();
  return fingerprint(JSON.stringify({
    probes: [createSvg(PROBE_TEXT, PROBE_DATE), createSvg(PROBE_TEXT)],
    png: PNG_OPTIONS,
    fonts: [fonts.regular.fingerprint, fonts.bold.fingerprint],
    renderer: Object.entries(rendererVersions).toSorted(([a], [b]) => a.localeCompare(b)),
  })).slice(0, 12);
};

const readSettingsHash = (): string | null => {
  try {
    return fs.readFileSync(path.join(SOCIAL_BASE_DIR, SETTINGS_HASH_FILENAME), 'utf-8').trim();
  } catch {
    return null;
  }
};

/**
 * True when existing images were rendered under different settings (or no
 * complete run has certified them). Callers read this once per run and pass
 * the answer to every image as `regenerate`, so the decision cannot change
 * while the run is in flight.
 */
export const isImageCacheStale = (): boolean => readSettingsHash() !== computeSettingsHash();

/**
 * Certifies every image on disk as rendered under the current settings. Only a
 * run that covered all words and all pages without a failure may call this; a
 * single image or a partial run says nothing about the rest of the corpus.
 */
export const markImageCacheCurrent = (): void => {
  fs.mkdirSync(SOCIAL_BASE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SOCIAL_BASE_DIR, SETTINGS_HASH_FILENAME), `${computeSettingsHash()}\n`);
};

interface GenerateImageOptions {
  regenerate?: boolean;
}

/**
 * Renders an image unless it already exists and the caller has not asked for
 * regeneration. The SVG is only built once the image is known to be needed.
 * Returns true if generated, false if skipped.
 */
async function renderPng(buildSvg: () => string, outputPath: string, regenerate: boolean): Promise<boolean> {
  if (!regenerate && fs.existsSync(outputPath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(buildSvg())).png(PNG_OPTIONS).toFile(outputPath);
  return true;
}

/**
 * Generates a social share image for a word.
 * Skips an existing image unless `regenerate` is set.
 */
export async function generateShareImage(
  word: string,
  date: string,
  options: GenerateImageOptions = {},
): Promise<boolean> {
  const outputPath = path.join(paths.images, getSocialCardPath({ type: 'word', word, date }));
  return renderPng(() => createSvg(word, date), outputPath, !!options.regenerate);
}

/**
 * Generates a generic social share image for pages without a word.
 * Skips an existing image unless `regenerate` is set.
 */
export async function generateGenericShareImage(
  title: string,
  slug: string,
  options: GenerateImageOptions = {},
): Promise<boolean> {
  const outputPath = path.join(paths.images, getSocialCardPath({ type: 'page', path: slug }));
  return renderPng(() => createSvg(title.toLowerCase()), outputPath, !!options.regenerate);
}

// ---------------------------------------------------------------------------
// Word entry creation
// ---------------------------------------------------------------------------

/**
 * Merges adapter-captured headword data and WordNet relations into one
 * word-level enrichment object, omitting empty fields. Returns undefined when
 * there is nothing to store so absent enrichment self-hides on render.
 */
function composeEnrichment(
  headword: DictionaryResponse['headword'],
  relations: WordRelations | null,
): WordEnrichment | undefined {
  const enrichment: WordEnrichment = {};
  if (headword?.pronunciation) {
    enrichment.pronunciation = headword.pronunciation;
  }
  if (headword?.audio) {
    enrichment.audio = headword.audio;
  }
  if (headword?.etymology) {
    enrichment.etymology = headword.etymology;
  }
  if (relations?.synonyms.length) {
    enrichment.synonyms = relations.synonyms;
  }
  if (relations?.antonyms.length) {
    enrichment.antonyms = relations.antonyms;
  }
  if (relations?.related.length) {
    enrichment.related = relations.related;
  }
  return Object.keys(enrichment).length > 0 ? enrichment : undefined;
}

/**
 * Assembles the stored WordData from a dictionary response plus optional WordNet
 * relations. Shared by add-word and regenerate-all-words so a backfill produces
 * the same shape. `storedEnrichment` is what the file being replaced already
 * holds: fields the refresh does not supply are kept from it, so a backfill
 * never strips enrichment; `preserveCase` is carried the same way by the caller.
 */
export function buildWordData(params: {
  word: string;
  date: string;
  adapterName: string;
  response: DictionaryResponse;
  relations?: WordRelations | null;
  preserveCase?: boolean;
  storedEnrichment?: WordEnrichment;
}): WordData {
  const { word, date, adapterName, response, relations = null, preserveCase = false, storedEnrichment } = params;
  const enrichment = mergeEnrichment(storedEnrichment, composeEnrichment(response.headword, relations));
  const wordData: WordData = {
    word,
    date,
    adapter: adapterName,
    preserveCase,
    data: response.definitions,
  };
  if (enrichment) {
    wordData.enrichment = enrichment;
  }
  return wordData;
}

/**
 * The headword's primary part of speech (that of its first displayable
 * definition), normalized to a base type, used to focus WordNet relations on
 * the dominant sense. Undefined when no definition carries a usable POS, in
 * which case all senses are considered.
 */
export function primaryPartOfSpeech(definitions: DictionaryResponse['definitions']): string | undefined {
  const raw = findValidDefinition(definitions)?.partOfSpeech;
  const base = raw ? normalizeToBasePOS(raw) : '';
  return base || undefined;
}

/**
 * Looks up WordNet relations, swallowing failures so enrichment never blocks
 * word creation. The lookup is local, so this only guards against a missing or
 * corrupt WordNet database. Returns null when unavailable.
 */
export async function tryFetchRelations(word: string, partOfSpeech?: string): Promise<WordRelations | null> {
  try {
    // WordNet indexes lemmas in lowercase, so the lookup key is lowercased here
    // even for preserveCase words; the adapter looks up what it is given.
    return await getWordRelations(word.toLowerCase(), partOfSpeech);
  } catch (error) {
    logger.warn('WordNet enrichment failed, continuing without it', { word, error: getErrorMessage(error) });
    return null;
  }
}

interface CreateWordEntryOptions {
  date: string;
  overwrite?: boolean;
  preserveCase?: boolean;
}

/**
 * Creates a word data object and saves it to the appropriate file
 */
export async function createWordEntry(word: string, options: CreateWordEntryOptions): Promise<CreateWordEntryResult> {
  const { date, overwrite = false, preserveCase = false } = options;

  if (!word?.trim()) {
    throw new Error('Word is required');
  }

  if (!isValidDate(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYYMMDD format`);
  }

  if (!process.env.DICTIONARY_ADAPTER) {
    throw new Error('DICTIONARY_ADAPTER environment variable is required');
  }

  const trimmedWord = word.trim();
  const finalWord = preserveCase ? trimmedWord : trimmedWord.toLowerCase();
  const year = date.slice(0, 4);
  const dirPath = path.join(paths.words, year);
  const filePath = path.join(dirPath, `${date}.json`);

  if (fs.existsSync(filePath) && !overwrite) {
    throw new Error(`Word already exists for date ${date}`);
  }

  fs.mkdirSync(dirPath, { recursive: true });

  // Fetch word data using finalWord (lowercased by default) so common words match
  // dictionary entries. When preserveCase is true, original capitalization is retained.
  const { response, adapterName } = await fetchWithFallback(finalWord);
  const relations = await tryFetchRelations(finalWord, primaryPartOfSpeech(response.definitions));
  const wordData = buildWordData({ word: finalWord, date, adapterName, response, relations, preserveCase });

  fs.writeFileSync(filePath, JSON.stringify(wordData, null, 4));

  logger.info('Word entry created', { word: finalWord, date });

  return { filePath, data: response.definitions };
}
