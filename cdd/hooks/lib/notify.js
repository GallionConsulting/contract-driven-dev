/**
 * CDD Hooks — Notification Dispatcher
 *
 * Writes monitor state and dispatches events to configured notifiers.
 * Notifiers are spawned detached (fire-and-forget) so hooks stay fast.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { readConfigYaml } = require('./state');

const MONITOR_DIR = 'monitor';
const STATE_FILE = 'state.json';

// Valid status values
const Status = {
  STARTED: 'STARTED',
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  NEEDS_INPUT: 'NEEDS_INPUT',
  NEEDS_PERMISSION: 'NEEDS_PERMISSION'
};

// Valid event names
const Events = {
  SESSION_STARTED: 'session_started',
  RUNNING: 'running',
  STOPPED: 'stopped',
  SCOPE_WARNING: 'scope_warning',
  NEEDS_INPUT: 'needs_input',
  NEEDS_PERMISSION: 'needs_permission'
};

// ---------------------------------------------------------------------------
// State File
// ---------------------------------------------------------------------------

/**
 * Write monitor state to .cdd/monitor/state.json.
 * Always writes regardless of notifier configuration.
 */
function writeStateFile(cddRoot, data) {
  try {
    const monitorDir = path.join(cddRoot, MONITOR_DIR);
    fs.mkdirSync(monitorDir, { recursive: true });
    const statePath = path.join(monitorDir, STATE_FILE);
    fs.writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Read monitor state from .cdd/monitor/state.json.
 */
function readStateFile(cddRoot) {
  try {
    const statePath = path.join(cddRoot, MONITOR_DIR, STATE_FILE);
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notifier Spawning
// ---------------------------------------------------------------------------

/**
 * Spawn a notifier process detached with JSON payload on stdin.
 * Fire-and-forget: never waits, never throws.
 */
function spawnNotifier(notifier, payloadJson) {
  try {
    let cmd, args;

    if (notifier.type === 'custom') {
      // Custom: split command string into cmd + args
      const parts = notifier.command.split(/\s+/);
      cmd = parts[0];
      args = parts.slice(1);
    } else {
      // Built-in: resolve notifier script path
      const notifierPath = path.join(__dirname, '..', '..', 'notifiers', `${notifier.type}.js`);
      cmd = process.execPath; // node
      args = [notifierPath];
    }

    const child = spawn(cmd, args, {
      detached: true,
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
      env: { ...process.env }
    });

    // Write payload to stdin and close it
    if (child.stdin) {
      child.stdin.write(payloadJson);
      child.stdin.end();
    }

    child.unref();
    child.on('error', () => {}); // Swallow spawn errors
  } catch {
    // Silent failure — notifiers must never break hooks
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch an event: write state file, then spawn matching notifiers.
 *
 * @param {string} event - Event name (from Events)
 * @param {object} payload - State data to write and send to notifiers
 * @param {string} cddRoot - Path to .cdd/ directory
 */
function dispatch(event, payload, cddRoot) {
  try {
    // 1. Always write state file
    const stateData = {
      ...payload,
      event,
      updated_at: new Date().toISOString()
    };
    writeStateFile(cddRoot, stateData);

    // 2. Read config for notifier settings
    const config = readConfigYaml(cddRoot);
    if (!config || !config.notifications || !config.notifications.enabled) return;

    const notifiers = config.notifications.notifiers;
    if (!Array.isArray(notifiers) || notifiers.length === 0) return;

    // 3. Spawn matching notifiers
    for (const notifier of notifiers) {
      if (!notifier.type) continue;

      // Check if this notifier listens for this event
      const events = notifier.events;
      if (events === 'all' ||
          (Array.isArray(events) && events.includes(event)) ||
          events === event) {
        // Include notifier config so the script knows its settings (url, port, etc.)
        const payloadJson = JSON.stringify({ event, ...stateData, notifier_config: notifier });
        spawnNotifier(notifier, payloadJson);
      }
    }
  } catch {
    // Silent failure
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  writeStateFile,
  readStateFile,
  dispatch,
  spawnNotifier,
  Status,
  Events
};
