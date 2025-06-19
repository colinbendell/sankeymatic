// constants.js: Reference file with several values used in sankeymatic.js

// Some reusable regular expressions to be precompiled:
export const LINE_COMMENT_REGEX = /^\s*(?:'|\/\/)/; // Line starts with // or '

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
export const LINE_SETTINGS_REGEX = /^\s*(?:(?<group>[a-z]+)\b\s+)?(?:(?<name>w)idth|(?<name>h)eight|(?<name>l)eft|(?<name>r)ight|(?<name>t)op|(?<name>b)ottom|(?<name>[a-z]+))\s+(?:'(?<value>.*)'|(?<value>[0-9.]+|#?[a-f0-9]{3,6}|[\.,x]+|[a-z_-]+))\s*$/i;

export const LINE_MOVE_REGEX = /^move (.+) (-?\d(?:.\d+)?), (-?\d(?:.\d+)?)$/;

// The format of a row can be in one of the formats:
// * `<source>[<amount>]<target>[#color[.opacity]]`
// * `<source>  <amount>  <target>[#color[.opacity]]`
// where `source` and `target` are the node names
// `amount` is numeric or one of the symbols `*` or `?`
// `color` is optional in 3 or 6 character hex
// `opacity` is optional in decimal form
// e.g. 'x [...] y #99aa00' or 'x [...] y #99aa00.25'
export const LINE_FLOW_REGEX =    /^\s*(?<source>.+?)\s*(?<!\\)\[\s*(?<value>[^\]]*?)\s*(?<!\\)\]\s*(?<target>.*?)\s*(?:#\s*(?<color>[a-f0-9]{3,6})?(?<opacity>\.\d{1,4})?)?\s*$/i;
export const LINE_TSV_FLOW_REGEX = /^[ ]*(?<source>.+?)[ ]*(?<!\\)\t[ ]*(?<value>[^\t]*?)[ ]*(?<!\\)\t[ ]*(?<target>[^\t]*?)\s*(?:#\s*(?<color>[a-f0-9]{3,6})?(?<opacity>\.\d{1,4})?)?\s*$/i;

export const LINE_NODE_SETTINGS_REGEX = /^:\s*(?<nodeName>.+?)\s*(?:#\s*(?<color>[a-f0-9]{3,6})?(?<opacity>\.\d{1,4})?)?\s*(?:(?<paintIncoming><<)\s*(?<paintOutgoing>>>)?|(?<paintOutgoing>>>)\s*(?<paintIncoming><<)?)?\s*$/i;

export const COLOR_GRAY_60 = '#999';

// Some prime constants for enum values:
export const [IN, OUT, BEFORE, AFTER] = [13, 17, 19, 23];

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
export const FONT_METRICS = {
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
};

// highlightStyles = settings relating to label highlight appearance
//   Structure:
//     mode ('dark' or 'light')
//       -> state ('orig' or 'hover')
//         -> values (directly applied as SVG attributes)
export const HIGHLIGHT_STYLES = {
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
