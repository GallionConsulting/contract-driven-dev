/**
 * CDD Hooks — Debug Logger
 *
 * Writes debug output to .cdd/debug.log when debug mode is enabled.
 * Enable via environment variable (CDD_DEBUG=1) or config.yaml (debug: true).
 *
 * Never throws — debug logging must never break hooks or notifiers.
 */

const fs = require('fs');
const path = require('path');

// Cache the enabled check per cddRoot to avoid re-reading config on every call
const _enabledCache = {};

/**
 * Check if debug mode is enabled.
 * CDD_DEBUG=1 env var takes priority, then config.yaml debug: true.
 */
function isEnabled(cddRoot) {
  if (process.env.CDD_DEBUG === '1') return true;
  if (!cddRoot) return false;

  if (_enabledCache[cddRoot] === undefined) {
    try {
      const { readConfigYaml } = require('./state');
      const config = readConfigYaml(cddRoot);
      _enabledCache[cddRoot] = !!(config && config.debug);
    } catch {
      _enabledCache[cddRoot] = false;
    }
  }
  return _enabledCache[cddRoot];
}

/**
 * Write a debug log entry to .cdd/debug.log.
 *
 * @param {string} cddRoot - Path to .cdd/ directory
 * @param {string} source  - Hook or notifier name (e.g., 'on-stop', 'webhook')
 * @param {string} message - What happened
 * @param {*}      [data]  - Optional context (Error, object, or string)
 */
function log(cddRoot, source, message, data) {
  try {
    if (!isEnabled(cddRoot)) return;

    const logPath = path.join(cddRoot, 'debug.log');
    const timestamp = new Date().toISOString();
    let line = `[${timestamp}] [${source}] ${message}`;

    if (data !== undefined) {
      if (data instanceof Error) {
        line += `: ${data.message}`;
        if (data.stack) line += `\n  ${data.stack.split('\n').slice(1, 4).join('\n  ')}`;
      } else if (typeof data === 'object') {
        line += `: ${JSON.stringify(data)}`;
      } else {
        line += `: ${data}`;
      }
    }

    fs.appendFileSync(logPath, line + '\n', 'utf8');
  } catch {
    // Never throw — debug logging must not break anything
  }
}

module.exports = { log, isEnabled };
