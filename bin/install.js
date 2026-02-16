#!/usr/bin/env node

/**
 * CDD Installer — Copies slash commands and framework files into Claude Code config directories.
 *
 * Usage:
 *   npx contract-driven-dev@latest            # Install globally to ~/.claude/
 *   npx contract-driven-dev@latest --local     # Install to ./.claude/ in CWD
 *   npx contract-driven-dev@latest --uninstall # Remove global install
 *   npx contract-driven-dev@latest --uninstall --local  # Remove local install
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VERSION = (() => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  return pkg.version;
})();

const PACKAGE_ROOT = path.join(__dirname, '..');
const MANIFEST_FILE = 'cdd-manifest.json';

function resolveHome(filepath) {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

function getTargetDir(isLocal) {
  if (isLocal) {
    return path.join(process.cwd(), '.claude');
  }
  return process.env.CLAUDE_CONFIG_DIR
    ? resolveHome(process.env.CLAUDE_CONFIG_DIR)
    : path.join(os.homedir(), '.claude');
}

function hasFlag(args, ...flags) {
  return flags.some(f => args.includes(f));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Recursively copy a directory, tracking all destination file paths.
 */
function copyDirSync(src, dest, installedFiles) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, installedFiles);
    } else {
      fs.copyFileSync(srcPath, destPath);
      installedFiles.push(destPath);
    }
  }
}

/**
 * Replace the placeholder path ~/.claude/ (with or without trailing slash)
 * with the actual resolved target path in all .md files under the given directory.
 */
function substitutePathsInMdFiles(dir, resolvedTarget) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      substitutePathsInMdFiles(fullPath, resolvedTarget);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Normalize to forward slashes for the replacement path
      const normalized = resolvedTarget.replace(/\\/g, '/');
      // Ensure trailing slash for consistent path joining
      const withSlash = normalized.endsWith('/') ? normalized : normalized + '/';
      // Match both ~/.claude/ and ~/.claude (with or without trailing slash)
      const updated = content.replace(/~\/\.claude\/?/g, withSlash);
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
      }
    }
  }
}

/**
 * Remove empty directories recursively (bottom-up).
 */
function cleanEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      cleanEmptyDirs(path.join(dir, entry.name));
    }
  }
  // Re-read after recursive cleanup
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

// ---------------------------------------------------------------------------
// Manifest — tracks installed files via SHA256 for change detection & cleanup
// ---------------------------------------------------------------------------

