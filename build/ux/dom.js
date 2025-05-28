import { escapeHTML } from '../utils.js';

/**
 * DOM Utilities
 * Helper functions for DOM manipulation and querying
 */

/**
 * Get a DOM element by ID
 * @param {string} domId - The ID of the element to retrieve
 * @returns {HTMLElement} The DOM element
 */
export const el = domId => document.getElementById(domId);

/**
 * Used if all we want is to READ the .value
 * @param {string} domId - The ID of the element
 * @returns {string|undefined} The value of the element
 */
export const elV = domId => el(domId)?.value;

/**
 * Toggle the visibility of a panel
 * @param {string} panel - The ID of the panel to toggle
 */
export const togglePanel = panel => {
  const panelEl = el(panel);
  if (panelEl) {
    panelEl.style.display = panelEl.style.display === 'none' ? 'block' : 'none';
  }
};

/**
 * Set the checked state of a radio button
 * @param {string} id - The ID of the radio button
 * @param {boolean} checked - Whether the radio button should be checked
 */
export const setRadioChecked = (id, checked = true) => {
  const radio = el(id);
  if (radio) {
    radio.checked = checked;
  }
};

/**
 * Format a value for display in messages
 * @param {string} value - The value to format
 * @returns {string} HTML-formatted value
 */
export const formatHTMLAsQuotedBold = value => {
  return `&quot;<strong>${escapeHTML(String(value))}</strong>&quot;`;
}
