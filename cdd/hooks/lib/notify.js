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
const debug = require('./debug');

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
    debug.log(cddRoot, 'notify', 'State file written', { status: data.status, event: data.event });
    return true;
  } catch (err) {
    debug.log(cddRoot, 'notify', 'Failed to write state file', err);
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
function spawnNotifier(notifier, payloadJson, cddRoot) {
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

    debug.log(cddRoot, 'notify', `Spawning notifier: ${notifier.type}`, { cmd, args: args.join(' ') });

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
    child.on('error', (err) => {
      debug.log(cddRoot, 'notify', `Notifier spawn error: ${notifier.type}`, err);
    });
  } catch (err) {
    debug.log(cddRoot, 'notify', `Notifier spawn failed: ${notifier.type}`, err);
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
    debug.log(cddRoot, 'notify', `Dispatch: ${event}`, { status: payload.status, module: payload.module });

    // 1. Always write state file
    const stateData = {
      ...payload,
      event,
      updated_at: new Date().toISOString()
    };
    writeStateFile(cddRoot, stateData);

    // 2. Read config for notifier settings
    const config = readConfigYaml(cddRoot);
    if (!config || !config.notifications || !config.notifications.enabled) {
      debug.log(cddRoot, 'notify', 'Notifications disabled or not configured');
      return;
    }

    const notifiers = config.notifications.notifiers;
    if (!Array.isArray(notifiers) || notifiers.length === 0) {
      debug.log(cddRoot, 'notify', 'No notifiers configured');
      return;
    }

    // 3. Spawn matching notifiers
    let matched = 0;
    for (const notifier of notifiers) {
      if (!notifier.type) continue;

      // Check if this notifier listens for this event
      const events = notifier.events;
      if (events === 'all' ||
          (Array.isArray(events) && events.includes(event)) ||
          events === event) {
        // Include notifier config and cddRoot so notifiers can debug-log too
        const payloadJson = JSON.stringify({ event, ...stateData, notifier_config: notifier, _cdd_root: cddRoot });
        spawnNotifier(notifier, payloadJson, cddRoot);
        matched++;
      }
    }

    debug.log(cddRoot, 'notify', `${matched}/${notifiers.length} notifiers matched event: ${event}`);
  } catch (err) {
    debug.log(cddRoot, 'notify', 'Dispatch failed', err);
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
