# Hooks & Notifications

CDD includes a hook system that integrates with Claude Code's lifecycle events. Hooks provide session awareness, a status line, module scope warnings, and an optional notification system for external alerts.

## Hooks Overview

All hooks are installed automatically by the CDD installer and registered in your `settings.json`. They require zero configuration and silently do nothing in non-CDD projects.

| Hook | Event | What It Does |
|------|-------|-------------|
| Session Start | `SessionStart` | Detects `.cdd/` and shows phase/module status when you start a session |
| Update Check | `SessionStart` | Checks npm for newer CDD versions in the background |
| Status Line | `statusLine` | Renders a persistent status bar with phase, module, context usage |
| Scope Guard | `PreToolUse` | Warns when Claude writes files outside the active module's path |
| On Stop | `Stop` | Updates monitor state and dispatches notifications when Claude stops |

### Session Start

When you open Claude Code in a CDD project, the session start hook reads `.cdd/state.yaml` and outputs a status summary:

```
[CDD] Phase: BUILD | Module: auth (3/7 complete) | Use /cdd:resume to continue
```

If the project has no `.cdd/` directory, the hook is silent.

### Update Check

A background process (never blocks startup) checks whether a newer version of CDD is available on npm. The result is cached for one hour at `~/.claude/cache/cdd-update-check.json` and displayed in the status line when an update is found.

### Status Line

The status line appears at the bottom of your Claude Code session:

```
Claude Opus 4 | BUILD: auth (3/7) | my-project
```

Components:
- **Model name** -- from Claude Code
- **CDD phase + module** -- current build state (only in CDD projects)
- **Project directory** -- basename of the working directory
- **Update notice** -- shown when a newer CDD version is available

### Scope Guard

During the build cycle, the scope guard fires on `Write` and `Edit` tool calls. If Claude is about to write a file outside the active module's source path, it outputs a warning:

```
[CDD] Warning: Writing to src/billing/invoice.js but active module is "auth" (src/auth/)
```

This is **advisory only** -- it never blocks Claude. Writes to the following paths are always allowed without warning:

- The active module's `source_path`
- The project's test directory
- Shared/common directories (`shared/`, `common/`, `lib/`, `utils/`, `helpers/`)
- The `.cdd/` directory
- Config files at the project root

### On Stop

When Claude stops (end of response), this hook updates `.cdd/monitor/state.json` with the current state and dispatches a `stopped` event to any configured notifiers. This is the primary trigger for "Claude needs attention" alerts.

---

## Monitor State File

Every hook writes state to `.cdd/monitor/state.json` in your project directory. This file is always written regardless of whether notifications are configured.

```json
{
  "session_id": "abc123",
  "status": "STOPPED",
  "phase": "BUILD",
  "module": "auth",
  "modules_complete": "3/7",
  "project": "my-saas-app",
  "cwd": "/path/to/my-saas-app",
  "last_response": "I've finished implementing the auth middleware.",
  "updated_at": "2026-02-14T10:30:00.000Z",
  "started_at": "2026-02-14T10:00:00.000Z"
}
```

**Status values:** `STARTED`, `RUNNING`, `STOPPED`, `NEEDS_INPUT`, `NEEDS_PERMISSION`

You can poll this file from external tools, scripts, or dashboards without configuring the notification system at all.

---

## Notifications (Optional)

The notification system lets you receive alerts when Claude stops, needs input, or needs permission. This is useful when you're away from the terminal -- you can get a Telegram message, a Slack ping, or a webhook POST to any service.

Notifications are **disabled by default** and entirely optional.

### Configuration

Add a `notifications` section to your project's `.cdd/config.yaml`:

```yaml
notifications:
  enabled: true
  notifiers:
    - type: webhook
      url: "https://your-endpoint.example.com/hook"
      events: [stopped, needs_input, needs_permission]
```

The `events` field controls which events trigger the notifier. Use an array of event names or `all` to receive everything.

**Event names:** `session_started`, `running`, `stopped`, `scope_warning`, `needs_input`, `needs_permission`

### Built-in Notifiers

#### Webhook

