import { el, elV } from './dom.js';
import { COLOR_THEMES, approvedColorTheme, rotateColors, generateLink } from '../sankeyConfig.js'

const BREAKPOINT_FIELD = 'labelposition_breakpoint';

/**
 * Given a panel's name, hide or show that control panel.
 * @param {string} panel - The ID of the panel to toggle
 */
export const togglePanel = panel => {
  const panelEl = el(panel);
  if (!panelEl?.style) return;

  if (panelEl.style.display === 'none') {
    // const displayStyle = panelEl.tagName === 'SPAN' ? 'inline' : '';
    panelEl.style.display = 'block';
    el(`${panel}_hint`).textContent = ':';
    el(`${panel}_indicator`).textContent = String.fromCharCode(8211);
  } else {
    panelEl.style.display = 'none';
    el(`${panel}_hint`).textContent = '...';
    el(`${panel}_indicator`).textContent = '+';
  }

  return null;
};

export const outputFieldEl = fld => el(`${fld}_val`);

// We store the breakpoint which means 'never' here for easy reference.
// When there are valid inputs, this is set to (stages count + 1).
export const DEFAULT_MAXBREAKPOINT = 9999

/**
 * Update the range on the label-breakpoint slider
 * @param {number} newMax
 */
export const resetMaxBreakpoint = (newMax = DEFAULT_MAXBREAKPOINT, updateSlider = false) => {
  const elBreakpointSlider = el(BREAKPOINT_FIELD);
  elBreakpointSlider.setAttribute('max', String(newMax));
  globalThis.labelNeverBreakpoint = newMax;
  if (updateSlider) {
    elBreakpointSlider.value = newMax;
  }
};

/**
 * The maximum breakpoint value, which means 'never'
 * @returns {number}
 */
export const getMaxBreakpoint = () => globalThis.labelNeverBreakpoint || DEFAULT_MAXBREAKPOINT;

/**
 * If the current inputs came from some external source, name it in this string:
 * @returns {string|null}
 */
export const getNewInputsImportedFrom = () => globalThis.newInputsImportedFrom;

/**
 * @param {string|null} dataSource
 */
export const resetNewInputsImportedFrom = (dataSource = null) => {
  globalThis.newInputsImportedFrom = dataSource;
};

/**
 * Given a field's name, update the visible value shown to the user.
 * @param {string} fld - name of the field to update
 */
export const updateOutput = fld => {
  /**
   * Given a whole number from 50-150, add '%' and pad it if needed.
   * @param {number} pct - number to display as a percentage
   * @returns {string} formatted string, padded with invisible 0s if needed
   */
  function padPercent(pct) {
    return `${'&nbsp;'.repeat(3 - String(pct).length)}${pct}%`;
  }

  const fldVal = elV(fld);
  const fldValAsNum = Number(fldVal) || 0;
  const oEl = outputFieldEl(fld);

  // Special handling for relative % ranges. To keep the numbers from jumping
  // around as you move the slider, we always show 3 digits for each value,
  // even if one is an invisible 0.
  if (['labels_magnify', 'labels_relativesize'].includes(fld)) {
    if (fldValAsNum === 100) {
      oEl.textContent = 'Same size';
    } else {
      oEl.innerHTML = `${padPercent(200 - fldValAsNum)} — ${padPercent(fldValAsNum)}`;
    }
    return null;
  }

  const formats = {
    node_h: '%',
    node_spacing: '%',
    node_opacity: '.2',
    flow_curvature: '|',
    flow_opacity: '.2',
    labelname_weight: 'font',
    labels_highlight: '.2',
    labels_linespacing: '.2',
    labelposition_autoalign: 'align',
    labelposition_breakpoint: 'breakpoint',
    labelvalue_weight: 'font',
  };
  const alignLabels = new Map([[-1, 'Before'], [0, 'Centered'], [1, 'After']]);
  const fontWeights = { 100: 'Light', 400: 'Normal', 700: 'Bold' };

  switch (formats[fld]) {
  case '|':
    // 0.1 is treated as 0 for curvature. Display that:
    if (fldValAsNum <= 0.1) {
      oEl.textContent = '0.00'; break;
    }
    // FALLS THROUGH to '.2' format when fldValAsNum > 0.1:
  case '.2': oEl.textContent = fldValAsNum.toFixed(2); break;
  case '%': oEl.textContent = `${fldValAsNum.toFixed(1)}%`; break;
  case 'breakpoint':
    oEl.textContent = fldValAsNum === getMaxBreakpoint()
      ? 'Never'
      : `Stage ${fldVal}`;
    break;
  case 'font':
    oEl.textContent = fontWeights[fldValAsNum] ?? fldVal; break;
  case 'align':
    oEl.textContent = alignLabels.get(fldValAsNum) ?? fldVal;  break;
  default: oEl.textContent = fldVal;
  }
  return null;
};


/**
 * Reveal a hidden value by removing fade classes and adding fade-in
 * @param {string} fld - The field name
 * @returns {null}
 */
export const revealVal = fld => {
  // First make sure the value is up to date.
  updateOutput(fld);

  // Swap classes to make the output appear:
  const cl = outputFieldEl(fld).classList;
  cl.remove('fade-init', 'fade-out');
  cl.add('fade-in');
  return null;
};

