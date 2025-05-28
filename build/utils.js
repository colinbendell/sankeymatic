import {
  SYM_USE_REMAINDER,
  SYM_FILL_MISSING,
} from './constants.js';

/**
 * Kick off a function after a certain period has passed.
 * Used to trigger live updates when the user stops typing.
 * @param {function} callbackFn
 * @param {number} [waitMilliseconds = 500] Default is 500.
 * @returns {function}
 */
export const debounce = (callbackFn, waitMilliseconds = 500) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callbackFn(...args), waitMilliseconds);
  };
};

/**
 * Format a number with a fixed number of decimal places
 * @param {number} x - The number to format
 * @param {number} [precision=5] - Number of decimal places
 * @returns {string} Formatted number string
 */
export const formatPrecision = (x, precision = 5) => {
  if (x !== +x) return '';
  return Number(x).toFixed(precision);
};

/**
 * "Enough Precision". Converts long decimals to have just 5 digits.
 * Why?:
 * SVG diagrams produced by SankeyMATIC don't really benefit from specifying
 * values with more than 3 decimal places, but by default the output has *13*.
 * This is frankly hard to read and actually inflates the size of the SVG
 * output by quite a bit.
 *
 * Result: values like 216.7614485930364 become 216.76145 instead.
 * The 'Number .. toString' call allows shortened output: 8 instead of 8.00000
 *
 * @param {number} x - The number to format
 * @returns {string} Formatted number string
 */
export const enoughPrecision = x => Number(x.toFixed(5)).toString();

/**
 * Check if a value represents a special calculation
 * @param {string} value A flow's value.
 * @returns {boolean} True if the value is a special calculation symbol
 */
export const isCalculatedAmount = value => {
  return value === SYM_USE_REMAINDER || value === SYM_FILL_MISSING;
};

const LOCALE_USES_COMMA_AS_DECIMAL = new Intl.NumberFormat(navigator.languages).formatToParts(1.1)[1].value === ",";
const REGEX_CLEAN_VALUE = /[^\-0-9.*?]/g;

/**
 * Parse a number from a string, handling locale-specific decimal separators
 * When there ambiguity about whether a comma is a decimal separator:
 *   * if it has a period, use period
 *   * if it has more than one comma, use period
 *   * if it only has one comma, check the _locale_ of the browser for confirmation
 * @param {string} value - The string to parse
 * @returns {number|string|null} The parsed number or original string if not a number
 */
export const parseAmountNumber = value => {
  if (typeof value !== 'string') return null;

  value = value.trim();
  if (isCalculatedAmount(value)) return value;

  // disambiguate the times when the value could have a comma as a decimal separator
  // * if it has a period, use period
  // * if it has more than one comma, use period
  // * if it only has one comma, check the locale for confirmation
  if (value.indexOf('.') === -1 // no `.` in the value
    && value.indexOf(',') === value.lastIndexOf(',') // only one `,` in the value so it's ambiguous if it is thousand or decimal
    && LOCALE_USES_COMMA_AS_DECIMAL) { // and the locale uses `,` as decimal separator
    value = value.replace(',', '.');
  }

  value = value.replace(REGEX_CLEAN_VALUE, '');
  if (value === '') return null;

  const floatValue = Number(value);
  if (Number.isNaN(floatValue)) return null;

  return floatValue;
}

/**
 * Format a number according to user's preferred style. For legacy reasons, we convert the style to a specific geographically-specific format.
 *   * `123,456.78` => `us`
 *   * `123.456,78` => `de`
 *   * `123 456,78` => `fr`
 *   * `123 456.78` => `ses`
 * @param {number} numberIn - The number to format
 * @param {Object} nStyle - Formatting options
 * @returns {string} Formatted number string
 */
export const formatUserData = (numberIn, nStyle) => {
  const maximumFractionDigits = nStyle.decimalPlaces;
  const minimumFractionDigits = nStyle.trimString ? 0 : nStyle.decimalPlaces;

  let nString;
  switch (`${nStyle.marks.group || ''}${nStyle.marks.decimal || ''}`) {
  case ',.':
    nString = Intl.NumberFormat('us', { maximumFractionDigits, minimumFractionDigits}).format(numberIn);
    break;
  case '.,':
    nString = Intl.NumberFormat('de', { maximumFractionDigits, minimumFractionDigits}).format(numberIn);
    break;
  case ' ,':
    nString = Intl.NumberFormat('fr', { maximumFractionDigits, minimumFractionDigits}).format(numberIn);
    break;
  case ' .':
    nString = Intl.NumberFormat('ses', { maximumFractionDigits, minimumFractionDigits}).format(numberIn);
    break;
  default:
    // no formatting except for decimal separator
    nString = Number(numberIn).toFixed(nStyle.decimalPlaces)
    if (nStyle.trimString) nString = Number(nString).toString();
    if (nStyle.marks.decimal === ',') nString = nString.replace(',', '.');
    break;
  }

  return `${nStyle.prefix}${nString}${nStyle.suffix}`;
}

/**
 * Make any input string safe to display.
 * Used for displaying raw <SVG> code
 * and for reflecting the user's input back to them in messages.
 * @param {string} unsafeString - The string to escape
 * @returns {string} The escaped string
 */
export const escapeHTML = unsafeString => {
  if (typeof unsafeString !== 'string') return '';
  return unsafeString
    .replaceAll('→', '&#8594;')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br />');
};

/**
 * Given any hex color, return a grayscale color which is lower-contrast than
 * pure black/white but still sufficient. (Used for less-important text.)
 * @param {string} hexColor - The hex color
 * @returns {d3.rgb} The contrasting gray color
 */
export const contrastingGrayColor = hexColor => {
  hexColor = hexColor.replace('#', '');
  const hex = hexColor.length === 3 ? hexColor.split('').map(c => c + c).join('') : hexColor;
  const c = {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
  const yiq = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  // Calculate a value sufficiently far away from this color.
  // If it's bright-ish, make a dark gray; if dark-ish, make a light gray.
  // This algorithm is far from exact! But it seems good enough.
  // Lowest/highest values produced are 59 and 241.
  const gray = Math.floor(yiq > 164 ? (0.75 * yiq) - 64 : (0.30 * yiq) + 192);
  return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
}

/**
 * Clamp a value between min and max; default to min if not numeric.
 * @param {number} n - The value to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} The clamped value
 */
export const clamp = (n, min, max) => {
  if (n != +n) return min;
  return Math.min(Math.max(n, min), max);
};

/**
 * Check if a value is numeric
 * borrowed from jQuery/Angular
 * @param {*} n - The value to check
 * @returns {boolean} True if the value is numeric
 */
export const isNumeric = n => !Number.isNaN(n - parseFloat(n));

/**
 * Return a timestamp in the format 'yyyymmdd_hhmmss'
 * @returns {string} The timestamp
 */
export const fileTimestamp = () => new Date().toISOString().replace('T', '_').replace(/[-:]|\..*$/g, '');

/**
 * Return a human-readable timestamp in the format '1/3/2023, 7:33:31 PM'
 * @returns {string} The timestamp
 */
export const humanTimestamp = () => new Date().toLocaleString();
