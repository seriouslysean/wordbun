import { parseArgs } from 'node:util';

import { isEntryPoint } from '#tools/entry';
import { showHelp } from '#tools/help-utils';
import {
  findExistingWord,
  generateGenericShareImage,
  generateShareImage,
  getAllWords,
  isImageCacheStale,
  markImageCacheCurrent,
} from '#tools/utils';
import { getAllPageMetadata } from '#utils/page-metadata-utils';
import { exit, getErrorMessage, logger } from '#utils/logger';

const HELP_TEXT = `
Generate Images Tool

Usage:
  npm run tool:local tools/generate-images.ts -- [options]
  npm run tool:generate-images -- [options]

Options:
  --words                   Generate images for all words only
  --generic                 Generate images for all generic pages only
  --word <word>             Generate image for specific word
  --page <path>             Generate image for specific page path, with its leading slash
  --force                   Regenerate images even if they already exist
  -h, --help                Show this help message

Examples:
  npm run tool:generate-images                       # Generate all word and page images
  npm run tool:generate-images -- --words            # Generate all word images
  npm run tool:generate-images -- --generic          # Generate all generic page images
  npm run tool:generate-images -- --word serendipity # Generate image for specific word
  npm run tool:generate-images -- --page /stats      # Generate image for stats page

Environment Variables (for GitHub workflows):
  SOURCE_DIR                 Data source subdirectory (unset = root paths)
  SITE_TITLE                 Site title for images
  COLOR_PRIMARY             Primary color for gradients
  COLOR_PRIMARY_LIGHT       Light primary color
  COLOR_PRIMARY_DARK        Dark primary color

Requirements:
  - Word must exist in data files for word images
  - Required environment variables must be set
  - Output directory will be created if it doesn't exist
`;

interface BulkItem {
  label: string;
}

const CONCURRENCY_LIMIT = 10;

/**
 * Processes items in batches with consistent logging and error tracking.
 * Limits concurrency to avoid OOM/fd-exhaustion on large datasets.
 * Every item is attempted; the returned failure count decides the exit code.
 */
async function bulkGenerate<T extends BulkItem>(
  items: T[],
  generate: (item: T) => Promise<boolean>,
  category: string,
): Promise<number> {
  logger.info(`Starting ${category} generation`, { count: items.length });

  const results: PromiseSettledResult<boolean>[] = [];

  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const batch = items.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const generated = await generate(item);
        if (generated) {
          logger.info(`Generated ${category} image`, { label: item.label });
        } else {
          logger.info(`Skipped ${category} image (unchanged)`, { label: item.label });
        }
        return generated;
      }),
    );
    results.push(...batchResults);
  }

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  failures.forEach(r => {
    logger.error(`Failed to generate ${category} image`, { error: r.reason?.message });
  });

  const fulfilled = results.filter((r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled');
  const generatedCount = fulfilled.filter(r => r.value).length;
  const skippedCount = fulfilled.filter(r => !r.value).length;

  logger.info(`${category} generation complete`, {
    total: items.length,
    generated: generatedCount,
    skipped: skippedCount,
    errors: failures.length,
  });

  return failures.length;
}

/**
 * Generates image for a specific word
 */
async function generateSingleImage(word: string, regenerate: boolean): Promise<boolean> {
  const wordData = findExistingWord(word);
  if (!wordData) {
    logger.error('Word not found in data files', { word });
    return false;
  }

  try {
    const generated = await generateShareImage(wordData.word, wordData.date, { regenerate });
    if (generated) {
      logger.info('Generated image for word', { word: wordData.word, date: wordData.date });
    } else {
      logger.info('Skipped image for word (unchanged)', { word: wordData.word, date: wordData.date });
    }
    return true;
  } catch (error) {
    logger.error('Failed to generate image for word', { word, error: getErrorMessage(error) });
    return false;
  }
}

/**
 * Generates image for a specific page path
 */
async function generatePageImage(pagePath: string, regenerate: boolean): Promise<boolean> {
  const allPages = getAllPageMetadata(getAllWords());
  const page = allPages.find(p => p.path === pagePath);

  if (!page) {
    logger.error('Page not found in available pages', { pagePath });
    return false;
  }

  try {
    const generated = await generateGenericShareImage(page.title, page.path, { regenerate });
    if (generated) {
      logger.info('Generated page image', { title: page.title, path: page.path });
    } else {
      logger.info('Skipped page image (unchanged)', { title: page.title, path: page.path });
    }
    return true;
  } catch (error) {
    logger.error('Failed to generate page image', { pagePath, error: getErrorMessage(error) });
    return false;
  }
}

interface GenerateImagesOptions {
  force: boolean;
  words: boolean;
  generic: boolean;
  page?: string;
  word?: string;
}

// Main execution
async function main(options: GenerateImagesOptions): Promise<void> {
  logger.info('Generate images tool starting...');

  // Settled once: every image in this run gets the same answer, so the first
  // regenerated image cannot make the rest look current.
  const stale = isImageCacheStale();
  if (stale && !options.force) {
    logger.info('Image settings differ from the last complete run, regenerating existing images');
  }
  const regenerate = options.force || stale;

  if (options.page) {
    const success = await generatePageImage(options.page, regenerate);
    await exit(success ? 0 : 1);
  }

  if (options.word) {
    const success = await generateSingleImage(options.word, regenerate);
    await exit(success ? 0 : 1);
  }

  // Neither flag means both; naming both means both too.
  const runBoth = !options.words && !options.generic;
  const coversWords = options.words || runBoth;
  const coversGeneric = options.generic || runBoth;
  const failed = { count: 0 };

  if (coversWords) {
    const allWords = getAllWords();
    failed.count += await bulkGenerate(
      allWords.map(w => ({ label: `${w.word} (${w.date})`, word: w.word, date: w.date })),
      (item) => generateShareImage(item.word, item.date, { regenerate }),
      'word',
    );
  }

  if (coversGeneric) {
    const pages = getAllPageMetadata(getAllWords());
    failed.count += await bulkGenerate(
      pages.map(p => ({ label: `${p.title} (${p.path})`, title: p.title, path: p.path })),
      (item) => generateGenericShareImage(item.title, item.path, { regenerate }),
      'generic',
    );
  }

  if (failed.count > 0) {
    logger.error('Image generation finished with failures', { failed: failed.count });
    await exit(1);
  }

  // Only a run that covered every word and every page certifies the corpus,
  // however that coverage was requested.
  if (coversWords && coversGeneric) {
    markImageCacheCurrent();
  }

  await exit(0);
}

// Everything that reads argv lives behind the guard, so importing this module
// runs no CLI code.
if (isEntryPoint(import.meta.url)) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      force: { type: 'boolean', default: false },
      words: { type: 'boolean', default: false },
      generic: { type: 'boolean', default: false },
      page: { type: 'string' },
      word: { type: 'string' },
    },
    strict: true,
  });

  if (values.help) {
    showHelp(HELP_TEXT);
    process.exit(0);
  }

  main({
    force: !!values.force,
    words: !!values.words,
    generic: !!values.generic,
    page: values.page,
    word: values.word,
  }).catch(async (error) => {
    logger.error('Tool execution failed', { error: getErrorMessage(error) });
    await exit(1);
  });
}
