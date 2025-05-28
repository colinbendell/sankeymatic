import { logger as msg } from '../ux/logger.js';
import { el } from '../ux/dom.js';
import { isNumeric, formatPrecision } from '../utils.js';
import { SANKEY_SETTINGS_SCHEMA } from '../sankeyConfig.js';

/**
 * Settings Service
 * Manages application settings and preferences
 */
class SettingsService {
  constructor() {
    this.settings = { ...SANKEY_SETTINGS_SCHEMA };
  }

  /**
   * Initialize settings from the page
   */
  initializeFromPage() {
    // Load settings from the page
    Object.keys(this.settings).forEach(key => {
      this.loadSettingFromPage(key);
    });
  }

  /**
   * Load a setting from the page
   * @param {string} key - The setting key
   */
  loadSettingFromPage(key) {
    const setting = this.settings[key];
    if (!setting) return;

    const value = this.getHumanValueFromPage(key, setting.type);
    if (value !== undefined) {
      setting.value = this.settingHtoC(value, setting.type);
    }
  }

  /**
   * Get a setting value
   * @param {string} key - The setting key
   * @returns {*} The setting value
   */
  get(key) {
    const setting = this.settings[key];
    return setting ? setting.value : undefined;
  }

  /**
   * Set a setting value
   * @param {string} key - The setting key
   * @param {*} value - The value to set
   */
  set(key, value) {
    const setting = this.settings[key];
    if (setting) {
      setting.value = value;
      this.updatePageSetting(key, setting.type, value);
    }
  }

  /**
   * Update a setting on the page
   * @param {string} key - The setting key
   * @param {string} type - The setting type
   * @param {*} value - The value to set
   */
  updatePageSetting(key, type, value) {
    const element = el(key);
    if (!element) return;

    switch (type) {
    case 'checkbox':
      element.checked = value;
      break;
    case 'radio':
      if (element.value === value.toString()) {
        element.checked = true;
      }
      break;
    case 'number':
    case 'text':
    case 'textarea':
      element.value = value;
      break;
    case 'select':
      element.value = value;
      break;
    default:
      console.warn(`Unhandled setting type: ${type}`);
    }
  }

  /**
   * Get a human-readable value from the page
   * @param {string} key - The setting key
   * @param {string} type - The setting type
   * @returns {*} The human-readable value
   */
  getHumanValueFromPage(key, type) {
    const element = el(key);
    if (!element) return undefined;

    switch (type) {
    case 'checkbox':
      return element.checked;
    case 'radio':
      const radio = document.querySelector(`input[name="${key}"]:checked`);
      return radio ? radio.value : undefined;
    case 'number':
      return isNumeric(element.value) ? parseFloat(element.value) : undefined;
    case 'text':
    case 'textarea':
    case 'select':
      return element.value;
    default:
      console.warn(`Unhandled setting type: ${type}`);
      return undefined;
    }
  }

  /**
   * Convert a human-readable setting to a computer-friendly value
   * @param {*} hVal - Human-readable value
   * @param {string} dataType - Data type
   * @returns {*} Computer-friendly value
   */
  settingHtoC(hVal, dataType) {
    if (hVal === undefined || hVal === null) return undefined;

    switch (dataType) {
    case 'checkbox':
      return Boolean(hVal);
    case 'number':
      return isNumeric(hVal) ? parseFloat(hVal) : 0;
    case 'integer':
      return isNumeric(hVal) ? parseInt(hVal, 10) : 0;
    case 'text':
    case 'textarea':
    case 'select':
    case 'radio':
      return String(hVal);
    default:
      return hVal;
    }
  }

  /**
   * Validate a setting value
   * @param {Object} setting - The setting metadata
   * @param {*} hVal - The human-readable value
   * @param {Object} cfg - Configuration object
   * @returns {[boolean, *]} [isValid, computerValue]
   */
  validateSetting(setting, hVal, cfg = {}) {
    if (hVal === undefined || hVal === null) return [false, null];

    const { type, min, max, options } = setting;
    let computerValue;

    // Convert to computer value
    computerValue = this.settingHtoC(hVal, type);

    // Additional validation based on type
    switch (type) {
    case 'number':
    case 'integer':
      if (isNaN(computerValue)) {
        msg.add(`Invalid number: ${hVal}`, 'issue');
        return [false, null];
      }
      if (min !== undefined && computerValue < min) {
        msg.add(`Value must be at least ${min}`, 'issue');
        return [false, null];
      }
      if (max !== undefined && computerValue > max) {
        msg.add(`Value must be at most ${max}`, 'issue');
        return [false, null];
      }
      // Format with appropriate precision
      if (type === 'number') {
        computerValue = parseFloat(formatPrecision(computerValue, 5));
      }
      break;

    case 'select':
    case 'radio':
      if (options && !options.some(opt => opt.value === computerValue)) {
        msg.add(`Invalid selection: ${hVal}`, 'issue');
        return [false, null];
      }
      break;

      // Add more validation as needed for other types
    }

    return [true, computerValue];
  }

  /**
   * Export current settings as a string
   * @returns {string} String representation of settings
   */
  exportSettings() {
    const settings = [];
    Object.entries(this.settings).forEach(([key, setting]) => {
      if (setting.exportable !== false) {
        settings.push(`${key} = ${setting.value}`);
      }
    });
    return settings.join('\n');
  }

  /**
   * Import settings from a string
   * @param {string} settingsText - Settings string to import
   */
  importSettings(settingsText) {
    const lines = settingsText.split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) {
        const [_, key, value] = match;
        if (this.settings[key]) {
          this.set(key, value);
        }
      }
    });
  }
}

// Export a singleton instance
export const settingsService = new SettingsService();
