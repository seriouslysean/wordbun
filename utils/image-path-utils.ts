/**
 * Where social share images live. The generator writes these paths and the
 * site links to them, so both derive from this module and cannot drift.
 *
 * The file names are a contract with cards already committed upstream and in
 * downstream repos: changing a rule here orphans every existing card.
 */

import { slugify } from '#utils/text-utils';

interface WordCard {
  type: 'word';
  word: string;
  date: string;
}

interface PageCard {
  type: 'page';
  path: string;
}

export type SocialCard = WordCard | PageCard;

/** Directory that holds the cards, inside the images directory. */
export const SOCIAL_DIR = 'social';

/**
 * Images directory relative to the public root. SOURCE_DIR comes before
 * `images`, mirroring `data/{SOURCE_DIR}/words`.
 * @param sourceDir - SOURCE_DIR value; empty or undefined means root paths
 * @returns Forward-slash path such as `demo/images` or `images`
 */
export const getImagesDir = (sourceDir?: string): string =>
  sourceDir ? `${sourceDir}/images` : 'images';

/**
 * A card's path relative to the images directory.
 * Word cards keep the word as written apart from its case, so spaces and
 * punctuation survive (`20240615-ice cream.png`). Page cards flatten the
 * page path into one slug (`/browse/2023/april` -> `browse-2023-april.png`).
 * @param card - The word or page the card belongs to
 * @returns Forward-slash path such as `social/2024/20240615-ice cream.png`
 */
export const getSocialCardPath = (card: SocialCard): string => {
  if (card.type === 'word') {
    return `${SOCIAL_DIR}/${card.date.slice(0, 4)}/${card.date}-${card.word.toLowerCase()}.png`;
  }
  return `${SOCIAL_DIR}/pages/${slugify(card.path.replaceAll('/', ' '))}.png`;
};

/**
 * A card's path relative to the site's public root, which is also its path
 * on the built site.
 * @param card - The word or page the card belongs to
 * @param sourceDir - SOURCE_DIR value; empty or undefined means root paths
 * @returns Forward-slash path such as `demo/images/social/pages/stats.png`
 */
export const getSocialImagePath = (card: SocialCard, sourceDir?: string): string =>
  `${getImagesDir(sourceDir)}/${getSocialCardPath(card)}`;
