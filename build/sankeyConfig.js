import * as d3 from 'd3'
import { humanTimestamp } from './utils.js';
import { getHumanValueFromPage, USER_INPUTS_FIELD } from './ux/controls.js';
import { elV } from './ux/dom.js';
import lzString from 'lz-string'

// SANKEY_SETTINGS_SCHEMA = Settings required to render a diagram.
// Format = field_name: [data type, initial value, allowed values]
// 'Allowed values' contains different things per data type:
//   whole = [min, [max]], always >= 0
//   integer = [min, [max]], can be negative
//   contained = [min, dimension to compare to (either 'h' or 'w')]
//   breakpoint = [min]
//   text = [min-length, max-length]
//   radio & list = [literal list of allowed values]
// These types' constraints are NOT specified here; they are enforced in code:
//   decimal = always 0.0 - 1.0
//   color = always a hex color spec
//   yn = always y or n
export const SANKEY_SETTINGS_SCHEMA = new Map([
  ['size_w', ['whole', 600, [40]]],
  ['size_h', ['whole', 600, [40]]],
  ['margin_l', ['contained', 12, [0, 'w']]],
  ['margin_r', ['contained', 12, [0, 'w']]],
  ['margin_t', ['contained', 18, [0, 'h']]],
  ['margin_b', ['contained', 20, [0, 'h']]],
  ['bg_color', ['color', '#ffffff', []]],
  ['bg_transparent', ['yn', 'n', []]],
  ['node_w', ['contained', 9, [0, 'w']]],
  ['node_h', ['half', 50, [0, 100]]],
  ['node_spacing', ['half', 85, [0, 100]]],
  ['node_border', ['contained', 0, [0, 'w']]],
  ['node_theme', ['radio', 'none', ['a', 'b', 'c', 'd', 'e','none']]],
  ['node_color', ['color', '#888888', []]],
  ['node_opacity', ['decimal', 1.0, []]],
  ['flow_curvature', ['decimal', 0.5, []]],
  ['flow_inheritfrom', ['radio', 'none', ['source', 'target', 'outside-in', 'none']]],
  ['flow_color', ['color', '#999999', []]],
  ['flow_opacity', ['decimal', 0.45, []]],
  ['layout_order', ['radio', 'automatic', ['automatic', 'exact']]],
  ['layout_justifyorigins', ['yn', 'n', []]],
  ['layout_justifyends', ['yn', 'n', []]],
  ['layout_reversegraph', ['yn', 'n', []]],
  ['layout_attachincompletesto', ['radio', 'nearest', ['leading', 'nearest', 'trailing']]],
  ['labels_color', ['color', '#000000', []]],
  ['labels_hide', ['yn', 'n', []]],
  ['labels_highlight', ['decimal', 0.75, []]],
  ['labels_fontface', ['radio', 'sans-serif', ['monospace', 'sans-serif', 'serif']]],
  ['labels_linespacing', ['decimal', 0.15, []]],
  ['labels_relativesize', ['whole', 100, [50, 150]]],
  ['labels_magnify', ['whole', 100, [50, 150]]],
  ['labelname_appears', ['yn', 'y', []]],
  ['labelname_size', ['half', 16, [6]]],
  ['labelname_weight', ['whole', 400, [100, 700]]],
  ['labelvalue_appears', ['yn', 'y', []]],
  ['labelvalue_fullprecision', ['yn', 'y', []]],
  ['labelvalue_position', ['radio', 'below', ['above', 'before', 'after', 'below']]],
  ['labelvalue_weight', ['whole', 400, [100, 700]]],
  ['labelposition_autoalign', ['integer', 0, [-1, 1]]],
  ['labelposition_scheme', ['radio', 'auto', ['auto', 'per_stage']]],
  ['labelposition_first', ['radio', 'before', ['before', 'after']]],
  ['labelposition_breakpoint', ['breakpoint', 9999, [2]]],
  ['labelpercentage_appears', ['yn', 'n', []]],
  ['labelpercentage_precision', ['whole', 2, [0, 6]]],
  ['labelpercentage_total', ['radio', 'parent', ['parent', 'total']]],
  ['value_format', ['list', ',.', [',.', '.,', ' .', ' ,', 'X.', 'X,']]],
  ['value_prefix', ['text', '', [0, 99]]],
  ['value_suffix', ['text', '', [0, 99]]],
  ['themeoffset_a', ['whole', 9, [0, 9]]],
  ['themeoffset_b', ['whole', 0, [0, 9]]],
  ['themeoffset_c', ['whole', 0, [0, 7]]],
  ['themeoffset_d', ['whole', 0, [0, 11]]],
  ['themeoffset_e', ['whole', 0, [0, 9]]],
  ['meta_mentionsankeymatic', ['yn', 'y', []]],
  ['meta_listimbalances', ['yn', 'y', []]],
  // 'internal' settings are never exported, but can be imported:
  ['internal_iterations', ['whole', 25, [0, 50]]],
  ['internal_revealshadows', ['yn', 'n', []]],
]);

