/**
 * CDD Hooks — Shared State Library
 *
 * Provides YAML parsing, state/config reading, and shared utilities
 * for all CDD hook scripts. Zero dependencies — Node.js builtins only.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// YAML Parser — handles CDD's constrained YAML subset
// ---------------------------------------------------------------------------

/**
 * Parse CDD's constrained YAML subset into a JS object.
 *
 * Supports: scalars, nested objects (up to 3 levels), arrays (block & inline),
 * empty {} and [], comments, quoted strings, booleans, numbers, null/~.
 */
function parseSimpleYaml(text) {
  if (!text || typeof text !== 'string') return {};

  const lines = text.split('\n');
  const root = {};
  const stack = [{ obj: root, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.replace(/\s+$/, '');

    // Skip empty lines and comments
    if (!trimmed || /^\s*#/.test(trimmed)) continue;

    // Measure indent
    const match = trimmed.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    const content = trimmed.slice(indent);

    // Array item: "- value" or "- key: value"
    if (content.startsWith('- ')) {
      const itemContent = content.slice(2).trim();

      // Find parent at or above this indent level
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];

      // If parent's current key holds an array, push to it
      if (parent.arrayKey) {
        const arr = parent.obj[parent.arrayKey];
        if (itemContent.includes(': ')) {
          // Array of objects: "- key: value"
          const obj = {};
          const colonIdx = itemContent.indexOf(': ');
          const k = itemContent.slice(0, colonIdx).trim();
          const v = parseYamlValue(itemContent.slice(colonIdx + 2).trim());
          obj[k] = v;
          arr.push(obj);
          stack.push({ obj: obj, indent: indent + 1, arrayKey: null });
        } else {
          arr.push(parseYamlValue(itemContent));
        }
      }
      continue;
    }

    // Key-value pair: "key: value"
    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) continue;

    const key = content.slice(0, colonIdx).trim();
    const afterColon = content.slice(colonIdx + 1);
    const valueStr = afterColon.trim();

    // Pop stack to find the right parent for this indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (valueStr === '' || valueStr === '') {
      // Could be a nested object or block array — peek at next non-empty line
      const nextLine = peekNextContent(lines, i + 1);
      if (nextLine && nextLine.trimmed.slice(nextLine.indent).startsWith('- ')) {
        // Block array
        parent[key] = [];
        stack.push({ obj: parent, indent: indent, arrayKey: key });
      } else {
        // Nested object
        parent[key] = {};
        stack.push({ obj: parent[key], indent: indent, arrayKey: null });
      }
    } else if (valueStr === '{}') {
      parent[key] = {};
    } else if (valueStr === '[]') {
      parent[key] = [];
    } else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      // Inline array: [a, b, c]
      parent[key] = parseInlineArray(valueStr);
    } else {
      parent[key] = parseYamlValue(valueStr);
    }
  }

  return root;
}

/**
 * Peek ahead to find the next non-empty, non-comment line.
 */
function peekNextContent(lines, startIdx) {
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\s+$/, '');
    if (!trimmed || /^\s*#/.test(trimmed)) continue;
    const match = trimmed.match(/^(\s*)/);
    return { trimmed, indent: match ? match[1].length : 0 };
  }
  return null;
}

/**
 * Parse an inline YAML array like [a, b, c] or [stopped, needs_input].
 */
function parseInlineArray(str) {
  const inner = str.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(item => parseYamlValue(item.trim()));
}

/**
 * Parse a YAML scalar value: quoted strings, booleans, numbers, null.
 */
function parseYamlValue(str) {
  if (str === '' || str === '~' || str === 'null') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Quoted string
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return Number(str);
  }

  // Strip inline comment
  const commentIdx = str.indexOf(' #');
  if (commentIdx !== -1) {
    return parseYamlValue(str.slice(0, commentIdx).trim());
  }

  return str;
}

// ---------------------------------------------------------------------------
// File Readers
// ---------------------------------------------------------------------------

/**
 * Find the CDD root by looking for .cdd/state.yaml in the given directory.
 * Returns the .cdd/ path, or null if not found.
 */
function findCddRoot(cwd) {
  try {
    cwd = cwd || process.cwd();
    const cddDir = path.join(cwd, '.cdd');
    const stateFile = path.join(cddDir, 'state.yaml');
    if (fs.existsSync(stateFile)) return cddDir;
    return null;
  } catch {
    return null;
  }
}

/**
 * Read and parse .cdd/state.yaml.
 */
function readStateYaml(cddRoot) {
  try {
    const content = fs.readFileSync(path.join(cddRoot, 'state.yaml'), 'utf8');
    return parseSimpleYaml(content);
  } catch {
    return null;
  }
}

/**
 * Read and parse .cdd/config.yaml.
 */
function readConfigYaml(cddRoot) {
  try {
    const content = fs.readFileSync(path.join(cddRoot, 'config.yaml'), 'utf8');
    return parseSimpleYaml(content);
  } catch {
    return null;
  }
}

/**
 * Read and parse a module contract file: .cdd/contracts/{name}.yaml
 */
function readModuleContract(cddRoot, name) {
  try {
    const content = fs.readFileSync(
      path.join(cddRoot, 'contracts', `${name}.yaml`), 'utf8'
    );
    return parseSimpleYaml(content);
  } catch {
    return null;
  }
}

/**
 * Get CDD version from the VERSION file (installed alongside hooks).
 */
function getCddVersion() {
  try {
    // VERSION is at cdd/VERSION, hooks are at cdd/hooks/lib/
    const versionPath = path.join(__dirname, '..', '..', 'VERSION');
    return fs.readFileSync(versionPath, 'utf8').trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stdin Reader
// ---------------------------------------------------------------------------

/**
 * Read stdin with a timeout. Returns parsed JSON or null.
 * Claude Code sends hook input as JSON on stdin.
 */
function readStdin(timeoutMs) {
  timeoutMs = timeoutMs || 3000;

  return new Promise(resolve => {
    let data = '';
    let resolved = false;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      // Resolve with whatever data we have — don't destroy stdin
      // (destroying stdin corrupts stdio pipes on Windows)
      try {
        finish(data ? JSON.parse(data) : null);
      } catch {
        finish(null);
      }
    }, timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        finish(data ? JSON.parse(data) : null);
      } catch {
        finish(null);
      }
    });
    process.stdin.on('error', () => finish(null));
    process.stdin.resume();
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  parseSimpleYaml,
  findCddRoot,
  readStateYaml,
  readConfigYaml,
  readModuleContract,
  getCddVersion,
  readStdin
};