function readManifest(targetDir) {
  const manifestPath = path.join(targetDir, 'cdd', MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(targetDir, installedFiles) {
  const manifest = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    files: {}
  };
  for (const filePath of installedFiles) {
    if (fs.existsSync(filePath)) {
      const rel = path.relative(targetDir, filePath).replace(/\\/g, '/');
      manifest.files[rel] = sha256(fs.readFileSync(filePath));
    }
  }
  const manifestPath = path.join(targetDir, 'cdd', MANIFEST_FILE);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

/**
 * Compare current file hashes against the manifest to find user-modified files.
 */
function detectModifiedFiles(targetDir, oldManifest) {
  if (!oldManifest || !oldManifest.files) return [];
  const modified = [];
  for (const [relPath, expectedHash] of Object.entries(oldManifest.files)) {
    const fullPath = path.join(targetDir, relPath);
    if (fs.existsSync(fullPath)) {
      const currentHash = sha256(fs.readFileSync(fullPath));
      if (currentHash !== expectedHash) {
        modified.push(relPath);
      }
    }
  }
  return modified;
}

/**
 * Remove files that existed in the old manifest but are no longer in the new file set.
 */
function cleanOrphanedFiles(targetDir, oldManifest, newFiles) {
  if (!oldManifest || !oldManifest.files) return [];
  const newRelPaths = new Set(
    newFiles.map(f => path.relative(targetDir, f).replace(/\\/g, '/'))
  );
  const orphans = [];
  for (const relPath of Object.keys(oldManifest.files)) {
    if (!newRelPaths.has(relPath)) {
      const fullPath = path.join(targetDir, relPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        orphans.push(relPath);
      }
    }
  }
  // Clean up any empty directories left behind
  cleanEmptyDirs(path.join(targetDir, 'commands', 'cdd'));
  cleanEmptyDirs(path.join(targetDir, 'cdd'));
  return orphans;
}

// ---------------------------------------------------------------------------
// Hook Registration — manages CDD hooks in settings.json
// ---------------------------------------------------------------------------

const CDD_SOURCE_MARKER = 'cdd';

/**
 * Get the path to Claude Code's settings.json.
 * Always uses the global ~/.claude/ location (hooks are global).
 */
function getSettingsPath() {
  const configDir = process.env.CLAUDE_CONFIG_DIR
    ? resolveHome(process.env.CLAUDE_CONFIG_DIR)
    : path.join(os.homedir(), '.claude');
  return path.join(configDir, 'settings.json');
}

/**
 * Read settings.json, returning {} if not found or invalid.
 */
function readSettingsJson() {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch {}
  return {};
}

/**
 * Write settings.json with pretty formatting.
 */
function writeSettingsJson(settings) {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Build the node command for a hook script, using resolved paths.
 */
function hookCommand(targetDir, scriptRelPath) {
  const scriptPath = path.join(targetDir, scriptRelPath).replace(/\\/g, '/');
  return `node "${scriptPath}"`;
}

/**
 * Register CDD hooks in settings.json.
 * Preserves existing non-CDD hooks. Uses __source marker for identification.
 *
 * Returns { hookCount, statusLineSet, statusLineSkipped }
 */
function registerHooks(targetDir) {
  const settings = readSettingsJson();
  let hookCount = 0;
  let statusLineSkipped = false;

  // Ensure hooks object exists
  if (!settings.hooks) settings.hooks = {};

  // Define CDD hook registrations
  const hookDefs = [
    {
      event: 'SessionStart',
      matcher: '',
      hooks: [
        { type: 'command', command: hookCommand(targetDir, 'cdd/hooks/session-start.js'), __source: CDD_SOURCE_MARKER },
        { type: 'command', command: hookCommand(targetDir, 'cdd/hooks/update-check.js'), __source: CDD_SOURCE_MARKER }
      ]
    },
    {
      event: 'PreToolUse',
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: hookCommand(targetDir, 'cdd/hooks/scope-guard.js'), __source: CDD_SOURCE_MARKER }
      ]
    },
    {
      event: 'Stop',
      matcher: '',
      hooks: [
        { type: 'command', command: hookCommand(targetDir, 'cdd/hooks/on-stop.js'), __source: CDD_SOURCE_MARKER }
      ]
    },
    {
      event: 'Notification',
      matcher: '',
      hooks: [
        { type: 'command', command: hookCommand(targetDir, 'cdd/hooks/on-notification.js'), __source: CDD_SOURCE_MARKER }
      ]
    }
  ];

  for (const def of hookDefs) {
    if (!Array.isArray(settings.hooks[def.event])) {
      settings.hooks[def.event] = [];
    }

    const eventHooks = settings.hooks[def.event];

    // Find existing matcher group or create one
    let matcherGroup = eventHooks.find(g =>
      (g.matcher || '') === def.matcher
    );

    if (!matcherGroup) {
      matcherGroup = { matcher: def.matcher, hooks: [] };
      eventHooks.push(matcherGroup);
    }

    if (!Array.isArray(matcherGroup.hooks)) {
      matcherGroup.hooks = [];
    }

    // Remove existing CDD hooks from this group
    matcherGroup.hooks = matcherGroup.hooks.filter(h => h.__source !== CDD_SOURCE_MARKER);

    // Append fresh CDD hooks
    matcherGroup.hooks.push(...def.hooks);
    hookCount += def.hooks.length;
  }

  // Register statusLine
  // Note: No __source marker on statusLine — native installer may reject unknown properties.
  // Identify CDD's statusLine by checking the command string instead.
  let statusLineSet = false;
  const cddStatusLineCmd = hookCommand(targetDir, 'cdd/hooks/statusline.js');
  const isCddStatusLine = settings.statusLine &&
    settings.statusLine.command && settings.statusLine.command.includes('cdd/hooks/statusline');
  if (settings.statusLine && !isCddStatusLine) {
    // Non-CDD statusLine exists — don't overwrite
    statusLineSkipped = true;
  } else {
    settings.statusLine = {
      type: 'command',
      command: cddStatusLineCmd
    };
    statusLineSet = true;
  }

  writeSettingsJson(settings);
  return { hookCount, statusLineSet, statusLineSkipped };
}

/**
 * Remove CDD hooks from settings.json.
 * Only removes entries with __source: "cdd". Cleans empty arrays/objects.
 *
 * Returns number of hooks removed.
 */
function unregisterHooks() {
  const settings = readSettingsJson();
  let removedCount = 0;

  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      if (!Array.isArray(settings.hooks[event])) continue;

      for (const group of settings.hooks[event]) {
        if (!Array.isArray(group.hooks)) continue;
        const before = group.hooks.length;
        group.hooks = group.hooks.filter(h => h.__source !== CDD_SOURCE_MARKER);
        removedCount += before - group.hooks.length;
      }

      // Remove empty matcher groups
      settings.hooks[event] = settings.hooks[event].filter(g =>
        Array.isArray(g.hooks) && g.hooks.length > 0
      );

      // Remove empty event arrays
      if (settings.hooks[event].length === 0) {
        delete settings.hooks[event];
      }
    }

    // Remove empty hooks object
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  // Remove CDD statusLine (match by command string or legacy __source marker)
  if (settings.statusLine && (
    (settings.statusLine.command && settings.statusLine.command.includes('cdd/hooks/statusline')) ||
    settings.statusLine.__source === CDD_SOURCE_MARKER
  )) {
    delete settings.statusLine;
    removedCount++;
  }

  writeSettingsJson(settings);
  return removedCount;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`
Contract-Driven Development (CDD) v${VERSION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install CDD slash commands and framework files for Claude Code.

USAGE
  npx contract-driven-dev@latest [options]

OPTIONS
  -g, --global      Install to ~/.claude/ (default)
  -l, --local       Install to ./.claude/ in current directory
  -u, --uninstall   Remove CDD files from target directory
  -y, --yes         Skip confirmation prompts
  -h, --help        Show this help message

EXAMPLES
  npx contract-driven-dev@latest              # Global install (interactive)
  npx contract-driven-dev@latest --local      # Local project install
  npx contract-driven-dev@latest --uninstall  # Remove global install
  npx contract-driven-dev@latest --uninstall --local  # Remove local install

AFTER INSTALL
  Open Claude Code and type:
    /cdd:help     — See all available commands
    /cdd:init     — Initialize CDD for your project
`);
}