// If someone is importing/linking a diagram which was made *BEFORE*
// the newest settings existed, prefix the incoming source with these
// lines so that their diagram will still look like it did when they
// made it.
// (The trick here is that if their diagram was made AFTER the new
// settings appeared, then values for these settings will be present
// later in the incoming source data and will override these lines.)
export const LEGACY_SETTINGS_POLYFILL = `labelvalue position after
labelposition scheme per_stage
labels relativesize 100
magnify 100
 `;

// colorThemes: The available color arrays to assign to Nodes.
export const COLOR_THEMES = new Map([
  ['a', {
    colorset: d3.schemeCategory10,
    nickname: 'Categories',
    d3Name: 'Category10',
  }],
  ['b', {
    colorset: d3.schemeTableau10,
    nickname: 'Tableau10',
    d3Name: 'Tableau10',
  }],
  ['c', {
    colorset: d3.schemeDark2,
    nickname: 'Dark',
    d3Name: 'Dark2',
  }],
  ['d', {
    colorset: d3.schemeSet3,
    nickname: 'Varied',
    d3Name: 'Set3',
  }],
  ['e', {
    colorset: d3.schemeObservable10,
    nickname: 'Observable10',
    d3Name: 'Observable10',
  }],
]);

export const approvedColorTheme = themeKey => {
  // Give back an empty theme if the key isn't valid:
  return COLOR_THEMES.get(themeKey.toLowerCase())
      || { colorset: [], nickname: 'Invalid Theme', d3Name: '?' };
}

const REGEX_HEX_COLOR = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i;
const REGEX_WHOLE_NUMBER = /^\d+$/;
const REGEX_HALF_NUMBER = /^\d+(?:\.5)?$/;
const REGEX_INTEGER = /^-?\d+$/;
const REGEX_DECIMAL = /^\d(?:\.\d+)?$/;
const REGEX_YES_NO = /^(?:y|yes|n|no)/i; // = Y/y/Yes/YES/etc. or N/n/No/NO/etc.
const REGEX_YES = /^(?:y|yes)/i;        // = Y/y/Yes/YES/etc.

