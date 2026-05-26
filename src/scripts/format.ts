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
