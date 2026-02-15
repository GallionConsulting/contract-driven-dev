#!/usr/bin/env node

/**
 * CDD Hook: SessionStart — State Detection & Resume Reminder
 *
 * Reads .cdd/state.yaml, outputs project status to Claude, and dispatches
 * session_started event to configured notifiers.
 *
 * Silent no-op if no .cdd/ directory exists (non-CDD projects).
 */

const { findCddRoot, readStateYaml, readConfigYaml, readStdin } = require('./lib/state');
const { dispatch, Status } = require('./lib/notify');

// Phase display names
const PHASE_LABELS = {
  planning: 'PLANNING',
  foundation: 'FOUNDATION',
  build_cycle: 'BUILD',
  complete: 'COMPLETE'
};

// Planning sub-step suggestions
const PLANNING_NEXT = {
  pending: { step: 'brief', cmd: '/cdd:brief' },
  brief: { step: 'plan', cmd: '/cdd:plan' },
  plan: { step: 'modularize', cmd: '/cdd:modularize' },
  modularize: { step: 'contract', cmd: '/cdd:contract' },
  contract: { step: 'foundation', cmd: '/cdd:foundation' }
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

function getPlanningStatus(state) {
  const planning = state.planning || {};
  const steps = ['brief', 'plan', 'modularize', 'contract'];

  // Find the last completed step
  let lastComplete = null;
  for (const step of steps) {
    const s = planning[step];
    if (s && (s.status === 'complete' || s.status === 'done')) {
      lastComplete = step;
    }
  }

  return lastComplete || 'pending';
}

async function main() {
  try {
    const input = await readStdin(3000);
    const cwd = (input && input.workspace && input.workspace.current_dir) || (input && input.cwd) || process.cwd();
    const sessionId = input && input.session_id;

    const cddRoot = findCddRoot(cwd);
    if (!cddRoot) return; // Silent no-op for non-CDD projects

    const state = readStateYaml(cddRoot);
    if (!state) return;

    const config = readConfigYaml(cddRoot);
    const projectName = (config && config.project_name) || require('path').basename(cwd);
    const phase = state.phase || 'planning';
    const phaseLabel = PHASE_LABELS[phase] || phase.toUpperCase();

    // Build status line
    const parts = [`[CDD] ${projectName}`];
    parts.push(`Phase: ${phaseLabel}`);

    let moduleInfo = '';
    let suggestion = '';

    if (phase === 'build_cycle' || phase === 'complete') {
      const stats = getModuleStats(state);
      if (stats) {
        if (stats.active) {
          moduleInfo = `Module: ${stats.active} (${stats.complete}/${stats.total})`;
          parts.push(moduleInfo);
        } else {
          moduleInfo = `${stats.complete}/${stats.total} complete`;
          parts.push(moduleInfo);
        }
      }
      if (phase === 'build_cycle') {
        suggestion = 'Use /cdd:resume to continue';
      }
    } else if (phase === 'planning') {
      const lastStep = getPlanningStatus(state);
      const next = PLANNING_NEXT[lastStep];
      if (next) {
        suggestion = `Next: ${next.cmd}`;
      }
    } else if (phase === 'foundation') {
      suggestion = 'Use /cdd:foundation to continue';
    }

    if (suggestion) {
      parts.push(suggestion);
    }

    // Output status to Claude
    console.log(parts.join(' | '));

    // Dispatch session_started event
    dispatch('session_started', {
      session_id: sessionId,
      status: Status.STARTED,
      phase: phaseLabel,
      module: (getModuleStats(state) || {}).active || null,
      modules_complete: (() => {
        const s = getModuleStats(state);
        return s ? `${s.complete}/${s.total}` : null;
      })(),
      project: projectName,
      cwd: cwd,
      started_at: new Date().toISOString()
    }, cddRoot);

  } catch {
    // Silent failure — never break Claude Code startup
  }
}

main();
