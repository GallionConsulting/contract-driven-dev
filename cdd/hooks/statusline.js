#!/usr/bin/env node

/**
 * CDD Hook: StatusLine — Status Bar Renderer
 *
 * Outputs a formatted status line for Claude Code's status bar.
 *
 * Uses ANSI escape codes (\x1b[2m dim, \x1b[0m reset) on each text segment
 * and process.stdout.write() without trailing newline — matching the exact
 * output format used by GSD (get-shit-done) which works correctly on Windows.
 *
 * Windows first-render workaround:
 * Claude Code's DVq component calls the statusline command immediately on
 * mount and again on each new assistant message UUID. On Windows, Ink's
 * Yoga layout engine gives the statusline Box incorrect width (0 or 1)
 * for the first ~4 renders, causing vertical rendering regardless of
 * ANSI codes. The layout only stabilizes after 4+ re-renders. We skip
 * the first CALLS_TO_SKIP calls per session (outputting a minimal
 * invisible ANSI string) to avoid the vertical wall of text.
 *
 * Format: ModelName │ PHASE: module (x/y) │ project-dir │ Update: vX.Y.Z
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { findCddRoot, readStateYaml } = require('./lib/state');
const debug = require('./lib/debug');

// Marker file to track call count per session (Windows first-render workaround)
const SESSION_MARKER_PATH = path.join(os.tmpdir(), 'cdd-statusline-session');
const CALLS_TO_SKIP = 4; // Skip first N calls — layout needs ~4 re-renders to stabilize on Windows

/**
 * Detect if this is an early statusline call that should be suppressed.
 * The DVq component re-renders on each new assistant message UUID.
 * On Windows, the Yoga layout width is wrong for the first ~4 renders:
 *   Call 1: mount (width=0/1, always broken)
 *   Call 2: first assistant response (layout still not recalculated)
 *   Call 3: second assistant response (layout may still be wrong)
 *   Call 4: third response (still occasionally broken)
 *   Call 5+: layout stable, renders correctly
 * Returns true if the call should be suppressed; false when safe to render.
 */
function isEarlyCallInSession(sessionId) {
  if (!sessionId) return false;
  try {
    const raw = fs.readFileSync(SESSION_MARKER_PATH, 'utf8').trim();
    const newline = raw.indexOf('\n');
    if (newline !== -1) {
      const markerId = raw.slice(0, newline);
      const count = parseInt(raw.slice(newline + 1), 10) || 0;
      if (markerId === sessionId) {
        if (count >= CALLS_TO_SKIP) return false; // layout stable
        try { fs.writeFileSync(SESSION_MARKER_PATH, `${sessionId}\n${count + 1}`); } catch {}
        return true; // still early
      }
    }
  } catch { /* no marker yet */ }
  // New session — write marker with count 1
  try { fs.writeFileSync(SESSION_MARKER_PATH, `${sessionId}\n1`); } catch {}
  return true;
}

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

function readUpdateCheck() {
  try {
    const cachePath = path.join(os.homedir(), '.claude', 'cache', 'cdd-update-check.json');
    if (!fs.existsSync(cachePath)) return null;
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (data.hasUpdate && data.latest) {
      return data.latest;
    }
    return null;
  } catch {
    return null;
  }
}

// Read all stdin then render — same pattern GSD uses successfully
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = input ? JSON.parse(input) : {};

    // Windows layout workaround: suppress early calls in a session.
    // The Yoga layout width is wrong for the first ~2 DVq renders on
    // Windows, causing vertical text. Output invisible space until stable.
    if (process.platform === 'win32' && isEarlyCallInSession(data.session_id)) {
      process.stdout.write('\x1b[2m \x1b[0m');
      return;
    }

    // Extract fields using the native installer's JSON schema
    const model = (data.model && data.model.display_name) || '';
    const cwd = (data.workspace && data.workspace.current_dir) || data.cwd || process.cwd();

    const parts = [];

    // Model name
    if (model) {
      parts.push(model);
    }

    // CDD phase + module info
    const cddRoot = findCddRoot(cwd);
    if (cddRoot) {
      const state = readStateYaml(cddRoot);
      if (state) {
        const phase = state.phase || 'planning';
        const phaseLabel = PHASE_LABELS[phase] || phase.toUpperCase();

        const stats = getModuleStats(state);
        if (stats && stats.active) {
          parts.push(`${phaseLabel}: ${stats.active} (${stats.complete}/${stats.total})`);
        } else if (stats) {
          parts.push(`${phaseLabel}: ${stats.complete}/${stats.total}`);
        } else {
          parts.push(phaseLabel);
        }
      }
    }

    // Project directory name
    parts.push(path.basename(cwd));

    // Update check
    const updateVersion = readUpdateCheck();
    if (updateVersion) {
      parts.push(`Update: v${updateVersion}`);
    }

    // Wrap each part in ANSI dim codes and join with Unicode box-drawing
    // separator — matching GSD's exact output format which renders correctly.
    // The ANSI codes route through Claude Code's P3 component's multi-segment
    // rendering path, which works correctly on Windows. The plain-text path
    // (no ANSI codes) has a width calculation bug causing vertical rendering.
    const DIM = '\x1b[2m';
    const RESET = '\x1b[0m';
    const sep = ` \u2502 `;  // │ box-drawing separator (same as GSD)
    const output = parts.map(p => DIM + p + RESET).join(sep);
    process.stdout.write(output);
  } catch (err) {
    debug.log(findCddRoot(process.cwd()), 'statusline', 'Render error', err);
  }
});
