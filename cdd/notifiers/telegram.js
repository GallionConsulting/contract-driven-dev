#!/usr/bin/env node
/**
 * CDD Notifier — Telegram
 *
 * Convenience wrapper that sends formatted messages to a Telegram chat
 * via the Bot API. Uses environment variables for credentials so they
 * don't need to be stored in .cdd/config.yaml.
 *
 * Environment variables:
 *   CDD_TELEGRAM_BOT_TOKEN  — Telegram bot token (from @BotFather)
 *   CDD_TELEGRAM_CHAT_ID    — Chat/group ID to send messages to
 *
 * Reads JSON payload from stdin (spawned by cdd/hooks/lib/notify.js).
 *
 * Example .cdd/config.yaml entry:
 *   notifications:
 *     enabled: true
 *     notifiers:
 *       - type: telegram
 *         events: [stopped, needs_input, needs_permission]
 *
 * Setup:
 *   1. Create a bot via @BotFather on Telegram, copy the token
 *   2. Send a message to your bot, then fetch your chat_id:
 *      curl https://api.telegram.org/bot<TOKEN>/getUpdates
 *   3. Set environment variables:
 *      export CDD_TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
 *      export CDD_TELEGRAM_CHAT_ID="987654321"
 */

'use strict';

const https = require('https');
const debug = require('../hooks/lib/debug');

// ---------------------------------------------------------------------------
// Stdin reader
// ---------------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const timeout = setTimeout(() => {
      process.stdin.destroy();
      resolve(null);
    }, 5000);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      clearTimeout(timeout);
      try { resolve(JSON.parse(data)); }
      catch { resolve(null); }
    });
    process.stdin.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Message formatting
// ---------------------------------------------------------------------------

/** Escape Markdown special characters for Telegram MarkdownV2 */
function escapeMarkdown(text) {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format event payload into a Telegram-friendly Markdown message.
 */
function formatTelegramMessage(payload) {
  const lines = [];
  const project = escapeMarkdown(payload.project || payload.cwd || 'unknown');
  const event = payload.event || 'unknown';

  // Header with emoji based on event type
  const emoji = {
    stopped: '\u{1F534}',           // red circle
    needs_input: '\u{1F7E1}',      // yellow circle
    needs_permission: '\u{1F7E0}', // orange circle
    session_started: '\u{1F7E2}',  // green circle
    scope_warning: '\u{26A0}\u{FE0F}',       // warning
    running: '\u{1F535}'            // blue circle
  };

  lines.push(`${emoji[event] || '\u{2139}\u{FE0F}'} *CDD \\| ${project}*`);
  lines.push('');

  // Status
  const status = escapeMarkdown(payload.status || event.toUpperCase());
  lines.push(`*Status:* ${status}`);

  // Phase & module
  if (payload.phase) {
    let phaseLine = `*Phase:* ${escapeMarkdown(payload.phase)}`;
    if (payload.module) {
      phaseLine += ` \\| *Module:* ${escapeMarkdown(payload.module)}`;
    }
    if (payload.modules_complete) {
      phaseLine += ` \\(${escapeMarkdown(payload.modules_complete)}\\)`;
    }
    lines.push(phaseLine);
  }

  // Last message from Claude
  if (payload.last_response) {
    const truncated = payload.last_response.length > 300
      ? payload.last_response.slice(0, 300) + '...'
      : payload.last_response;
    lines.push('');
    lines.push(`_${escapeMarkdown(truncated)}_`);
  }

  // Timestamp
  if (payload.updated_at) {
    const time = new Date(payload.updated_at).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    lines.push('');
    lines.push(escapeMarkdown(time));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------

function sendTelegramMessage(token, chatId, text) {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'MarkdownV2'
      });

      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 10000
      }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const token = process.env.CDD_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CDD_TELEGRAM_CHAT_ID;
  if (!token || !chatId) process.exit(0); // Not configured — silent exit

  const payload = await readStdin();
  if (!payload) process.exit(0);

  const cddRoot = payload._cdd_root || null;
  debug.log(cddRoot, 'telegram', `Sending to chat ${chatId}`, { event: payload.event });

  const message = formatTelegramMessage(payload);
  const status = await sendTelegramMessage(token, chatId, message);
  debug.log(cddRoot, 'telegram', `Response status: ${status}`);
}

main().catch(() => {}).finally(() => process.exit(0));
