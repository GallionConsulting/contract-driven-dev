# Contract-Driven Development (CDD)

![Version](https://img.shields.io/badge/version-2.8.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A slash-command toolkit for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that lets you build real, multi-module projects — the kind that are too big for a single conversation. You describe what you want, CDD breaks it into pieces with clear contracts between them, and then you build each piece in a focused session. Nothing gets lost between sessions because everything important lives in files, not chat history.

## Why CDD?

If you've ever tried to build something substantial with an AI assistant, you know the pattern: the first few sessions go great, then things start slipping. The AI forgets earlier decisions, modules start clashing, and you spend more time re-explaining context than writing code. CDD fixes this with a few simple ideas:

- **Decide the interfaces first, then build** — before any code is written, every module's inputs, outputs, and data access are spelled out in a contract. This means no surprises when modules need to talk to each other.
- **One focused session per task** — each command does one thing and stays well within the context window, so Claude never gets overwhelmed. You `/clear` between steps and pick up right where you left off.
- **Progress lives in files, not chat history** — decisions, contracts, and handoff notes are all saved to your project's `.cdd/` directory. Close your terminal, come back tomorrow, and nothing is lost.
- **Clear data ownership** — every database table belongs to one module. Other modules read from it through declared contracts. No more "who's writing to this table?" mysteries.
- **Alerts when CDD needs you** — get a [Telegram message, Slack ping, or webhook](docs/notifications.md) when a step finishes or needs input, so you don't have to watch the terminal.

CDD is a great fit for **modular, data-driven projects** — REST APIs, SaaS platforms, admin panels, multi-tenant apps, or anything where you want clean boundaries between the parts of your system.

## Requirements

- [Node.js](https://nodejs.org/) v16.7.0 or later
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## Installation

### From a Local Directory

If you have the CDD source checked out or unzipped locally, run the installer directly with Node:

```bash
node path/to/contract-driven-dev/bin/install.js
```

For example, if you cloned the repo to `~/projects/contract-driven-dev`:

```bash
node ~/projects/contract-driven-dev/bin/install.js
```

This installs globally to `~/.claude/` by default. Add `--local` to install into the current project instead:

```bash
node ~/projects/contract-driven-dev/bin/install.js --local
```

### From a Git ZIP Download

1. Download and extract the repository ZIP
2. Open a terminal and navigate to the extracted folder
3. Run the installer:

```bash
node bin/install.js
```

No dependency installation is needed — the installer has zero dependencies beyond Node.js itself.

### Global vs Local

- **Global** (default) — installs to `~/.claude/`, making `/cdd:*` commands available in every Claude Code session
- **Local** (`--local`) — installs to `./.claude/` in your current working directory, scoped to that project only. Local installs take precedence over global installs when both exist.

### Non-Interactive Install

Skip the confirmation prompt (useful for CI or scripting):

```bash
node bin/install.js --yes
```

### Custom Config Directory

If your Claude Code config lives somewhere other than `~/.claude/`, set the `CLAUDE_CONFIG_DIR` environment variable:

```bash
CLAUDE_CONFIG_DIR=~/my-claude-config node bin/install.js
```

## Permission Mode

CDD relies on hooks and automated file operations that trigger frequent permission prompts in Claude Code's default mode. For smooth functionality, run Claude Code with permissions bypassed:

```bash
claude --dangerously-skip-permissions
```

Without this flag, you'll be interrupted by approval prompts on nearly every CDD command as hooks read/write state files, update the status line, and manage session data. The flag allows all of these operations to proceed without manual confirmation.

## Updating

Run the installer again to update to a newer version. Download or pull the latest source and run:

```bash
node path/to/contract-driven-dev/bin/install.js
```

The installer will:

- Detect your existing installation and show the current version
- Warn you if you've modified any installed files since the last install
- Remove leftover files from previous versions that no longer exist
- Prompt for confirmation before overwriting

To update without prompts, add `--yes`.

## Uninstalling

### Remove Global Install

```bash
node path/to/contract-driven-dev/bin/install.js --uninstall
```

### Remove Local Install

```bash
node path/to/contract-driven-dev/bin/install.js --uninstall --local
```

The uninstaller only removes CDD's own files. Project data stored in `.cdd/` directories is never touched.

## Installer CLI Reference

```
node bin/install.js [options]
```

| Flag          | Short | Description                                  |
| ------------- | ----- | -------------------------------------------- |
| `--global`    | `-g`  | Install to `~/.claude/` (default)            |
| `--local`     | `-l`  | Install to `./.claude/` in current directory |
| `--uninstall` | `-u`  | Remove CDD files from target directory       |
| `--yes`       | `-y`  | Skip confirmation prompts                    |
| `--help`      | `-h`  | Show help message                            |

## Installed File Structure

After installation, the following is added to your Claude Code config directory:

```
~/.claude/
  commands/cdd/       # 20 slash command files
  cdd/
    templates/        # YAML/Markdown project templates
    workflows/        # Step-by-step procedure documents
    hooks/            # Claude Code hook scripts (session, statusline, scope guard)
    notifiers/        # Pluggable notification adapters (webhook, Telegram)
    VERSION           # Installed version tracker
    cdd-manifest.json # File manifest for change detection
```

The installer also registers hooks in your `settings.json` for session start detection, a status line, module scope warnings, and stop notifications.

## Notifications

CDD can send you alerts when a step finishes, needs input, or needs permission — so you don't have to sit and watch. Add a `notifications` section to your project's `.cdd/config.yaml`:

```yaml
notifications:
  enabled: true
  notifiers:
    - type: telegram
      events: [stopped, needs_input]
```

Built-in options:

- **Webhook** — posts JSON to any URL (works with Slack, Discord, Zapier, n8n, etc.)
- **Telegram** — sends messages straight to a Telegram chat via a bot
- **Custom** — runs any command that reads JSON from stdin (write your own in any language)

Notifications are off by default and entirely optional. See [Hooks & Notifications](docs/notifications.md) for full setup details.

---

## Usage

CDD works as a **step-by-step workflow**. You move through four phases in order, and each phase's commands build on the outputs of the one before it. Every command is a Claude Code slash command — type it directly in your Claude Code session.

**Important workflow rule:** After each command finishes, CDD recommends you run `/clear` to reset the conversation context before running the next command. State persists in `.cdd/` files, not in chat history. This is what keeps the context window from filling up.

### Phase 1: Planning

Planning commands run one after another. Each one produces a document that feeds into the next.

#### `/cdd:init` — Set up a new project

Bootstraps CDD for your project. Creates the `.cdd/` directory with configuration and state files.

```
/cdd:init
```

Claude will ask about your tech stack (language, framework, database), project paths, and which foundation layers you need. The result is:

- `.cdd/config.yaml` — project configuration
- `.cdd/state.yaml` — phase and progress tracking
- `.cdd/contracts/` — directory for contract files
- `.cdd/sessions/` — directory for session handoffs

#### `/cdd:brief` — Capture your project vision

A guided conversation where you describe what you want to build. Claude asks questions about users, features, data, and scope, then produces a vision document. How you talk to the brief matters — see the [Annotated ccd:brief Example](docs/brief-interaction-guide.md) for a full walkthrough and the [ccd:brief Cheat Sheet](docs/brief-cheat-sheet.md) for a quick reference on what to say, what to avoid, and how to handle future plans without bloating your project.

```
/cdd:brief
```

**Produces:** `.cdd/contracts/BRIEF.md`

#### `/cdd:plan` — Turn the brief into requirements

Reads your brief and generates clear, numbered requirements grouped by area. Each requirement is specific enough to check and trace back to a module.

```
/cdd:plan
```

**Reads:** `BRIEF.md` | **Produces:** `.cdd/contracts/REQUIREMENTS.md`

#### `/cdd:modularize` — Break the system into modules

Looks at the requirements and identifies separate modules with their dependencies, context budgets, and build order. Makes sure no modules depend on each other in circles.

```
/cdd:modularize
```

**Reads:** `REQUIREMENTS.md` | **Produces:** `.cdd/contracts/MODULES.md`

#### `/cdd:contract` — Generate interface contracts

The big step. Generates all contract files: system-wide rules, per-module contracts (inputs, outputs, data access, events), data schema contracts, and an events registry. After this command, **all contracts are locked**.

```
/cdd:contract
```

**Reads:** `MODULES.md`, `REQUIREMENTS.md` | **Produces:**

- `.cdd/contracts/system-invariants.yaml` — rules that apply everywhere
- `.cdd/contracts/modules/[module-name].yaml` (one per module)
- `.cdd/contracts/data/[schema-name].yaml` (one per data area)
- `.cdd/contracts/events-registry.yaml`
- `.cdd/contracts/CHANGE-LOG.md`

### Phase 2: Foundation

Foundation commands build shared infrastructure that modules depend on. Run these before building any modules.

#### `/cdd:foundation [type]` — Build an infrastructure layer

Builds one foundation layer at a time. Available types depend on what you configured during `/cdd:init`:

```
/cdd:foundation db          # Database migrations, connection pooling, query helpers
/cdd:foundation auth        # Authentication middleware, session management
/cdd:foundation tenant      # Multi-tenancy isolation (if applicable)
/cdd:foundation middleware  # Request pipeline (logging, error handling, validation)
/cdd:foundation shared      # Shared utilities and services
/cdd:foundation verify      # Verify all foundations work together
```

Run `verify` last — it confirms all foundation layers work together correctly and moves you to the build phase.

### Phase 3: Build Cycle

Build commands repeat for each module. The order follows dependencies — you can only build a module once everything it depends on is done.

#### `/cdd:build [module]` — Build a module

Loads the module's contract and all dependency interfaces (never their source code — only what they expose). Builds the module to match its contract within a single session.

```
/cdd:build user-management
```

At session end, creates a handoff file in `.cdd/sessions/` so the next session can pick up where you left off if needed.

**What gets loaded:** The build command loads only what's needed — the module contract, data contracts for tables this module owns or reads, dependency `provides` sections, and system-wide rules (including design guidelines) — staying within the 40% context budget.

#### `/cdd:verify [module]` — Check contract compliance

Runs a 5-point check against the module's contract:

1. **Inputs** — Does it accept everything the contract's `requires` section says it should?
2. **Outputs** — Does it expose everything listed in `provides.functions`?
3. **Dependencies** — Does it only import from declared dependencies?
4. **Events** — Does it only emit and handle its contracted events?
5. **Data access** — Does it only write to tables it owns? Are all reads declared?

```
/cdd:verify user-management
```

#### `/cdd:test [module]` — Run tests and mark complete

Generates and/or runs tests based on the module's contract. Tests check the contract's expected behavior, not how the code works internally. When all tests pass, the module is automatically marked complete and you see which modules are now unblocked.

```
/cdd:test user-management
```

### Phase 4: Wrap-Up & Fixes

#### `/cdd:audit` — Full system check

Once all modules are complete, runs a full check across four areas:

1. **Global rules** — Are all system-wide rules being followed?
2. **Data access** — Do all data reads and writes match what the contracts allow?
3. **Module contracts** — Does every module do what its contract says?
4. **Events** — Are all events properly sent and received?

```
/cdd:audit
```

#### `/cdd:change-request [changes]` — Sort changes into per-module files

When you have changes to make — bug fixes, UI tweaks, feature modifications, element removals — this command groups them into per-module YAML change files. Describe what you want changed; the command figures out which modules are affected. No code reading, no changes applied — just organized grouping by module and severity, written to `.cdd/changes/pending/`.

Run it with changes inline, or run it bare to be prompted interactively:

```
/cdd:change-request
```

Or with changes provided directly:

```
/cdd:change-request
In module Sales, move the "Buy" button to the bottom of the Order Screen and rename it "Purchase"
In module Users, remove the Password column from the grid
Auth module has a loose != comparison on line 45 that should be strict
```

The command outputs a **run sheet** — a list of `/cdd:change`, `/cdd:verify`, and `/cdd:test` commands to run with `/clear` between each.

#### `/cdd:change [change-file]` — Process one module's changes

Loads ONE change file, researches each item against the module's code and contracts, gives a verdict, and applies changes where possible. Verdicts:

- **ACTIONABLE** — can be done within current contracts; change is applied
- **NO_CHANGE_NEEDED** — already works as described or change would have no effect
- **CONTRACT_CHANGE_REQUIRED** — needs a contract modification first (includes which clause, why, and the exact `/cdd:contract-change` command to run)
- **DEFERRED** — too broad or risky for this session

```
/cdd:change users-CHG-20260216-1400
```

After processing, the change file moves to `.cdd/changes/completed/` with verdicts and change records, and the module's `verified` and `tested` flags are reset so it goes through verify and test again.

### Post-Build Additions

When your project grows beyond the original plan, these two commands add new modules without breaking existing contracts.

#### `/cdd:add-module` — Scope new modules

A guided conversation (like a mini `brief` + `plan` + `modularize`) that captures what you want to add, breaks it into modules if needed, generates requirements, and produces an addition file. Run this once per batch of related features.

```
/cdd:add-module
```

**Produces:** `.cdd/additions/[slug].md`, appends to `REQUIREMENTS.md` and `MODULES.md`, updates `state.yaml`

#### `/cdd:add-contract [module]` — Generate contract for an added module

Generates the locked interface contract for one added module. Loads the addition file and dependency contracts, runs cross-reference checks, and logs the change. Run once per module with `/clear` between each.

```
/cdd:add-contract slack-notifications
```

**Produces:** `.cdd/contracts/modules/[module-name].yaml`, updates `events-registry.yaml` and data contracts, logs to `CHANGE-LOG.md`

After all contracts are generated, the normal `build → verify → test` cycle handles the rest.

### Utility Commands (Available Anytime)

These commands work in any phase:

#### `/cdd:status` — Show project progress

Read-only overview of your project: current phase, module completion status, context budgets, and any contract changes.

```
/cdd:status
```

#### `/cdd:resume` — Pick up from a previous session

When you return to a project after closing Claude Code, this command reads the latest session handoff file and rebuilds context. No chat history needed.

```
/cdd:resume
```

#### `/cdd:context [module]` — Preview a module

Loads and displays a module's contract, dependencies, and data access in a readable format — without starting a build. Useful for understanding what a module does before deciding to build it.

```
/cdd:context notifications
```

#### `/cdd:reset [module]` — Abandon a partial build

If a module build goes wrong, reset it back to `pending`. Logs the attempt and clears in-progress state so you can start fresh.

```
/cdd:reset notifications
```

#### `/cdd:contract-change` — Modify a locked contract

Contracts lock after `/cdd:contract`. If you need to change one, this command walks you through a strict 5-step process:

1. Identify what's changing and why
2. Check the impact on all affected modules
3. Generate the contract diff
4. Apply changes with a clear record
5. Log the change in `CHANGE-LOG.md`

This is meant to be hard — changing a contract means something was missed in planning, and it can cause extra work across other modules.

```
/cdd:contract-change
```

#### `/cdd:help` — Command reference

Displays the full command list with descriptions and current project status.

```
/cdd:help
```

---

## Project Data Structure

Each CDD-managed project gets a `.cdd/` directory at its root:

```
your-project/
  .cdd/
    config.yaml                  # Tech stack, paths, foundation config
    state.yaml                   # Current phase, module progress, session tracking
    sessions/                    # Session handoff files
      [session-id].yaml          # What was done, what's next, decisions made
    contracts/
      BRIEF.md                   # Project vision (from /cdd:brief)
      REQUIREMENTS.md            # Requirements list (from /cdd:plan)
      MODULES.md                 # Module breakdown (from /cdd:modularize)
      system-invariants.yaml     # System-wide rules (from /cdd:contract)
      events-registry.yaml       # Event routing map (from /cdd:contract)
      CHANGE-LOG.md              # Contract change history
      modules/
        [module-name].yaml       # Per-module contract: requires, provides, data access
      data/
        [schema-name].yaml       # Data schema: tables, columns, constraints, owners
    changes/                     # Change tracking (from /cdd:change-request + /cdd:change)
      pending/                 # Change files awaiting processing
        [module]-CHG-[timestamp].yaml
      completed/               # Processed change results with verdicts
        [module]-CHG-[timestamp].yaml
    additions/                   # Post-build module additions (from /cdd:add-module)
      [slug].md                  # Addition scoping file
```

---

## Cheat Sheet

### Workflow at a Glance

```
PLAN                        init → brief → plan → modularize → contract
FOUNDATION                  foundation db → auth → middleware → shared → verify
BUILD CYCLE (per module)    build → verify → test
WRAP-UP                     audit

CHANGE (if changes needed)  change-request → change → verify → test   (per module)
ADD (post-build)            add-module → add-contract → build → verify → test   (per module)
```

### Command Quick Reference

| Command                      | Phase      | What It Does                                                               |
| ---------------------------- | ---------- | -------------------------------------------------------------------------- |
| `/cdd:init`                  | Planning   | Create `.cdd/` directory and configure project                             |
| `/cdd:brief`                 | Planning   | Guided conversation, produces `BRIEF.md`                                   |
| `/cdd:plan`                  | Planning   | Brief → numbered requirements (`REQUIREMENTS.md`)                          |
| `/cdd:modularize`            | Planning   | Requirements → modules with dependencies (`MODULES.md`)                    |
| `/cdd:contract`              | Planning   | Generate and lock all interface contracts                                  |
| `/cdd:foundation [type]`     | Foundation | Build infrastructure: `db`, `auth`, `tenant`, `middleware`, `shared`, `verify` |
| `/cdd:build [module]`        | Building   | Build a module from its contract                                           |
| `/cdd:verify [module]`       | Building   | Check code against contract (5 points)                                     |
| `/cdd:test [module]`         | Building   | Run tests, mark complete, show what's unblocked                            |
| `/cdd:audit`                 | Wrap-Up    | Full system check (4 areas)                                                |
| `/cdd:change-request [changes]` | Changes | Sort changes into per-module change files                                |
| `/cdd:change [change-file]`     | Changes | Process one module's changes (research, verdict, apply)                  |
| `/cdd:add-module`            | Post-Build | Scope new modules for a built system (guided)                              |
| `/cdd:add-contract [module]` | Post-Build | Generate locked contract for an added module                               |
| `/cdd:status`                | Any        | Show phase, progress, and budgets                                          |
| `/cdd:resume`                | Any        | Pick up from session handoff file                                          |
| `/cdd:context [module]`      | Any        | Preview module contract without building                                   |
| `/cdd:reset [module]`        | Any        | Abandon partial build, return to pending                                   |
| `/cdd:contract-change`       | Any        | Modify a locked contract (strict process)                                  |
| `/cdd:help`                  | Any        | Show command reference                                                     |

### Typical Session Flow

```
Session 1:  /cdd:init        → answer setup questions       → /clear
Session 2:  /cdd:brief       → describe your project        → /clear
Session 3:  /cdd:plan        → review requirements          → /clear
Session 4:  /cdd:modularize  → review module breakdown      → /clear
Session 5:  /cdd:contract    → review generated contracts    → /clear
Session 6:  /cdd:foundation db         → build database     → /clear
Session 7:  /cdd:foundation auth       → build auth         → /clear
Session 8:  /cdd:foundation middleware → build middleware    → /clear
Session 9:  /cdd:foundation shared     → build shared       → /clear
Session 10: /cdd:foundation verify     → confirm it works   → /clear
Session 11: /cdd:build users      → build module            → /clear
Session 12: /cdd:verify users     → check contract          → /clear
Session 13: /cdd:test users       → run tests, mark complete → /clear
            ... repeat build cycle for each module ...
Final:      /cdd:audit            → full system check               → /clear

            ... if issues found ...
            /cdd:change-request   → sort changes into change files  → /clear
            /cdd:change [file]    → process one module's changes    → /clear
            /cdd:verify [module]  → re-verify                       → /clear
            /cdd:test [module]    → re-test, re-mark complete       → /clear
            ... repeat fix/verify/test for each module ...

            ... if adding new features later ...
            /cdd:add-module       → scope new modules                → /clear
            /cdd:add-contract [m] → generate contract for module     → /clear
            ... repeat add-contract for each new module ...
            /cdd:build [module]   → build new module                 → /clear
            /cdd:verify [module]  → verify new module                → /clear
            /cdd:test [module]    → test new module                  → /clear
```

### Key Rules

- **Always `/clear` between commands** — state lives in files, not chat history
- **One command per session** — each works in a bounded context
- **Contracts lock after `/cdd:contract`** — changes require `/cdd:contract-change`
- **Build order follows dependencies** — `/cdd:test` tells you what's unblocked when tests pass
- **Load interfaces, not code** — when module B depends on A, only A's `provides` section is loaded
- **Every table has one owner (or is public)** — writes are strictly enforced through ownership; reads are contracted to public columns and use framework-native patterns

### Git Checkpoints (Rollback)

CDD automatically creates a git checkpoint commit before any code-modifying operation (`/cdd:build`, `/cdd:change`, `/cdd:foundation`, `/cdd:contract-change`). If something goes wrong, you can undo everything back to the pre-command state:

```bash
git reset --hard <checkpoint-hash>
```

Checkpoint commits use structured messages (`cdd(checkpoint): before build auth`) so they're easy to find in `git log`. If your project isn't a git repo, CDD warns you and continues — checkpoints are automatic when git is available, silent when it isn't.

## License

MIT
