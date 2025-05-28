import { el } from './dom.js';

/**
 * Message Service
 * Handles displaying messages to the user in different areas of the UI
 */
class Logger {
  areas = new Map([
    ['issue', { id: 'issue_messages', class: 'errormessage' }],
    ['difference', { id: 'imbalance_messages', class: 'differencemessage' }],
    ['total', { id: 'totals_area', class: '' }],
    ['info', { id: 'info_messages', class: 'okmessage' }],
    ['console', { id: 'console_lines', class: '' }],
  ])

  consoleContainer = el('console_area');

  constructor() {
    this.queue = [];
  }

  /**
   * Add a message to a specific message area
   * @param {string} msgHTML - The message to display (HTML)
   * @param {string} msgArea - The area to display the message ('issue', 'info', 'console')
   */
  add(msgHTML, msgArea = 'info') {
    const area = this.areas.get(msgArea) || this.areas.get('info');
    if (!area) return;

    const container = el(area.id);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = msgHTML;
    msgDiv.classList = area.class || '';
    container.append(msgDiv);
    // container.scrollTop = container.scrollHeight;
  }

  /**
   * Add a message to the console
   * @param {string} msgHTML - The message to log
   */
  log(msgHTML) {
    // Reveal the console if it's hidden
    this.consoleContainer.style.display = '';
    this.add(msgHTML, 'console');
  }

  /**
   * Log a message only once per session
   * @param {string} flag - Unique identifier for this message
   * @param {string} msgHTML - The message to log
   */
  logOnce(flag, msgHTML) {
    if (!sessionStorage.getItem(`msg_${flag}`)) {
      sessionStorage.setItem(`msg_${flag}`, '1');
      this.log(`<span class="info_text">${msgHTML}</span>`);
    }
  }

  /**
   * Add a message to the queue to be displayed later
   * @param {string} msgHTML - The message to queue
   * @param {string} msgArea - The area to display the message
   */
  addToQueue(msgHTML, msgArea = 'info') {
    this.queue.push({ msgHTML, msgArea });
  }

  /**
   * Clear all messages from all areas
   */
  resetAll() {
    for (const area of this.areas.values()) {
      const container = el(area.id);
      if (container) {
        container.innerHTML = '';
      }
    }
    // this.consoleContainer.style.display = 'none';
    sessionStorage.clear();
    this.queue = [];
  }

  /**
   * Show all queued messages
   */
  showQueued() {
    for (const { msgHTML, msgArea } of this.queue) {
      this.add(msgHTML, msgArea);
    }
    this.queue = [];
  }
}

// Export a singleton instance
export const logger = new Logger();
