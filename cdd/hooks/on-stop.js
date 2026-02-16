#!/usr/bin/env node

/**
 * CDD Hook: Stop — Session Summary & Notification
 *
 * When Claude Code stops, updates monitor state to STOPPED and dispatches
 * the stopped event to notifiers. This is the primary "needs attention" alert.
 *
 * No stdout output (Claude has already stopped by the time this runs).
 */

const path = require('path');
const { findCddRoot, readStateYaml, readConfigYaml, readStdin } = require('./lib/state');
const { dispatch, readStateFile, Status } = require('./lib/notify');
const { findTranscriptPath, getLastClaudeMessage } = require('./lib/transcript');
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

async function main() {
  try {
    const input = await readStdin(3000);
    const cwd = (input && input.workspace && input.workspace.current_dir) || (input && input.cwd) || process.cwd();
    const sessionId = input && input.session_id;

    const cddRoot = findCddRoot(cwd);
    if (!cddRoot) return;

    debug.log(cddRoot, 'on-stop', 'Hook fired', { cwd, sessionId });

    const state = readStateYaml(cddRoot);
    if (!state) {
      debug.log(cddRoot, 'on-stop', 'No state.yaml found');
      return;
    }

    const config = readConfigYaml(cddRoot);
    const projectName = (config && config.project_name) || path.basename(cwd);
    const phase = state.phase || 'planning';
    const phaseLabel = PHASE_LABELS[phase] || phase.toUpperCase();
    const stats = getModuleStats(state);

    // Try to extract last Claude message from transcript (best-effort)
    let lastMessage = null;
    if (sessionId) {
      const transcriptPath = findTranscriptPath(sessionId);
      if (transcriptPath) {
        lastMessage = getLastClaudeMessage(transcriptPath);
        debug.log(cddRoot, 'on-stop', 'Extracted last message from transcript', { length: lastMessage ? lastMessage.length : 0 });
      } else {
        debug.log(cddRoot, 'on-stop', 'No transcript found for session', sessionId);
      }
    }

    // Preserve started_at from existing monitor state
    const existingState = readStateFile(cddRoot);
    const startedAt = (existingState && existingState.started_at) || null;

    // Dispatch stopped event
    dispatch('stopped', {
      session_id: sessionId,
      status: Status.STOPPED,
      phase: phaseLabel,
      module: stats ? stats.active : null,
      modules_complete: stats ? `${stats.complete}/${stats.total}` : null,
      project: projectName,
      cwd: cwd,
      last_response: lastMessage,
      started_at: startedAt
    }, cddRoot);

  } catch (err) {
    debug.log(findCddRoot(process.cwd()), 'on-stop', 'Hook error', err);
  }
}

main();
