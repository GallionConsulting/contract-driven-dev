/**
 * CDD Hooks — Git Checkpoint Library
 *
 * Auto-commits a git snapshot before code-modifying CDD operations.
 * Provides rollback capability via standard git commands (reset, revert).
 * Zero dependencies — Node.js builtins only.
 *
 * CLI usage: node checkpoint.js <command> [details]
 * Output:    JSON to stdout
 *
 * Never throws — checkpoint failure must never block CDD operations.
 */

const { execSync } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cmd, cwd) {
  return execSync(`git ${cmd}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function isGitRepo(cwd) {
  try {
    git('rev-parse --is-inside-work-tree', cwd);
    return true;
  } catch {
    return false;
  }
}

function hasChanges(cwd) {
  try {
    const status = git('status --porcelain', cwd);
    return status.length > 0;
  } catch {
    return false;
  }
}

function getCurrentHash(cwd) {
  try {
    return git('rev-parse --short HEAD', cwd);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checkpoint creation
// ---------------------------------------------------------------------------

/**
 * Create a git checkpoint commit.
 *
 * @param {string} command - CDD command name (build, change, foundation, contract-change)
 * @param {string} details - Additional context (module name, batch id, etc.)
 * @param {string} [cwd]   - Working directory (defaults to process.cwd())
 * @returns {{ created: boolean, hash: string|null, message: string, error?: string }}
 */
function createCheckpoint(command, details, cwd) {
  cwd = cwd || process.cwd();

  if (!isGitRepo(cwd)) {
    return { created: false, hash: null, message: 'not_git_repo' };
  }

  if (!hasChanges(cwd)) {
    return { created: false, hash: getCurrentHash(cwd), message: 'no_changes' };
  }

  const msg = `cdd(checkpoint): before ${command}${details ? ' ' + details : ''}`;

  try {
    git('add -A', cwd);
    git(`commit -m "${msg}" --no-verify`, cwd);
    const hash = getCurrentHash(cwd);
    return { created: true, hash, message: msg };
  } catch (err) {
    return { created: false, hash: getCurrentHash(cwd), message: 'git_error', error: err.message };
  }
}

// ---------------------------------------------------------------------------
// CLI interface
// ---------------------------------------------------------------------------

function main() {
  const command = process.argv[2] || 'unknown';
  const details = process.argv[3] || '';
  const result = createCheckpoint(command, details);
  process.stdout.write(JSON.stringify(result));
}

if (require.main === module) {
  main();
}

module.exports = { isGitRepo, hasChanges, createCheckpoint };