function detectExisting(targetDir) {
  const commandsDir = path.join(targetDir, 'commands', 'cdd');
  const cddDir = path.join(targetDir, 'cdd');
  const versionFile = path.join(cddDir, 'VERSION');

  const hasCommands = fs.existsSync(commandsDir);
  const hasCdd = fs.existsSync(cddDir);
  const existingVersion = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf8').trim()
    : null;

  return { hasCommands, hasCdd, existingVersion };
}

async function install(targetDir, skipPrompt) {
  // Validate source directories exist in the package
  const srcCommands = path.join(PACKAGE_ROOT, 'commands', 'cdd');
  const srcCdd = path.join(PACKAGE_ROOT, 'cdd');

  if (!fs.existsSync(srcCommands)) {
    console.error(`\n  Error: Source commands directory not found: ${srcCommands}`);
    console.error('  The package may be corrupted. Try reinstalling.\n');
    process.exit(1);
  }

  if (!fs.existsSync(srcCdd)) {
    console.error(`\n  Error: Source framework directory not found: ${srcCdd}`);
    console.error('  The package may be corrupted. Try reinstalling.\n');
    process.exit(1);
  }

  const { hasCommands, hasCdd, existingVersion } = detectExisting(targetDir);
  const isExisting = hasCommands || hasCdd;
  const oldManifest = readManifest(targetDir);

  // Warn about user-modified files before overwriting
  if (isExisting && oldManifest) {
    const modified = detectModifiedFiles(targetDir, oldManifest);
    if (modified.length > 0) {
      console.log('\n  Warning: The following files have been modified since installation:');
      for (const f of modified) {
        console.log(`    - ${f}`);
      }
      console.log('  These modifications will be overwritten.\n');
    }
  }

  // Confirmation prompt
  if (isExisting) {
    const versionInfo = existingVersion ? ` (v${existingVersion})` : ' (unknown version)';
    console.log(`\n  Existing CDD installation detected${versionInfo} at:`);
    console.log(`    ${targetDir}`);

    if (!skipPrompt) {
      const answer = await prompt(`\n  Overwrite with v${VERSION}? [Y/n] `);
      if (answer && answer !== 'y' && answer !== 'yes') {
        console.log('  Installation cancelled.\n');
        process.exit(0);
      }
    } else {
      console.log(`\n  Overwriting with v${VERSION}...`);
    }
  } else if (!skipPrompt) {
    console.log(`\n  CDD v${VERSION} will be installed to:`);
    console.log(`    ${targetDir}\n`);
    const answer = await prompt('  Proceed? [Y/n] ');
    if (answer && answer !== 'y' && answer !== 'yes') {
      console.log('  Installation cancelled.\n');
      process.exit(0);
    }
  }

  // Track all installed files for manifest
  const installedFiles = [];

  // Copy commands/cdd/ -> {target}/commands/cdd/
  const destCommands = path.join(targetDir, 'commands', 'cdd');
  copyDirSync(srcCommands, destCommands, installedFiles);

  // Copy cdd/ -> {target}/cdd/
  const destCdd = path.join(targetDir, 'cdd');
  copyDirSync(srcCdd, destCdd, installedFiles);

  // Path substitution in .md files
  substitutePathsInMdFiles(destCommands, targetDir);
  substitutePathsInMdFiles(destCdd, targetDir);

  // Write VERSION file
  const versionPath = path.join(destCdd, 'VERSION');
  fs.writeFileSync(versionPath, VERSION, 'utf8');
  installedFiles.push(versionPath);

  // Clean up orphaned files from previous versions
  const orphans = cleanOrphanedFiles(targetDir, oldManifest, installedFiles);

  // Write manifest for future change detection
  writeManifest(targetDir, installedFiles);

  // Register hooks in settings.json
  const hookResult = registerHooks(targetDir);

  // Count installed files by category
  const commandCount = installedFiles.filter(f =>
    f.replace(/\\/g, '/').includes('/commands/cdd/')
  ).length;
  const frameworkCount = installedFiles.filter(f => {
    const rel = f.replace(/\\/g, '/');
    return rel.includes('/cdd/') && !rel.includes('/commands/cdd/');
  }).length;
  const hookFileCount = installedFiles.filter(f =>
    f.replace(/\\/g, '/').includes('/cdd/hooks/')
  ).length;
  const notifierCount = installedFiles.filter(f =>
    f.replace(/\\/g, '/').includes('/cdd/notifiers/')
  ).length;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CDD v${VERSION} installed successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Target:     ${targetDir}
  Commands:   ${commandCount} files -> commands/cdd/
  Framework:  ${frameworkCount} files -> cdd/
  Hooks:      ${hookResult.hookCount} hooks registered in settings.json`);

  if (hookFileCount > 0) {
    console.log(`  Scripts:   ${hookFileCount} hook script(s) -> cdd/hooks/`);
  }
  if (notifierCount > 0) {
    console.log(`  Notifiers: ${notifierCount} notifier(s) -> cdd/notifiers/`);
  }
  if (hookResult.statusLineSet) {
    console.log('  StatusLine: registered');
  }
  if (hookResult.statusLineSkipped) {
    console.log('  StatusLine: skipped (existing non-CDD statusLine found)');
  }

  if (orphans.length > 0) {
    console.log(`  Cleaned:   ${orphans.length} orphaned file(s) from previous version`);
  }

  console.log(`
  AVAILABLE COMMANDS
  ──────────────────
  /cdd:init             Initialize CDD for a new project
  /cdd:help             Show all CDD commands
  /cdd:brief            Capture project brief
  /cdd:plan             Transform brief into requirements
  /cdd:modularize       Break system into modules
  /cdd:contract         Define interface contracts
  /cdd:foundation       Build infrastructure foundations
  /cdd:build            Build a module from its contract
  /cdd:verify           Verify module against contract
  /cdd:test             Run tests, mark module complete
  /cdd:status           Show project status
  /cdd:resume           Resume in-progress work
  /cdd:context          Load module context
  /cdd:reset            Reset a module build
  /cdd:contract-change  Request a contract change
  /cdd:audit            Full system audit
  /cdd:add-module       Scope new modules for a built system
  /cdd:add-contract     Generate contract for an added module
  /cdd:change-request   Sort changes into per-module change files
  /cdd:change           Process one module's changes

  GET STARTED
  ───────────
  Open Claude Code in your project directory and type:
    /cdd:init

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function uninstall(targetDir) {
  const manifest = readManifest(targetDir);

  // Unregister hooks from settings.json first
  const hooksRemoved = unregisterHooks();

  if (manifest && manifest.files) {
    // Surgical uninstall: only remove files we installed
    let removedCount = 0;
    for (const relPath of Object.keys(manifest.files)) {
      const fullPath = path.join(targetDir, relPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        removedCount++;
      }
    }

    // Remove manifest and VERSION file
    for (const extraFile of [
      path.join(targetDir, 'cdd', MANIFEST_FILE),
      path.join(targetDir, 'cdd', 'VERSION')
    ]) {
      if (fs.existsSync(extraFile)) {
        fs.unlinkSync(extraFile);
        removedCount++;
      }
    }

    // Clean up empty directories left behind
    cleanEmptyDirs(path.join(targetDir, 'commands', 'cdd'));
    cleanEmptyDirs(path.join(targetDir, 'cdd'));

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CDD uninstalled from: ${targetDir}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Removed ${removedCount} file(s).
  Hooks:  ${hooksRemoved} hook(s) removed from settings.json

  Note: Project .cdd/ directories are NOT removed.
  Those belong to your projects.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } else {
    // Fallback: no manifest found (pre-manifest installation)
    const commandsDir = path.join(targetDir, 'commands', 'cdd');
    const cddDir = path.join(targetDir, 'cdd');
    const hasCommands = fs.existsSync(commandsDir);
    const hasCdd = fs.existsSync(cddDir);

    if (!hasCommands && !hasCdd) {
      console.log(`\n  No CDD installation found at: ${targetDir}\n`);
      return;
    }

    console.log('\n  Warning: No install manifest found. This installation predates manifest tracking.');
    console.log('  Removing known CDD directories (commands/cdd/ and cdd/)...\n');

    const removedCommands = hasCommands
      ? (fs.rmSync(commandsDir, { recursive: true, force: true }), true)
      : false;
    const removedCdd = hasCdd
      ? (fs.rmSync(cddDir, { recursive: true, force: true }), true)
      : false;

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CDD uninstalled from: ${targetDir}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Removed:
    ${removedCommands ? 'V' : '-'} commands/cdd/
    ${removedCdd ? 'V' : '-'} cdd/
    ${hooksRemoved > 0 ? 'V' : '-'} ${hooksRemoved} hook(s) from settings.json

  Note: Project .cdd/ directories are NOT removed.
  Those belong to your projects.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (hasFlag(args, '--help', '-h')) {
    showHelp();
    process.exit(0);
  }

  const isLocal = hasFlag(args, '--local', '-l');
  const isGlobal = hasFlag(args, '--global', '-g');
  const isUninstall = hasFlag(args, '--uninstall', '-u');
  const skipPrompt = hasFlag(args, '--yes', '-y');

  if (isLocal && isGlobal) {
    console.error('\n  Error: Cannot use --local and --global together.\n');
    process.exit(1);
  }

  const targetDir = getTargetDir(isLocal);

  try {
    if (isUninstall) {
      uninstall(targetDir);
    } else {
      await install(targetDir, skipPrompt);
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.error('  Permission denied. Try running with elevated privileges or check directory permissions.');
    } else if (err.code === 'ENOSPC') {
      console.error('  Disk full. Free up space and try again.');
    }
    console.error('');
    process.exit(1);
  }
}

main();
