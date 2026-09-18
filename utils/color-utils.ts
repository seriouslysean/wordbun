// CSS hex notation: #rgb, #rgba, #rrggbb or #rrggbbaa.
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/**
 * Resolve a color setting to a CSS hex color. Unset, empty or blank means the
 * default; surrounding whitespace is ignored, as CSS ignores it. Anything
 * else that is not a hex color throws, naming the setting, because the value
 * is pasted into markup where a malformed one renders as black.
 * @param name - Setting name, such as `COLOR_PRIMARY`
 * @param value - Raw setting value
 * @param fallback - Default hex color
 * @returns The hex color to use
 */
export const resolveHexColor = (name: string, value: string | undefined, fallback: string): string => {
  const color = value?.trim() || fallback;
  if (!HEX_COLOR.test(color)) {
    throw new Error(`${name} must be a hex color such as #9a3412, got ${JSON.stringify(value)}`);
  }
  return color;
};
