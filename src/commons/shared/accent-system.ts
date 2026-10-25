/**
 * Canonical 9-Step Accent Palette (9-Stop Signature Brand Spectrum)
 * Ordered continuously along the signature brand spectrum:
 * 1: Blue    (217°)
 * 2: Indigo  (239°) - Posts
 * 3: Violet  (258°) - Publications
 * 4: Purple  (271°) - Presentations
 * 5: Fuchsia (292°) - Courses
 * 6: Pink    (330°) - Projects
 * 7: Rose    (350°) - Services
 * 8: Orange  (25°)  - Visualizations
 * 9: Amber   (38°)  - Tags
 */

export const ACCENT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type AccentNumber = typeof ACCENT_NUMBERS[number];

export const ACCENT_NAMES = [
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'orange',
  'amber'
] as const;
export type AccentName = typeof ACCENT_NAMES[number];

export type SlideAccent = AccentNumber | AccentName | string;

export const ACCENT_NAME_TO_NUMBER: Record<string, AccentNumber> = {
  blue: 1,

  indigo: 2,
  posts: 2,

  violet: 3,
  publications: 3,

  purple: 4,
  presentations: 4,

  fuchsia: 5,
  cyan: 5,
  courses: 5,

  pink: 6,
  teal: 6,
  projects: 6,

  rose: 7,
  red: 7,
  emerald: 7,
  green: 7,
  services: 7,

  orange: 8,
  visualizations: 8,

  amber: 9,
  yellow: 9,
  tags: 9
};

export const ACCENT_NUMBER_TO_NAME: Record<AccentNumber, AccentName> = {
  1: 'blue',
  2: 'indigo',
  3: 'violet',
  4: 'purple',
  5: 'fuchsia',
  6: 'pink',
  7: 'rose',
  8: 'orange',
  9: 'amber'
};

/**
 * Resolves an arbitrary accent identifier (number 1-9, name, domain) to an AccentNumber (1-9).
 */
export function resolveAccentNumber(accent?: SlideAccent): AccentNumber {
  if (typeof accent === 'number' && accent >= 1 && accent <= 9) {
    return accent as AccentNumber;
  }
  if (typeof accent === 'string') {
    const parsedNum = parseInt(accent, 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 9) {
      return parsedNum as AccentNumber;
    }
    const normalized = accent.toLowerCase().trim();
    if (normalized in ACCENT_NAME_TO_NUMBER) {
      return ACCENT_NAME_TO_NUMBER[normalized];
    }
  }
  return 1; // Default: 1 (Blue)
}

/**
 * Resolves an arbitrary accent identifier to its canonical AccentName.
 */
export function resolveAccentName(accent?: SlideAccent): AccentName {
  const num = resolveAccentNumber(accent);
  return ACCENT_NUMBER_TO_NAME[num];
}

/**
 * Calculates the next accent in the continuous 9-step color cycle.
 * @param startAccent The starting accent (number 1-9, name, or domain)
 * @param stepOffset The offset index (0, 1, 2, ...)
 * @returns The resulting AccentName, AccentNumber, and CSS variable string
 */
export function getCycleAccent(startAccent?: SlideAccent, stepOffset: number = 0): {
  number: AccentNumber;
  name: AccentName;
  cssVar: string;
} {
  const baseNum = resolveAccentNumber(startAccent);
  // Ring modulo math (1-based index)
  const targetNum = (((baseNum - 1 + stepOffset) % 9 + 9) % 9 + 1) as AccentNumber;
  const name = ACCENT_NUMBER_TO_NAME[targetNum];
  return {
    number: targetNum,
    name,
    cssVar: `var(--color-accent-${targetNum})`
  };
}
