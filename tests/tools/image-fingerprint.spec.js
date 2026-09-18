/**
 * The settings fingerprint (the marker's `settings`) covers the renderer as
 * well as the inputs: a sharp or libvips upgrade changes palette-quantized
 * pixels without touching any SVG, PNG option or font, so it has to
 * invalidate the cache on its own.
 */

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { computeSettingsHash } from '#tools/utils';

const RENDERER = { sharp: '0.35.4', vips: '8.18.6', imagequant: '2.4.1' };

describe('computeSettingsHash', () => {
  it('is stable for the same renderer versions', () => {
    expect(computeSettingsHash({ ...RENDERER })).toBe(computeSettingsHash({ ...RENDERER }));
  });

  it('does not depend on the order the renderer reports its versions in', () => {
    const reversed = Object.fromEntries(Object.entries(RENDERER).toReversed());

    expect(computeSettingsHash(reversed)).toBe(computeSettingsHash(RENDERER));
  });

  it.each([
    ['sharp', { ...RENDERER, sharp: '0.34.5' }],
    ['libvips', { ...RENDERER, vips: '8.17.3' }],
    ['a bundled library', { ...RENDERER, imagequant: '2.4.0' }],
  ])('changes when %s changes', (_, versions) => {
    expect(computeSettingsHash(versions)).not.toBe(computeSettingsHash(RENDERER));
  });

  it('defaults to the installed renderer', () => {
    expect(computeSettingsHash()).toBe(computeSettingsHash(sharp.versions));
  });
});
