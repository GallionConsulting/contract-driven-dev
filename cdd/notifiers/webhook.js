#!/usr/bin/env node
/**
 * CDD Notifier — Webhook
 *
 * POSTs event JSON to any URL. Works with Telegram Bot API, Slack Incoming
 * Webhooks, Discord Webhooks, n8n, Zapier, or any endpoint that accepts JSON.
 *
 * Reads JSON payload from stdin (spawned by cdd/hooks/lib/notify.js).
 *
 * Configuration (via notifier_config in stdin payload):
 *   url:            Required. The URL to POST to.
 *   body_template:  Optional. A JSON string with {{field}} placeholders that
 *                   are replaced with values from the event payload.
 *                   If omitted, the raw event payload is POSTed as-is.
 *
 * Example .cdd/config.yaml entry:
 *   notifications:
 *     enabled: true
 *     notifiers:
 *       - type: webhook
 *         url: "https://hooks.slack.com/services/T.../B.../xxx"
 *         events: [stopped, needs_input]
 *       - type: webhook
 *         url: "https://api.telegram.org/bot<TOKEN>/sendMessage"
 *         events: [stopped]
 *         body_template: '{"chat_id": "<CHAT_ID>", "text": "{{message}}"}'
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

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
// Template expansion
// ---------------------------------------------------------------------------

/**
 * Replace {{field}} placeholders in a template string with values from data.
 * Supports dotted paths: {{notifier_config.url}}
 * Special placeholder {{message}} produces a human-readable summary.
 */
function expandTemplate(template, data) {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    if (key === 'message') return formatMessage(data);
    const val = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : ''), data);
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}

/**
 * Format a human-readable message from the event payload.
 */
function formatMessage(data) {
  const lines = [];
  const project = data.project || data.cwd || 'unknown';
  lines.push(`CDD | ${project}`);
  lines.push(`Status: ${data.status || data.event || 'unknown'}`);
  if (data.phase || data.module) {
    const parts = [];
    if (data.phase) parts.push(data.phase);
    if (data.module) parts.push(`Module: ${data.module}`);
    if (data.modules_complete) parts.push(`(${data.modules_complete})`);
    lines.push(parts.join(' | '));
  }
  if (data.last_response) {
    const truncated = data.last_response.length > 200
      ? data.last_response.slice(0, 200) + '...'
      : data.last_response;
    lines.push(`Last: "${truncated}"`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTTP POST
// ---------------------------------------------------------------------------

function postJSON(url, body) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

      const req = transport.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: 10000
      }, (res) => {
        res.resume(); // drain response
        resolve(res.statusCode);
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(bodyStr);
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
  const payload = await readStdin();
  if (!payload) process.exit(0);

  const config = payload.notifier_config;
  if (!config || !config.url) process.exit(0);

  // Build request body
  let body;
  if (config.body_template) {
    // Expand template placeholders and parse as JSON
    const expanded = expandTemplate(config.body_template, payload);
    try { body = JSON.parse(expanded); }
    catch { body = expanded; } // If not valid JSON, send as raw string
  } else {
    // Strip notifier_config from the payload before posting
    const { notifier_config, ...eventData } = payload;
    body = eventData;
  }

  await postJSON(config.url, body);
}

main().catch(() => {}).finally(() => process.exit(0));
