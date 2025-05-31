// constants.js: Reference file with several values used in sankeymatic.js
/* eslint-disable no-unused-vars */

const MAXBREAKPOINT = 9999,
// skmSettings = Settings required to render a diagram.
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
  skmSettings
    = new Map([
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
    ['node_theme', ['radio', 'none', ['a', 'b', 'c', 'd', 'none']]],
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
    ['labelposition_breakpoint', ['breakpoint', MAXBREAKPOINT, [2]]],
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
    ['meta_mentionsankeymatic', ['yn', 'y', []]],
    ['meta_listimbalances', ['yn', 'y', []]],
    // 'internal' settings are never exported, but can be imported:
    ['internal_iterations', ['whole', 25, [0, 50]]],
    ['internal_revealshadows', ['yn', 'n', []]],
  ]),
	SYM_USE_REMAINDER = '*',
	SYM_FILL_MISSING = '?',
  // Some reusable regular expressions to be precompiled:
  reWholeNumber = /^\d+$/,
  reHalfNumber = /^\d+(?:\.5)?$/,
  reInteger = /^-?\d+$/,
  reDecimal = /^\d(?:.\d+)?$/,
  reCommentLine = /^(?:'|\/\/)/, // Line starts with // or '
  reYesNo = /^(?:y|yes|n|no)/i, // = Y/y/Yes/YES/etc. or N/n/No/NO/etc.
  reYes = /^(?:y|yes)/i,        // = Y/y/Yes/YES/etc.

  // Settings Notes:
  //   * We look for settings & move lines FIRST.
  //   * If they prove valid, we apply them to the UI and convert them to
  //     COMMENTS in the input (with a checkmark to indicate success).
  //   * The idea here is to avoid having input text conflicting with
  //     the UI controls. Since any valid setting line is immediately
  //     applied and disappears, we can't have a conflict.
  //
  // reSettingsValue:
  // One to two words, followed by a value made up of letters,
  // numbers, decimals and/or dashes.
  // ex. "node theme a", "flow inheritfrom outside-in"
  reSettingsValue = /^((?:\w+\s*){1,2}) (#?[\w.-]+)$/,

  // reSettingsText:
  // One to two words followed by a quoted string (possibly empty):
  // ex: "value prefix ''", "suffix 'M'"
  // If the raw string contains a single quote, it will be doubled here.
  reSettingsText = /^((?:\w+\s*){1,2}) '(.*)'$/,
  reMoveLine = /^move (.+) (-?\d(?:.\d+)?), (-?\d(?:.\d+)?)$/,

  sourceHeaderPrefix = '// SankeyMATIC diagram inputs -',
  sourceURLLine = '// https://sankeymatic.com/build/',
  userDataMarker = '// === Nodes and Flows ===',
  movesMarker = '// === Moved Nodes ===',
  settingsMarker = '// === Settings ===',
  settingsAppliedPrefix = '// \u2713 ', // u2713 = a little check mark

  // If someone is importing/linking a diagram which was made *BEFORE*
  // the newest settings existed, prefix the incoming source with these
  // lines so that their diagram will still look like it did when they
  // made it.
  // (The trick here is that if their diagram was made AFTER the new
  // settings appeared, then values for these settings will be present
  // later in the incoming source data and will override these lines.)
  settingsToBackfill = `labelvalue position after
labelposition scheme per_stage
labels relativesize 100
 magnify 100
`,
    // The format of a row can be in one of the formats:
    // * `<source>[<amount>]<target>[#color[.opacity]]`
    // * `<source>  <amount>  <target>[#color[.opacity]]`
    // where `source` and `target` are the node names
    // `amount` is numeric or one of the symbols `*` or `?`
    // `color` is optional in 3 or 6 character hex
    // `opacity` is optional in decimal form
    // e.g. 'x [...] y #99aa00' or 'x [...] y #99aa00.25'

  reFlowLine =    /^\s*(?<sourceNode>.+?)\s*(?<!\\)\[\s*(?<amount>[^\]]*?)\s*(?<!\\)\]\s*(?<targetNode>.*?)\s*(?:#\s*(?<color>[a-f0-9]{3,6})?(?<opacity>\.\d{1,4})?)?\s*$/i,
  reTSVFlowLine = /^[ ]*(?<sourceNode>.+?)[ ]*(?<!\\)\t[ ]*(?<amount>[^\t]*?)[ ]*(?<!\\)\t[ ]*(?<targetNode>.*?)\s*(?:#\s*(?<color>[a-f0-9]{3,6})?(?<opacity>\.\d{1,4})?)?\s*$/i,
	reCleanValue = /[^\-0-9.*?]/g,
  reNodeLine = /^:(.+) #([a-f0-9]{0,6})?(\.\d{1,4})?\s*(>>|<<)*\s*(>>|<<)*$/i,
  reFlowTargetWithSuffix = /^(.+)\s+(#\S+)$/,

  reColorPlusOpacity = /^#([a-f0-9]{3,6})?(\.\d{1,4})?$/i,
  reBareColor = /^(?:[a-f0-9]{3}|[a-f0-9]{6})$/i,
  reRGBColor = /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i,
  colorGray60 = '#999',

  userInputsField = 'flows_in',
  breakpointField = 'labelposition_breakpoint',

  // Some prime constants for enum values:
  [IN, OUT, BEFORE, AFTER] = [13, 17, 19, 23],

  // fontMetrics = measurements relating to labels & their highlights
  //   Structure:
  //     browserKey ('firefox' or '*')
  //       -> font-face or '*'
  //         -> values
  //   Value list:
  //     - dy: what fraction of the BoundingBox to lower labels to make them
  //       vertically-centered relative to their Node
  //     - top, bot: how many x-heights to pad above/below the BoundingBox
  //     - inner: how many em-widths to pad between the label and the
  //       highlight's edge (could be on the left or right)
  //     - outer: how many em-widths to pad at the end furthest from the Node
  //     - marginRight: what multiple of 'inner' to move labels to the right
  //     - marginAdjLeft: offset to add to marginRight when moving labels
  //       to left
  fontMetrics
  = {
    firefox: {
      'sans-serif': {
        dy: 0.35, top: 0.55, bot: 0.25, inner: 0.35, outer: 0.35,
        marginRight: 1.4, marginAdjLeft: 0,
        },
      monospace: {
        dy: 0.31, top: 0.3, bot: 0.25, inner: 0.35, outer: 0.35,
        marginRight: 1.48, marginAdjLeft: -0.08,
        },
      '*': {
        dy: 0.31, top: 0.3, bot: 0.25, inner: 0.35, outer: 0.35,
        marginRight: 1.35, marginAdjLeft: -0.05,
        },
    },
    '*': {
      monospace: {
        dy: 0.28, top: 0.3, bot: 0.3, inner: 0.35, outer: 0.38,
        marginRight: 1.45, marginAdjLeft: 0,
        },
      '*': {
        dy: 0.29, top: 0.3, bot: 0.3, inner: 0.35, outer: 0.38,
        marginRight: 1.35, marginAdjLeft: 0,
        },
    },
  },

  // highlightStyles = settings relating to label highlight appearance
  //   Structure:
  //     mode ('dark' or 'light')
  //       -> state ('orig' or 'hover')
  //         -> values (directly applied as SVG attributes)
  highlightStyles
  = {
    // When text is dark-on-light:
    dark: {
      orig: { fill: '#fff', stroke: 'none', stroke_width: 0, stroke_opacity: 0 },
      hover: { fill: '#ffb', stroke: '#440', stroke_width: 1, stroke_opacity: 0.7 },
    },
    // When text is light-on-dark:
    light: {
      orig: { fill: '#000', stroke: 'none', stroke_width: 0, stroke_opacity: 0 },
      hover: { fill: '#603', stroke: '#fff', stroke_width: 1.7, stroke_opacity: 0.9 },
    },
  };
