/**
 * Formats a raw number into a clean string suffix (e.g. 1500 -> "1.5k").
 * @param value The raw number to format
 */
export function formatCount(value: number): string {
  if (value >= 1000) {
    const kValue = value / 1000;
    // Return clean integers as is, else keep 1 decimal place (e.g., 15k or 1.5k)
    return kValue % 1 === 0 ? `${kValue}k` : `${kValue.toFixed(1)}k`;
  }
  return value.toString();
}

export type DateStyle = 'short' | 'long';

export interface FormatDateOptions {
  locale?: string;
  style?: DateStyle;
  timeZone?: string;
}

/**
 * Robustly formats a Date instance or 'YYYY-MM-DD' date string into localized representation.
 * Defaults to 'short' style ('Sep 23, 2007') and 'en-US' locale with UTC timezone to prevent local day-offset shifts.
 */
export function formatDate(
  date: Date | string,
  optionsOrStyle?: DateStyle | FormatDateOptions,
  locale?: string
): string {
  const options: FormatDateOptions =
    typeof optionsOrStyle === 'string'
      ? { style: optionsOrStyle, locale }
      : { ...optionsOrStyle };

  const style = options.style ?? 'short';
  const effectiveLocale = options.locale ?? locale ?? 'en-US';
  const timeZone = options.timeZone ?? 'UTC';

  let d: Date;
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      d = new Date(Date.UTC(year, month - 1, day));
    } else {
      d = new Date(trimmed);
    }
  } else if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) {
    return String(date);
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    timeZone,
  };

  return new Intl.DateTimeFormat(effectiveLocale, formatOptions).format(d);
}

