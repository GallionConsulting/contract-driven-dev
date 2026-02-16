#!/usr/bin/env node

/**
 * CDD Hook: Notification — Permission & Input Alerts
 *
 * Fires when Claude Code sends a notification (permission prompts, idle alerts).
 * Maps Claude Code notification types to CDD events and dispatches them
 * to configured notifiers (Telegram, webhook, etc.).
 *
 * No stdout output (advisory only, does not block Claude).
 */

const path = require('path');
const { findCddRoot, readStateYaml, readConfigYaml, readStdin } = require('./lib/state');
const { dispatch, readStateFile, Status, Events } = require('./lib/notify');
const debug = require('./lib/debug');

const PHASE_LABELS = {
  planning: 'PLANNING',
  foundation: 'FOUNDATION',
  build_cycle: 'BUILD',
  complete: 'COMPLETE'
};

function getModuleStats(state) {
  const modules = state.modules || {};
  const names = Object.keys(modules);
  if (names.length === 0) return null;

  let complete = 0;
  let active = null;

  for (const name of names) {
    const mod = modules[name];
    if (mod.status === 'complete' || mod.status === 'verified') {
      complete++;
    } else if (mod.status === 'in_progress' && !active) {
      active = name;
    }
  }

  return { total: names.length, complete, active };
}

/**
 * Map Claude Code notification type to CDD event name.
 * Returns null for notification types we don't care about.
 */
function mapNotificationType(input) {
  // Claude Code sends notification data in various formats.
  // Try to detect the type from available fields.
  const type = (input && (input.type || input.notification_type)) || '';
  const message = (input && (input.message || input.title)) || '';

  // Permission prompt — Claude needs tool approval
  if (type === 'permission_prompt' || type === 'permission' ||
      /permission/i.test(message)) {
    return { event: Events.NEEDS_PERMISSION, status: Status.NEEDS_PERMISSION };
  }

  // Tool use waiting for approval
  if (type === 'tool_permission' || type === 'tool_approval') {
    return { event: Events.NEEDS_PERMISSION, status: Status.NEEDS_PERMISSION };
  }

  // General notification — Claude is idle / waiting for input
  if (type === 'idle_prompt' || type === 'idle' || type === 'notification') {
    return { event: Events.NEEDS_INPUT, status: Status.NEEDS_INPUT };
  }

  // Elicitation — Claude is asking the user a question
  if (type === 'elicitation_dialog' || type === 'elicitation') {
    return { event: Events.NEEDS_INPUT, status: Status.NEEDS_INPUT };
  }

  // Default: treat any unrecognized notification as needs_input
  // (better to alert than to miss)
  if (type && type !== 'auth_success') {
    return { event: Events.NEEDS_INPUT, status: Status.NEEDS_INPUT };
  }

  return null;
}

async function main() {
  try {
    const input = await readStdin(3000);
    if (!input) return;

    const cwd = (input.workspace && input.workspace.current_dir) || input.cwd || process.cwd();
    const sessionId = input.session_id;

    const cddRoot = findCddRoot(cwd);
    if (!cddRoot) return; // Silent no-op for non-CDD projects

    const notificationType = (input && (input.type || input.notification_type)) || 'unknown';
    debug.log(cddRoot, 'on-notification', 'Hook fired', { type: notificationType, cwd });

    // Map notification type to CDD event
    const mapped = mapNotificationType(input);
    if (!mapped) {
      debug.log(cddRoot, 'on-notification', `Ignoring notification type: ${notificationType}`);
      return;
    }

    debug.log(cddRoot, 'on-notification', `Mapped ${notificationType} -> ${mapped.event}`);

    const state = readStateYaml(cddRoot);
    if (!state) return;

    const config = readConfigYaml(cddRoot);
    const projectName = (config && config.project_name) || path.basename(cwd);
    const phase = state.phase || 'planning';
    const phaseLabel = PHASE_LABELS[phase] || phase.toUpperCase();
    const stats = getModuleStats(state);

    // Preserve started_at from existing monitor state
    const existingState = readStateFile(cddRoot);
    const startedAt = (existingState && existingState.started_at) || null;

    // Extract notification message for context
    const notificationMessage = input.message || input.title || null;

    // Dispatch the event
    dispatch(mapped.event, {
      session_id: sessionId,
      status: mapped.status,
      phase: phaseLabel,
      module: stats ? stats.active : null,
      modules_complete: stats ? `${stats.complete}/${stats.total}` : null,
      project: projectName,
      cwd: cwd,
      last_response: notificationMessage,
      started_at: startedAt
    }, cddRoot);

  } catch (err) {
    debug.log(findCddRoot(process.cwd()), 'on-notification', 'Hook error', err);
  }
}

main();