// settingIsValid(metadata, human value, size object {w: _, h: _}):
// return [true, computer value] IF the given value meets the criteria.
// Note: The 'size' object is only used when validating 'contained' settings.
export const settingIsValid = ([dataType, defaultVal, allowList], hVal, cfg) => {
  // valueInBounds: Verify a numeric value is in a range.
  // 'max' can be undefined, which is treated as 'no maximum'
  function valueInBounds(v, [min, max]) {
    return v >= min && (max === undefined || v <= max);
  }

  switch (dataType) {
  case 'yn':
    // Checkboxes: Translate y/n/Y/N/Yes/No to true/false.
    if (REGEX_YES_NO.test(hVal)) return REGEX_YES.test(hVal);
    break;
  case 'radio':
  case 'list':
    if (allowList.includes(hVal)) return hVal;
    break;
  case 'color':
    let rgb = hVal;
    if (REGEX_HEX_COLOR.test(hVal)) {
      if (rgb[0] !== '#') rgb = `#${rgb}`;
      if (rgb.length === 4) rgb = rgb.replace(/#(.)(.)(.)/, '$1$1$2$2$3$3');
    } else {
      rgb = d3.color(hVal)?.formatHex();
    }
    return rgb;
  case 'text':
    // UN-double any single quotes:
    const unescapedVal = hVal.replaceAll("''", "'");
    // Make sure the string's length is in the right range:
    if (valueInBounds(unescapedVal.length, allowList)) {
      return unescapedVal;
    }
    break;
  case 'decimal':
    if (REGEX_DECIMAL.test(hVal) && valueInBounds(Number(hVal), [0, 1.0])) {
      return Number(hVal);
    }
    break;
  case 'integer':
    if (REGEX_INTEGER.test(hVal) && valueInBounds(Number(hVal), allowList)) {
      return Number(hVal);
    }
    break;
  case 'half':
    if (REGEX_HALF_NUMBER.test(hVal) && valueInBounds(Number(hVal), allowList)) {
      return Number(hVal);
    }
    break;
  case 'whole':
    if (REGEX_WHOLE_NUMBER.test(hVal) && valueInBounds(Number(hVal), allowList)) {
      return Number(hVal);
    }
    break;
  case 'contained':
    if (REGEX_WHOLE_NUMBER.test(hVal) && valueInBounds(Number(hVal), [0, cfg[allowList[1]]])) {
      return Number(hVal);
    }
    break;
  case 'breakpoint':
    if (REGEX_WHOLE_NUMBER.test(hVal) && valueInBounds(Number(hVal), [0, defaultVal])) {
      return Number(hVal);
    }
    break;
  }
  // If we could not affirmatively say this value is good:
}

// Take a human-friendly setting and make it JS-friendly:
export const settingHtoC = (hVal, dataType) => {
  switch (dataType) {
  case 'whole':
  case 'half':
  case 'decimal':
  case 'integer':
  case 'contained':
  case 'breakpoint':
    return Number(hVal);
  case 'yn': return REGEX_YES.test(hVal);
  default: return hVal;
  }
}

export class SankeyConfig {
  // rememberedMoves: Used to track the user's repositioning of specific nodes
  // (which should be preserved across diagram renders).
  // Format is: nodeName => [moveX, moveY]
  #rememberedMoves = new Map();
  get rememberedMoves() {
    return this.#rememberedMoves;
  }

  constructor() {
    this.config = {};
  }
  // colorThemes: The available color arrays to assign to Nodes.
  colorThemes = COLOR_THEMES;
}

export const OUTPUT_HEADER_PREFIX = '// SankeyMATIC diagram inputs -';
export const OUTPUT_SOURCE_URL = '// https://sankeymatic.com/build/';
export const OUTPUT_USER_DATA_MARKER = '// === Nodes and Flows ===';
export const OUTPUT_MOVES_MARKER = '// === Moved Nodes ===';
export const OUTPUT_SETTINGS_MARKER = '// === Settings ===';
export const OUTPUT_SETTINGS_APPLIED_PREFIX = '// \u2713 '; // u2713 = a little check mark

export const REGEX_REMOVE_AUTO_LINES = new RegExp(
  `^(?:${OUTPUT_HEADER_PREFIX}|${OUTPUT_SETTINGS_APPLIED_PREFIX}|${OUTPUT_SETTINGS_MARKER}|${OUTPUT_USER_DATA_MARKER}|${OUTPUT_SOURCE_URL}|${OUTPUT_MOVES_MARKER}).*$`
);

// Run through the current input lines & drop any old headers &
// successfully applied settings. Returns a trimmed string.
export const removeAutoLines = lines => {
  return lines
    .map(l => l.trim())
    .filter(l => !REGEX_REMOVE_AUTO_LINES.test(l))
    .join('\n')
    .replace(/^\n+/, '') // trim blank lines at the start & end
    .replace(/\n+$/, '');
}

/**
 * Produce a text representation of the current diagram, including settings
 * @param {boolean} verbose - If true, include extra content for humans
 * @returns {string}
 */
export const getDiagramDefinition = verbose => {
  const outputLines = [];
  const customOutputFns = new Map([
    ['list', v => `'${v}'`], // Always quote 'list' values
    // In a text field we may encounter single-quotes, so double those:
    ['text', v => `'${v.replaceAll("'", "''")}'`],
  ]);
  let currentSettingGroup = '';

  // outputFldName: produce the full field name or an indented short version:
  function outputFldName(fld) {
    const shortFieldName = fld.replace(new RegExp(`^${currentSettingGroup}_`), '  ');
    return shortFieldName.replaceAll('_', ' ');
  }

  function add(...lines) {
    outputLines.push(...lines);
  }
  function addVerbose(...lines) {
    if (verbose) add(...lines);
  }

  addVerbose(`${OUTPUT_HEADER_PREFIX} Saved: ${humanTimestamp()}`)
  addVerbose(OUTPUT_SOURCE_URL)
  addVerbose('')
  addVerbose(OUTPUT_USER_DATA_MARKER)
  addVerbose('')
  add(removeAutoLines(elV(USER_INPUTS_FIELD).split('\n')));
  addVerbose('')
  addVerbose(OUTPUT_SETTINGS_MARKER)
  addVerbose('')

  // Add all of the settings:
  SANKEY_SETTINGS_SCHEMA.forEach((fldData, fldName) => {
    if (fldName.startsWith('internal_')) {
      return;
    } // Ignore internals

    const dataType = fldData[0];
    const activeHVal = getHumanValueFromPage(fldName, dataType);
    const outVal = customOutputFns.has(dataType) ? customOutputFns.get(dataType)(activeHVal) : activeHVal;
    add(`${outputFldName(fldName)} ${outVal}`);
    currentSettingGroup = fldName.split('_')[0] || '';
  });

  // If there are any manually-moved nodes, add them to the output:
  if (currConfig.rememberedMoves.size) {
    addVerbose('', OUTPUT_MOVES_MARKER, '');
    currConfig.rememberedMoves.forEach((move, nodeName) => {
      add(`move ${nodeName} ${ep(move[0])}, ${ep(move[1])}`);
    });
  }

  return outputLines.join('\n');
}

export const SHARED_LINK_QUERY_PARAM = 'i'

/**
 * @returns {URL}
 */
export const generateLink = (baseUrl = globalThis.location.href) => {
  const minDiagramDef = getDiagramDefinition(false);
  const compressed = lzString.compressToEncodedURIComponent(minDiagramDef);
  const currentUrl = new URL(baseUrl);

  // Set the new parameter, encoded to keep it from wrapping strangely:
  currentUrl.search
    = `${SHARED_LINK_QUERY_PARAM}=${
      encodeURIComponent(compressed).replaceAll('-', '%2D')
    }`;
  return currentUrl;
}

/**
 * If we are running in the browser context, check for a serialized diagram
 * in the URL parameters. If found, load it.
 */
export function extractFromUrl(baseUrl = globalThis.location.href) {
  const compressedInputs = new URL(baseUrl)?.searchParams?.get(SHARED_LINK_QUERY_PARAM);
  if (compressedInputs) {
    return lzString.decompressFromEncodedURIComponent(compressedInputs);
  }
}

export const currConfig = new SankeyConfig();
export default currConfig;
