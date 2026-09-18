import { SOURCE_DIR } from 'astro:env/client';
import { getUrl, stripBasePath } from '#astro-utils/url-utils';
import type { WordData } from '#types';
import { getSocialImagePath } from '#utils/image-path-utils';
import type { SocialCard } from '#utils/image-path-utils';

/**
 * Get social media image URL for a word or page
 * @param params - Pathname and optional word data
 * @returns URL to the social image
 */
export function getSocialImageUrl({ pathname, wordData }: { pathname: string; wordData?: WordData | null }): string {
  const card: SocialCard = wordData?.word
    ? { type: 'word', word: wordData.word, date: wordData.date }
    : { type: 'page', path: stripBasePath(pathname) };

  return getUrl(`/${getSocialImagePath(card, SOURCE_DIR)}`);
}

/**
 * Get static pages for image generation
 * @returns Metadata for all static pages
 */
export async function getStaticPages() {
  const { getAllPageMetadata } = await import('#astro-utils/page-metadata');
  return getAllPageMetadata();
}
