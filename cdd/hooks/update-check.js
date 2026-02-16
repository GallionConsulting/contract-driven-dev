#!/usr/bin/env node

/**
 * CDD Hook: SessionStart — Background Update Check
 *
 * Spawns a detached child that queries the npm registry to check for
 * newer versions of contract-driven-dev. Result is cached for 1 hour.
 * The statusline reads this cache to display update notifications.
 *
 * Uses HTTPS directly (no npm CLI dependency).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { findCddRoot, readStdin, getCddVersion } = require('./lib/state');
const debug = require('./lib/debug');

const CACHE_DIR = path.join(os.homedir(), '.claude', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'cdd-update-check.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function isCacheFresh() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!data.checkedAt) return false;
    const age = Date.now() - new Date(data.checkedAt).getTime();
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function main() {
  try {
    // Consume stdin (hook protocol requirement)
    await readStdin(1000);

    // Skip if cache is still fresh
    if (isCacheFresh()) {
      debug.log(findCddRoot(process.cwd()), 'update-check', 'Cache still fresh, skipping');
      return;
    }
    debug.log(findCddRoot(process.cwd()), 'update-check', 'Cache stale, spawning check');

    // Spawn detached child to do the actual check
    // The child script is inline via -e to avoid needing another file
    const checkScript = `
      const https = require('https');
      const fs = require('fs');
      const path = require('path');

      const cacheDir = ${JSON.stringify(CACHE_DIR)};
      const cacheFile = ${JSON.stringify(CACHE_FILE)};
      const currentVersion = ${JSON.stringify(getCddVersion() || '0.0.0')};

      function compareVersions(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if ((pa[i] || 0) > (pb[i] || 0)) return 1;
          if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        }
        return 0;
      }

      const req = https.get('https://registry.npmjs.org/contract-driven-dev/latest', {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const pkg = JSON.parse(data);
            const latest = pkg.version;
            const hasUpdate = compareVersions(latest, currentVersion) > 0;

            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(cacheFile, JSON.stringify({
              current: currentVersion,
              latest: latest,
              hasUpdate: hasUpdate,
              checkedAt: new Date().toISOString()
            }, null, 2));
          } catch {}
        });
      });

      req.on('error', () => {
        // Network error — write cache to prevent retry storm
        try {
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify({
            current: currentVersion,
            latest: null,
            hasUpdate: false,
            checkedAt: new Date().toISOString(),
            error: 'network'
          }, null, 2));
        } catch {}
      });

      req.on('timeout', () => { req.destroy(); });
    `;

    const child = spawn(process.execPath, ['-e', checkScript], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    child.unref();
    child.on('error', () => {});

  } catch (err) {
    debug.log(findCddRoot(process.cwd()), 'update-check', 'Hook error', err);
  }
}

main();
