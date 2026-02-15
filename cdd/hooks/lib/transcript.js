/**
 * CDD Hooks — Transcript Reader
 *
 * Extracts the last Claude message from a session transcript JSONL file.
 * Best-effort — returns null on any failure.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_LAST_MESSAGE_LENGTH = 500;

/**
 * Find the transcript JSONL path for a given session ID.
 * Scans ~/.claude/projects/ for the most recent .jsonl file matching the session.
 */
function findTranscriptPath(sessionId) {
  try {
    if (!sessionId) return null;

    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return null;

    // Search all project subdirectories for matching JSONL files
    let bestPath = null;
    let bestMtime = 0;

    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projDir = path.join(projectsDir, dir.name);

      try {
        const files = fs.readdirSync(projDir);
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;

          // Session ID is typically the filename (without extension)
          const filePath = path.join(projDir, file);

          // Check if this file matches the session or is the most recent
          if (file.includes(sessionId)) {
            return filePath; // Exact match — return immediately
          }

          // Track most recent as fallback
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs > bestMtime) {
              bestMtime = stat.mtimeMs;
              bestPath = filePath;
            }
          } catch {
            // Skip files we can't stat
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    return bestPath;
  } catch {
    return null;
  }
}

/**
 * Extract the last assistant message from a transcript JSONL file.
 * Reads from the end for efficiency. Truncates to MAX_LAST_MESSAGE_LENGTH.
 *
 * Handles both content formats:
 *   - content: "string"
 *   - content: [{type: "text", text: "..."}]
 */
function getLastClaudeMessage(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');

    // Read from end to find last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.role !== 'assistant') continue;

        let text = null;

        if (typeof entry.content === 'string') {
          text = entry.content;
        } else if (Array.isArray(entry.content)) {
          // Find first text block
          for (const block of entry.content) {
            if (block.type === 'text' && block.text) {
              text = block.text;
              break;
            }
          }
        }

        if (text) {
          // Truncate to max length
          if (text.length > MAX_LAST_MESSAGE_LENGTH) {
            text = text.slice(0, MAX_LAST_MESSAGE_LENGTH) + '...';
          }
          return text;
        }
      } catch {
        // Skip malformed lines
      }
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = {
  findTranscriptPath,
  getLastClaudeMessage
};
