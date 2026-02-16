#!/usr/bin/env node

/**
 * CDD Hook: PreToolUse — Module Scope Guard
 *
 * Fires on Write and Edit tools during build_cycle phase.
 * Warns (but never blocks) when writing to files outside the active module's scope.
 *
 * Always exits 0 — advisory only, never prevents user actions.
 */

const path = require('path');
const { findCddRoot, readStateYaml, readConfigYaml, readModuleContract, readStdin } = require('./lib/state');
const { dispatch, Status } = require('./lib/notify');
const debug = require('./lib/debug');

// Directories that are always allowed (shared/cross-cutting)
const SHARED_DIRS = ['shared', 'common', 'lib', 'utils', 'helpers'];

function getActiveModule(state) {
  const modules = state.modules || {};
  for (const [name, mod] of Object.entries(modules)) {
    if (mod.status === 'in_progress') {
      return name;
    }
  }
  return null;
}

/**
 * Normalize a file path to a forward-slash relative path from the project root.
 */
function toRelative(filePath, cwd) {
  // Handle both absolute and relative paths
  let resolved = filePath;
  if (!path.isAbsolute(filePath)) {
    resolved = path.join(cwd, filePath);
  }
  const rel = path.relative(cwd, resolved);
  return rel.replace(/\\/g, '/');
}

/**
 * Check if a relative file path is within the allowed scope for the active module.
 */
function isInScope(relPath, moduleName, config, contract) {
  // .cdd/ directory is always allowed
  if (relPath.startsWith('.cdd/') || relPath.startsWith('.cdd\\')) return true;

  // Root config files (no subdirectory) are always allowed
  if (!relPath.includes('/')) return true;

  const firstDir = relPath.split('/')[0];

  // Shared/common directories are always allowed
  if (SHARED_DIRS.includes(firstDir)) return true;

  // Tests directory
  const testsPath = config && config.paths && config.paths.tests;
  if (testsPath) {
    const normalizedTests = testsPath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
    if (relPath.startsWith(normalizedTests + '/') || relPath === normalizedTests) return true;
  }

  // Active module's source path
  const sourcePath = config && config.paths && config.paths.source;
  if (sourcePath) {
    const normalizedSource = sourcePath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
    const modulePath = normalizedSource + '/' + moduleName;
    if (relPath.startsWith(modulePath + '/') || relPath === modulePath) return true;
  }

  // Migrations path
  const migrationsPath = config && config.paths && config.paths.migrations;
  if (migrationsPath) {
    const normalizedMigrations = migrationsPath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
    if (relPath.startsWith(normalizedMigrations + '/') || relPath === normalizedMigrations) return true;
  }

  // Contract-specified source_path (if present)
  if (contract && contract.source_path) {
    const contractPath = contract.source_path.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
    if (relPath.startsWith(contractPath + '/') || relPath === contractPath) return true;
  }

  return false;
}

async function main() {
  try {
    const input = await readStdin(3000);
    if (!input) return;

    const cwd = (input.workspace && input.workspace.current_dir) || input.cwd || process.cwd();

    const cddRoot = findCddRoot(cwd);
    if (!cddRoot) return; // Not a CDD project

    const state = readStateYaml(cddRoot);
    if (!state) return;

    // Only active during build_cycle phase
    if (state.phase !== 'build_cycle') return;

    // Find the active module
    const moduleName = getActiveModule(state);
    if (!moduleName) return; // No module in progress

    // Get the target file path from tool input
    const toolInput = input.tool_input || {};
    const filePath = toolInput.file_path;
    if (!filePath) return;

    // Normalize to relative path
    const relPath = toRelative(filePath, cwd);

    // Skip paths that go outside the project (../...)
    if (relPath.startsWith('..')) return;

    // Read config and contract for scope checking
    const config = readConfigYaml(cddRoot);
    const contract = readModuleContract(cddRoot, moduleName);

    if (isInScope(relPath, moduleName, config, contract)) {
      debug.log(cddRoot, 'scope-guard', `In scope: ${relPath} (module: ${moduleName})`);
      return;
    }

    // Out of scope — output warning
    debug.log(cddRoot, 'scope-guard', `Out of scope: ${relPath} (module: ${moduleName})`);
    const sourcePath = (config && config.paths && config.paths.source) || 'src';
    console.log(`[CDD] Warning: Writing to ${relPath} but active module is "${moduleName}" (${sourcePath}/${moduleName}/)`);

    // Dispatch scope_warning event
    dispatch('scope_warning', {
      session_id: input.session_id,
      status: Status.RUNNING,
      phase: 'BUILD',
      module: moduleName,
      project: (config && config.project_name) || path.basename(cwd),
      cwd: cwd,
      warning_file: relPath,
      message: `Out-of-scope write: ${relPath}`
    }, cddRoot);

  } catch (err) {
    debug.log(findCddRoot(process.cwd()), 'scope-guard', 'Hook error', err);
  }
}

main();
