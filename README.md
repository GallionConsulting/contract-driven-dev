# Contract-Driven Development (CDD)

![Version](https://img.shields.io/badge/version-2.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A command system for Claude Code that enforces interface contracts across multi-session AI-assisted builds. CDD prevents "project context exhaustion" by breaking work into isolated, contract-governed modules that can each be built in focused sessions.

## Why CDD?

When AI-assisted projects grow beyond a single conversation, they fall apart. Claude loses track of what was decided, modules step on each other's data, and interfaces drift. CDD solves this by:

- **Defining contracts before code** — every module's inputs, outputs, data access, and events are specified upfront
- **Isolating sessions** — each command operates within a bounded context, never exceeding 40% of the context window
- **Structured handoffs** — session files carry decisions and progress forward without relying on chat history
- **Enforcing data ownership** — every database table has exactly one owner module (or is a declared public table with explicit writers). Private columns are internal to the owning module; public columns form a stable API surface for cross-module reads. Writes are strictly enforced through ownership. Public tables allow multi-writer access for shared data systems.

CDD works best for **modular, data-driven systems** — REST APIs, SaaS platforms, admin panels, multi-tenant apps, or any project where clear module boundaries and interface contracts prevent cross-session drift.

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

No `npm install` step is needed — the installer has zero dependencies beyond Node.js itself.

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
- Remove orphaned files from previous versions that no longer exist
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

| Flag | Short | Description |
|------|-------|-------------|
| `--global` | `-g` | Install to `~/.claude/` (default) |
| `--local` | `-l` | Install to `./.claude/` in current directory |
| `--uninstall` | `-u` | Remove CDD files from target directory |
| `--yes` | `-y` | Skip confirmation prompts |
| `--help` | `-h` | Show help message |

## Installed File Structure

After installation, the following is added to your Claude Code config directory:

```
~/.claude/
  commands/cdd/       # 16 slash command files
  cdd/
    templates/        # YAML/Markdown project templates
    workflows/        # Step-by-step procedure documents
    hooks/            # Claude Code hook scripts (session, statusline, scope guard)
    notifiers/        # Pluggable notification adapters (webhook, Telegram)
    VERSION           # Installed version tracker
    cdd-manifest.json # File manifest for change detection
```

The installer also registers hooks in your `settings.json` for session start detection, a status line, module scope warnings, and stop notifications. See [Hooks & Notifications](docs/notifications.md) for details and optional external alert configuration (Telegram, Slack, webhooks).

---

## Usage

CDD operates as a **phased state machine**. You progress through four phases in order, with each phase's commands building on the outputs of the previous phase. Every command is a Claude Code slash command — type it directly in your Claude Code session.

**Critical workflow rule:** After each command completes, CDD recommends you run `/clear` to reset the conversation context before running the next command. State persists in `.cdd/` files, not in chat history. This is what prevents context exhaustion.

### Phase 1: Planning

Planning commands run sequentially. Each one produces a contract document that feeds into the next.

#### `/cdd:init` — Initialize a new project

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

An interactive discovery session where you describe what you want to build. Claude asks structured questions about users, features, data, and scope, then produces a vision document.

```
/cdd:brief
```

**Produces:** `.cdd/contracts/BRIEF.md`

#### `/cdd:plan` — Transform brief into requirements

Reads your brief and generates formal, numbered requirements organized by domain. Each requirement is specific enough to verify and trace to a module.

```
/cdd:plan
```

**Reads:** `BRIEF.md` | **Produces:** `.cdd/contracts/REQUIREMENTS.md`

#### `/cdd:modularize` — Break the system into modules

Analyzes requirements and identifies discrete modules with their dependencies, context budgets, and build order. Validates that dependencies form a DAG (no circular dependencies).

```
/cdd:modularize
```

**Reads:** `REQUIREMENTS.md` | **Produces:** `.cdd/contracts/MODULES.md`

#### `/cdd:contract` — Generate interface contracts

The heavyweight step. Generates all contract files: system invariants, per-module contracts (inputs, outputs, data access, events), data schema contracts, and an events registry. After this command, **all contracts are locked**.

```
/cdd:contract
```

**Reads:** `MODULES.md`, `REQUIREMENTS.md` | **Produces:**
- `.cdd/contracts/system-invariants.yaml`
- `.cdd/contracts/modules/[module-name].yaml` (one per module)
- `.cdd/contracts/data/[schema-name].yaml` (one per data domain)
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

Run `verify` last — it confirms all foundation layers integrate correctly and transitions you to the build cycle.

### Phase 3: Build Cycle

Build commands repeat for each module. The order is governed by dependencies — you can only build a module once everything it depends on is complete.

#### `/cdd:build [module]` — Implement a module

Loads the module's contract and all dependency interfaces (never their source code — only what they `provide`). Implements the module to satisfy its contract within a single session.

```
/cdd:build user-management
```

At session end, creates a handoff file in `.cdd/sessions/` so the next session can pick up where you left off if needed.

**Context loading:** The build command loads only what's needed — the module contract, data contracts for tables this module owns/reads, dependency `provides` sections, and system invariants (including design guidelines) — staying within the 40% context budget.

#### `/cdd:verify [module]` — Verify contract compliance

Runs a 5-dimension check against the module's contract:

1. **Inputs** — Does the implementation accept everything the contract's `requires` section specifies?
2. **Outputs** — Does it expose everything in `provides.functions`?
3. **Dependencies** — Does it only import from declared dependencies?
4. **Events** — Does it emit/handle only its contracted events?
5. **Data access** — Does it only write to tables it owns? Are all reads declared?

```
/cdd:verify user-management
```

#### `/cdd:test [module]` — Run tests and mark complete

Generates and/or runs tests derived from the module's contract. Tests verify the contract's behavioral expectations, not implementation details. When all tests pass, the module is automatically marked complete and you see which modules are now unblocked.

```
/cdd:test user-management
```

### Phase 4: Completion

#### `/cdd:audit` — Full system compliance check

Once all modules are complete, runs a comprehensive 4-dimension audit across the entire system:

1. **System invariants** — Are all global rules enforced?
2. **Data schema compliance** — Do all data access patterns match contracts?
3. **Module contract compliance** — Does every module satisfy its contract?
4. **Event wiring** — Are all events properly emitted and handled?

```
/cdd:audit
```

### Utility Commands (Available Anytime)

These commands work across all phases:

#### `/cdd:status` — Show project progress

Read-only overview of your project: current phase, module completion status, context budgets, and any contract changes.

```
/cdd:status
```

#### `/cdd:resume` — Continue from a previous session

When you return to a project after closing Claude Code, this command reads the latest session handoff file and reconstructs context. No chat history needed.

```
/cdd:resume
```

#### `/cdd:context [module]` — View a module briefing

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

Contracts lock after `/cdd:contract`. If you need to change one, this command enforces a heavyweight 5-step process:

1. Identify what's changing and why
2. Impact analysis across all affected modules
3. Generate the contract diff
4. Apply changes with full traceability
5. Log the change in `CHANGE-LOG.md`

This is intentionally difficult — every contract change represents a planning failure and risks cascading rework.

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
      REQUIREMENTS.md            # Formal requirements (from /cdd:plan)
      MODULES.md                 # Module breakdown (from /cdd:modularize)
      system-invariants.yaml     # Global rules (from /cdd:contract)
      events-registry.yaml       # Event routing map (from /cdd:contract)
      CHANGE-LOG.md              # Contract modification history
      modules/
        [module-name].yaml       # Per-module contract: requires, provides, data access
      data/
        [schema-name].yaml       # Data schema: tables, columns, constraints, owners
```

---

## Cheat Sheet

### Workflow at a Glance

```
PLAN ──────────────────────────────────────────────── FOUNDATION ─── BUILD CYCLE ── DONE
init → brief → plan → modularize → contract    →    foundation  →  build/verify  →  audit
                                                                    test
```

### Command Quick Reference

| Command | Phase | What It Does |
|---------|-------|-------------|
| `/cdd:init` | Planning | Create `.cdd/` directory and configure project |
| `/cdd:brief` | Planning | Interactive discovery, produces `BRIEF.md` |
| `/cdd:plan` | Planning | Brief to formal requirements (`REQUIREMENTS.md`) |
| `/cdd:modularize` | Planning | Requirements to modules with dependencies (`MODULES.md`) |
| `/cdd:contract` | Planning | Generate and lock all interface contracts |
| `/cdd:foundation [type]` | Foundation | Build infrastructure: `db`, `auth`, `tenant`, `middleware`, `shared`, `verify` |
| `/cdd:build [module]` | Build Cycle | Implement a module from its contract |
| `/cdd:verify [module]` | Build Cycle | Check implementation against contract (5 dimensions) |
| `/cdd:test [module]` | Build Cycle | Run tests, mark complete, show what's unblocked |
| `/cdd:audit` | Completion | Full system compliance check (4 dimensions) |
| `/cdd:status` | Any | Show phase, progress, and budgets |
| `/cdd:resume` | Any | Continue from session handoff file |
| `/cdd:context [module]` | Any | View module briefing without building |
| `/cdd:reset [module]` | Any | Abandon partial build, return to pending |
| `/cdd:contract-change` | Any | Modify a locked contract (heavyweight) |
| `/cdd:help` | Any | Show command reference |

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
Session 11: /cdd:build users      → implement module        → /clear
Session 12: /cdd:verify users     → check contract          → /clear
Session 13: /cdd:test users       → run tests, mark complete → /clear
            ... repeat build cycle for each module ...
Final:      /cdd:audit            → full system check
```

### Key Rules

- **Always `/clear` between commands** — state lives in files, not chat history
- **One command per session** — each operates in a bounded context
- **Contracts lock after `/cdd:contract`** — changes require `/cdd:contract-change`
- **Build order follows dependencies** — `/cdd:test` tells you what's unblocked when tests pass
- **Load interfaces, not implementations** — when module B depends on A, only A's `provides` section is loaded
- **Every table has one owner (or is a public table)** — writes are strictly enforced through ownership; reads are contracted to public columns and use framework-native patterns

## License

MIT