Posts event JSON to any URL. Works with Slack Incoming Webhooks, Discord Webhooks, n8n, Zapier, or any endpoint that accepts a JSON POST.

```yaml
notifications:
  enabled: true
  notifiers:
    - type: webhook
      url: "https://hooks.slack.com/services/T.../B.../xxx"
      events: [stopped, needs_input]
```

**Payload:** The full event state is POSTed as JSON:

```json
{
  "event": "stopped",
  "session_id": "abc123",
  "status": "STOPPED",
  "phase": "BUILD",
  "module": "auth",
  "modules_complete": "3/7",
  "project": "my-saas-app",
  "last_response": "Finished auth middleware. Ready for /cdd:verify auth",
  "updated_at": "2026-02-14T10:30:00.000Z"
}
```

**Body templates:** For services that require a specific JSON structure (like Telegram's Bot API), use `body_template` with `{{field}}` placeholders:

```yaml
- type: webhook
  url: "https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage"
  events: [stopped]
  body_template: '{"chat_id": "<YOUR_CHAT_ID>", "text": "{{message}}"}'
```

The `{{message}}` placeholder produces a human-readable summary:

```
CDD | my-saas-app
Status: STOPPED
BUILD | Module: auth (3/7)
Last: "Finished auth middleware. Ready for /cdd:verify auth"
```

Any field from the event payload can be used: `{{event}}`, `{{phase}}`, `{{module}}`, `{{project}}`, `{{status}}`, `{{last_response}}`, `{{modules_complete}}`.

#### Telegram

A convenience notifier that sends formatted messages directly to a Telegram chat. Credentials are read from environment variables so they don't need to be stored in your config file.

**Setup:**

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram and copy the token
2. Send any message to your bot, then fetch your chat ID:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id": 123456789}` in the response.
3. Set environment variables (add to your shell profile for persistence):
   ```bash
   export CDD_TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
   export CDD_TELEGRAM_CHAT_ID="987654321"
   ```

**Config:**

```yaml
notifications:
  enabled: true
  notifiers:
    - type: telegram
      events: [stopped, needs_input, needs_permission]
```

No `url` needed -- the Telegram notifier handles the API details. Messages are formatted with Markdown and include status emoji indicators.

#### Custom

Run any command that reads JSON from stdin. Use this to integrate with tools or scripts in any language.

```yaml
notifications:
  enabled: true
  notifiers:
    - type: custom
      command: "node /path/to/my-notifier.js"
      events: [stopped]
```

The command receives the full event payload as JSON on stdin. Write your script to read stdin, parse the JSON, and do whatever you need (send an email, play a sound, write to a log, etc.).

**Example custom notifier (Node.js):**

```javascript
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  const event = JSON.parse(data);
  console.log(`[${event.event}] ${event.project} - ${event.module}`);
});
```

**Example custom notifier (Python):**

```python
import sys, json
event = json.load(sys.stdin)
print(f"[{event['event']}] {event['project']} - {event['module']}")
```

### Multiple Notifiers

You can configure multiple notifiers. Each one independently matches against the event list:

```yaml
notifications:
  enabled: true
  notifiers:
    # Alert on Telegram when Claude stops
    - type: telegram
      events: [stopped, needs_input]

    # Log everything to a webhook for monitoring
    - type: webhook
      url: "https://my-logging-service.example.com/cdd"
      events: all

    # Run a custom sound alert script
    - type: custom
      command: "node ~/scripts/play-alert.js"
      events: [stopped]
```

### Design Notes

- **Fire-and-forget** -- Notifiers are spawned as detached background processes. Hooks never wait for them to finish, so notification failures can't slow down or break Claude.
- **Silent failure** -- If a notifier crashes, times out, or the URL is unreachable, nothing happens. No errors are shown to Claude or the user.
- **State file first** -- The monitor state file (`.cdd/monitor/state.json`) is always written before notifiers are dispatched. Even if notifications are disabled, you can always poll the state file.
- **Zero dependencies** -- All notifiers use Node.js built-in modules (`https`, `http`). No npm packages required.