/**
 * Fade a visible value by removing fade-in and adding fade-out
 * @param {string} fld - The field name
 * @returns {null}
 */
export const fadeVal = fld => {
  outputFieldEl(fld).classList.replace('fade-in', 'fade-out');
  return null;
};

/**
 * Get the object which lets you get/set a radio input value:
 * @param {string} rId - The ID of the radio input
 * @returns {HTMLInputElement} The radio input element
 */
export const radioRef = rId => document.forms.skm_form.elements[rId];

/**
 * Given a radio field's id, check it.
 * @param {string} id - The ID of the radio input
 */
export const checkRadio = id => {
  el(id).checked = true;
};

/**
 * Given a valid value, update the field on the page to adopt it:
 * @param {string} sName - The name of the field
 * @param {string} dataType - The type of the field
 * @param {string|number|boolean} cVal - The computer-friendly value
 */
export const setValueOnPage = (sName, dataType, cVal) => {
  // console.log(sName, dataType, cVal);
  switch (dataType) {
  case 'radio': radioRef(sName).value = cVal; break;
    // cVal is expected to be boolean at this point for checkboxes:
  case 'yn': el(sName).checked = cVal; break;
    // All remaining types (color, list, text, whole/decimal/etc.):
  default: el(sName).value = cVal;
  }
}

/**
 * Look up a particular setting and return the appropriate human-friendly value
 * @param {string} fName - The name of the field
 * @param {string} dataType - The type of the field
 * @returns {string} The human-friendly value
 */
export const getHumanValueFromPage = (fName, dataType) => {
  switch (dataType) {
  case 'radio': return radioRef(fName).value;
  case 'color': return el(fName).value.toLowerCase();
    // translate true/false BACK to Y/N in this case:
  case 'yn': return el(fName)?.checked ? 'Y' : 'N';
  case 'list':
  case 'text':
    return el(fName).value;
    // All remaining types are numeric:
  default: return Number(el(fName).value);
  }
}

// We have to construct this fieldname in a few places:
export const getThemeOffsetField = key => `themeoffset_${key}`;

// Update the display of all known themes given their offsets:
export const updateColorThemeDisplay = function() {
  // template string for the color swatches:
  const makeSpanTag = (color, count, themeName) => (
    `<span style="background-color: ${color};" `
      + `class="color_sample_${count}" `
      + `title="${color} from d3 color scheme ${themeName}">`
      + '&nbsp;</span>'
  );
  for (const t of COLOR_THEMES.keys()) {
    const theme = approvedColorTheme(t),
      themeOffset = elV(getThemeOffsetField(t)),
      colorset = rotateColors(theme.colorset, themeOffset),
      // Show the array rotated properly given the offset:
      renderedGuide = colorset
        .map(c => makeSpanTag(c, colorset.length, theme.d3Name))
        .join('');
      // SOMEDAY: Add an indicator for which colors are/are not
      // in use?
    el(`theme_${t}_guide`).innerHTML = renderedGuide;
    el(`theme_${t}_label`).textContent = theme.nickname;
  }
}

// nudgeColorTheme: Called directly from the page.
// User just clicked an arrow on a color theme.
// Rotate the theme colors & re-display the diagram with the new set.
export const nudgeColorTheme = (themeKey, move) => {
  const themeOffsetEl = el(getThemeOffsetField(themeKey));
  const currentOffset = themeOffsetEl?.value || 0;
  const colorsInTheme = approvedColorTheme(themeKey).colorset.length;
  const newOffset = (colorsInTheme + +currentOffset + +move) % colorsInTheme;

  // Update the stored offset with the new value (0 .. last color):
  themeOffsetEl.value = newOffset;

  // If the theme the user is updating is not the active one, switch to it:
  el(`theme_${themeKey}_radio`).checked = true;

  globalThis.process_sankey();
  return null;
};

// MARK dialog functions

/**
 * @param {string} dId - the ID of the dialog element to close (minus 'Dialog')
 */
export const closeDialog = dId => {
  const dEl = el(`${dId}Dialog`);
  if (dEl) {
    dEl.close();
  }
};

const GENERATED_LINK_DIV = 'generatedLink';
const COPIED_MSG_DIV = 'copiedMsg';
export const USER_INPUTS_FIELD = 'flows_in';


export const openGetLinkDialog = () => {
  const dEl = el('getLinkDialog');
  if (dEl) {
    dEl.showModal();
    // Make the link for the current diagram's state & fill it in:
    const diagramUrl = generateLink();
    const tEl = el(GENERATED_LINK_DIV);
    tEl.innerText = diagramUrl.toString();
    tEl.focus();
  }
};

export const copyGeneratedLink = async () => {
  if (globalThis.navigator?.clipboard) {
    await globalThis.navigator.clipboard.writeText(el(GENERATED_LINK_DIV).innerText);
    el(COPIED_MSG_DIV).innerText = 'Copied!';
    setTimeout(() => {
      el(COPIED_MSG_DIV).innerText = '';
    }, 2000);
  }
};
