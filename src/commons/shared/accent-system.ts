/**
 * Canonical 9-Step Accent Palette (Single Source of Truth)
 * Ordered continuously along the 360° color wheel:
 * 1: Rose    (350°) - Interests
 * 2: Violet  (260°) - Posts
 * 3: Indigo  (240°) - Publications
 * 4: Blue    (215°) - Presentations
 * 5: Cyan    (190°) - Courses
 * 6: Teal    (170°) - Projects
 * 7: Emerald (155°) - Services
 * 8: Yellow  (48°)  - Visualizations
 * 9: Orange  (25°)  - Tags
 */

export const ACCENT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type AccentNumber = typeof ACCENT_NUMBERS[number];

export const ACCENT_NAMES = [
  'rose',
  'purple',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'emerald',
  'amber',
  'orange'
] as const;
export type AccentName = typeof ACCENT_NAMES[number];

export type SlideAccent = AccentNumber | AccentName | string;

export const ACCENT_NAME_TO_NUMBER: Record<string, AccentNumber> = {
  rose: 1,
  red: 1,
  interests: 1,

  purple: 2,
  violet: 2,
  posts: 2,

  indigo: 3,
  publications: 3,

  blue: 4,
  presentations: 4,

  cyan: 5,
  courses: 5,

  teal: 6,
  projects: 6,

  emerald: 7,
  green: 7,
  services: 7,

  amber: 8,
  yellow: 8,
  visualizations: 8,

  orange: 9,
  tags: 9
};

export const ACCENT_NUMBER_TO_NAME: Record<AccentNumber, AccentName> = {
  1: 'rose',
  2: 'purple',
  3: 'indigo',
  4: 'blue',
  5: 'cyan',
  6: 'teal',
  7: 'emerald',
  8: 'amber',
  9: 'orange'
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
  return 4; // Default: 4 (Blue / Presentations)
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
