# CDD Build Workflow

This document contains the full module build procedure for `cdd:build`. Follow every step in order.

## Step 1: Parse Argument and Display Status

Check what argument the user provided after `cdd:build`.

**If no argument (or invalid argument):**
Read `.cdd/state.yaml`. Display the module status dashboard:

```
═══════════════════════════════════════════════════════════════
CDD:BUILD — Module Builder

Module Status:
  [For each module in build_order:]
    [module-name] — [status] [blocked_by status if pending]

Build order: [build_order list]
Parallel groups: [parallel_groups list]

Recommended next: cdd:build [first buildable module]
═══════════════════════════════════════════════════════════════
```

A module is "buildable" if:
- Its status is `pending` or `failed`
- All modules in its `blocked_by` list have `status: complete`

Then stop. Do not proceed without a valid module name.

**If valid argument:** Proceed to Step 2.

## Step 2: Check Global Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify:

1. `phase` is `build_cycle` — if not, say: "Project is not in the build cycle phase. Current phase: [phase]. Run the appropriate command to advance to build_cycle." Stop.
2. The module contract file exists at `.cdd/contracts/modules/[module].yaml` — if not, say: "No contract found for module '[module]'. Check `.cdd/contracts/modules/` for available modules." Stop.

## Step 3: Check Module Pre-conditions

Read the module contract at `.cdd/contracts/modules/[module].yaml`. Then check:

1. **Dependency check:** Read the module's `blocked_by` list. For each dependency module, check its status in `state.yaml`:
   - If ANY dependency has status other than `complete`, list the incomplete dependencies and say: "Module '[module]' is blocked by incomplete dependencies. Complete these first: [list]." Stop.

2. **Status check:** Check `modules.[module].status` in state.yaml:
   - If `in_progress`: say "Module '[module]' has an active build session. Run `cdd:resume` to continue, or `cdd:reset [module]` to start over." Stop.
   - If `complete`: say "Module '[module]' is already complete. Run `cdd:status` to see project progress." Stop.
   - If `pending` or `failed`: proceed.

## Step 4: Load Context (Strictly Limited)

Load ONLY these files — do not read anything else:

1. **Module contract:** `.cdd/contracts/modules/[module].yaml` — read the FULL contract
2. **System invariants:** `.cdd/contracts/system-invariants.yaml` — read in full
3. **Data contracts for this module's tables:** For each table listed in the module's `data_ownership.owns` and `data_ownership.reads`, find the data contract file in `.cdd/contracts/data/*.yaml` that defines that table. Load column definitions as follows:
   - **Owned tables:** Load full column definitions (all columns accessible)
   - **Standard tables in `reads`:** Load ONLY the columns listed in the module's `data_ownership.reads.columns` declaration (these are the public columns the module has contracted to use)
   - **Public tables in `reads`:** Load full column definitions (all columns are public)
   Do NOT read table definitions for tables not in this module's `data_ownership`.
4. **Dependency provides:** For each module listed in `requires.from_modules`, read ONLY the `provides` section of that module's contract at `.cdd/contracts/modules/[dep-name].yaml`. Do NOT read the full contract. Extract only the `provides.functions` entries that this module's contract references.
5. **Shared service interfaces:** For each entry in `requires.from_shared`, note the service name and method — these were built during foundations and should already exist.
6. **Failed session handoff:** If the module status is `failed`, check for the most recent session file for this module in `.cdd/sessions/` and read its `context_for_next_session` and `issues_discovered` fields.
7. **Rebuild recommendation:** Check `.cdd/rebuild-recommendations/` for files matching `[module]-*.md`. If found, read the most recent one (by timestamp in filename). This is guidance from a previous `/cdd:verify-fix` session explaining what went wrong in the prior build and what to do differently. Treat this as high-priority context — the entire point of this rebuild is to address these issues.

## Step 4.5: Foundation Catch-up for Added Modules

Check if this module was added after the initial foundation phase.

**Detection:** Read `module_additions` from `.cdd/state.yaml`. If ANY entry's `modules` list contains this module name → it is an added module. If NOT found in `module_additions` → skip this step entirely and proceed to Step 5.

**If this is an added module, check for missing foundations:**

### Database Tables

First, count the total missing foundations (tables without migrations + missing shared service methods). If 4 or more items are missing, display:
```
⚠ This module needs [N] foundation items (tables + shared services).
  Recommend running /cdd:foundation db and /cdd:foundation shared
  to handle this separately, then re-running /cdd:build [module].
```
Ask the user whether to proceed inline or split. If they choose to split, stop.

For each table in the module contract's `data_ownership.owns`:
1. Glob for existing migration files matching the table name (e.g., `*create_[table]*` in the migrations path from `config.yaml`)
2. If NO migration exists for this table:
   - Using the data contracts and system invariants already loaded in Step 4, generate a migration file following the same patterns as `cdd:foundation db` (Step 4a-Process):
     - Framework-appropriate migration format
     - All columns, types, constraints from the data contract
     - Primary key type from system invariants
     - Audit columns (created_at, updated_at, deleted_at if soft_delete)
     - Indexes and foreign key constraints
   - Run the migration command for the framework

If any migration fails, report the error and stop. Do NOT proceed to implementation with missing tables.

### Shared Services

For each entry in the module contract's `requires.from_shared`:
1. Check if the shared service file already exists (use framework conventions and `config.yaml` paths)
2. If the service exists, check if the specific method exists in it
3. If the service or method is MISSING:
   - Compile the required interface from this module's contract (method name, parameters, return type)
   - If the service file exists but the method is missing → add the method to the existing service
   - If the service file doesn't exist → create it following the same patterns as `cdd:foundation shared` (Step 4e-Process)
   - Register the service if newly created

### Summary

After completing catch-up work, display:

```
───────────────────────────────────────────────────────────────
FOUNDATION CATCH-UP — [module-name]
───────────────────────────────────────────────────────────────
This module was added after initial foundations.

[If tables created:]
  Database migrations created and run:
    - [migration-file] → [table-name]

[If shared services created/updated:]
  Shared services:
    - [ServiceName].[method]() — created
    - [ServiceName].[method]() — added to existing service

[If nothing needed:]
  No foundation catch-up needed — all dependencies already exist.
───────────────────────────────────────────────────────────────
```

Proceed to Step 5.

## Step 5: Pre-flight Briefing

Display a comprehensive briefing. This is NOT cosmetic — it forces internalization of the contract before writing any code.

```
═══════════════════════════════════════════════════════════════
PRE-FLIGHT CHECK — [module-name]
═══════════════════════════════════════════════════════════════

Contract: .cdd/contracts/modules/[module].yaml
Lock status: [locked: true/false]

───────────────────────────────────────────────────────────────
DEPENDENCIES
───────────────────────────────────────────────────────────────
[For each dependency:]
  ✅ [dep-name] — complete, verified

───────────────────────────────────────────────────────────────
REQUIRES (what this module consumes)
───────────────────────────────────────────────────────────────
From middleware:
  - [item]: [type/description]

From modules:
  - [module].[function]([params]) → [return type]

From shared:
  - [service].[method]([params]) → [return type]

From URL params:
  - [param]: [type]

───────────────────────────────────────────────────────────────
PROVIDES (what this module exposes)
───────────────────────────────────────────────────────────────
Functions:
  - [function]([params]) → [return type]
    [brief description]

Events emitted:
  - [event-name]: { [payload shape] }

───────────────────────────────────────────────────────────────
DATA ACCESS
───────────────────────────────────────────────────────────────
Owned tables (full access):
  - [table-name]

Reads (public columns only):
  - [table-name] [[col1], [col2], ...]     (owner: [module])

Reads (public table — all columns):
  - [table-name]                            (writers: [mod1], [mod2])

Writes:
  - [table-name]                            (owned)
  - [table-name]                            (public table)

⚠ You may ONLY write to tables listed under Writes.
  For non-owned reads, you may ONLY access the declared public columns.
  Use framework-native patterns (ORM, query builder) for all reads.

───────────────────────────────────────────────────────────────
DATA SCHEMA (from data contracts)
───────────────────────────────────────────────────────────────
[For owned tables and public tables, show ALL column definitions:]
  [table-name] (owned / public table):
    [column]: [type] [constraints]
    [column]: [type] [constraints]
    ...

[For non-owned standard tables, show ONLY declared public columns:]
  [table-name] (public columns only — owner: [module]):
    [column]: [type] [constraints]    ← public
    [column]: [type] [constraints]    ← public
    (N private columns not shown)

───────────────────────────────────────────────────────────────
CONTEXT BUDGET
───────────────────────────────────────────────────────────────
Estimated ceiling: [from contract if specified, or "standard"]
Files loaded: [count]

[If rebuild recommendation was loaded in Step 4:]
───────────────────────────────────────────────────────────────
⚠️ REBUILD GUIDANCE (from previous verify-fix)
───────────────────────────────────────────────────────────────
[Full text of the rebuild recommendation file]

This module is being rebuilt because the previous build failed
verification. Pay close attention to the guidance above — it
explains what went wrong and how to avoid the same mistakes.
───────────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════
```

After displaying, confirm understanding:
"I've reviewed the contract for [module-name]. The module [brief summary of what it does]. I'll implement it in this order: service layer → data access → routes → events. Shall I proceed?"

Wait for user confirmation before writing any code.

## Step 5.5: Git Checkpoint

Create a safety checkpoint before modifying any files:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js build [module-name]
```

Parse the JSON output:
- If `created: true` — display checkpoint notice, save `hash` for the session file (Step 12)
- If `created: false` and `message: "not_git_repo"` — display warning: "⚠ Not a git repo — no checkpoint created. Changes cannot be rolled back. Consider running `git init` first." Then **ask the user** if they want to continue without rollback capability or abort. If user aborts, stop immediately with no changes.
- If `created: false` and `message: "no_changes"` — silent, continue
- If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue without a checkpoint or abort.

When checkpoint is created, display:
```
───────────────────────────────────────────────────────────────
CHECKPOINT: [hash]
  To undo this build: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

## Step 6: Update State — Start Build

Read `.cdd/state.yaml` and update:

```yaml
modules:
  [module]:
    status: in_progress
    current_session: "build-[module]-[YYYYMMDD-HHMMSS]"
    build_started: "[ISO 8601 timestamp]"
    progress:
      service: pending
      queries: pending
      routes: pending
      events: pending
```

## Step 7: Implementation — Service Layer

Build the service/business logic layer FIRST. This contains the pure functions that match `provides.functions` in the contract.

**Rules:**
- Every function in `provides.functions` MUST be implemented
- Function signatures MUST match the contract exactly (parameter names, types, return types)
- Use dependency functions via the interfaces loaded in Step 4 (from `requires.from_modules`)
- Use shared services via the interfaces loaded in Step 4 (from `requires.from_shared`)
- Respect data ownership — only WRITE to tables listed in `data_ownership.writes` (owned tables and public tables where this module is a declared writer). For non-owned standard table reads, only access the declared public columns. Use framework-native patterns for all reads.
- Follow the framework conventions from `config.yaml`

After completing the service layer, update state:
```yaml
modules:
  [module]:
    progress:
      service: complete
```

## Step 8: Implementation — Data Access Layer

Build queries and data access operations.

**Rules:**
- Only WRITE to tables in `data_ownership.writes` (owned tables and public tables where this module is a declared writer)
- Read from any table declared in `data_ownership.reads` or `data_ownership.owns` using framework-native patterns (ORM relationships, query builder, direct queries)
- Do NOT read from or write to any table not listed in the contract's `data_ownership` at all
- Follow the framework's query/ORM patterns — use idiomatic relationship loading, joins, and eager loading for reads
- If the module needs joins or relationships across modules, verify the joined tables are declared in the module's read list

After completing the data access layer, update state:
```yaml
modules:
  [module]:
    progress:
      queries: complete
```

## Step 9: Implementation — API Routes (if applicable)

Build API routes/controllers if the module contract includes endpoint definitions.

**Rules:**
- Route paths must match the contract
- HTTP methods must match the contract
- Request validation must enforce the contracted input shapes
- Response shapes must match the contracted output shapes
- Apply the correct middleware (auth, tenant, etc.) as specified in `requires.from_middleware`
- Error responses must follow the system invariants' `response_format.error` structure

After completing routes, update state:
```yaml
modules:
  [module]:
    progress:
      routes: complete
```

If the module has no routes, set `routes: skipped`.

## Step 10: Implementation — Event Emissions (if applicable)

Wire up event emissions if the module contract includes `events_emitted`.

**Rules:**
- Every event in `events_emitted` MUST be emitted at the correct point in the code
- Event payload shapes must match the contracted schemas exactly
- Do NOT emit events not listed in the contract
- Use the framework's event system (Laravel events, Node EventEmitter, Django signals, etc.)

After completing events, update state:
```yaml
modules:
  [module]:
    progress:
      events: complete
```

If the module has no events, set `events: skipped`.

## Step 11: Self-Check

Before finishing, perform a quick self-check against the contract:

1. Every `provides.functions` entry has a corresponding implementation
2. Every `requires.from_modules` dependency is actually called
3. Every `events_emitted` event is actually emitted
4. Writes only touch tables in `data_ownership.writes`; reads only touch tables declared in `data_ownership` and respect column visibility (only declared public columns for non-owned standard tables)
5. Route paths and methods match the contract

If any discrepancy is found, fix it now. Do not defer.

## Step 12: Create Session File

Generate a session file at `.cdd/sessions/[session-id].yaml` with the session ID from Step 6.

```yaml
# CDD Session File
session_id: "build-[module]-[YYYYMMDD-HHMMSS]"
module: "[module-name]"
command: build
started_at: "[ISO 8601 timestamp]"
ended_at: "[ISO 8601 timestamp]"
status: complete  # or partial, failed

files_created:
  - path: "[relative path]"
    purpose: "[what this file does]"
    status: complete  # or partial

files_modified:
  - path: "[relative path]"
    changes: "[brief description of changes]"

decisions_made:
  - "[decision description — e.g., 'Used repository pattern for data access']"

issues_discovered:
  - "[any issues found during build — e.g., 'Contract doesn't specify pagination for list endpoint']"

next_steps:
  - "[if partial: what remains to be done]"

context_for_next_session: |
  [MOST IMPORTANT FIELD — Write this as if explaining to a new developer who has
  never seen this module. Include:
  - What the module does (1-2 sentences)
  - What was built and where the files are
  - What design decisions were made and why
  - Any gotchas or non-obvious details
  - What the next person should do (verify, test, or continue building)]

checkpoint:
  hash: "[hash from Step 5.5, or null if no checkpoint]"
  rollback_cmd: "git reset --hard [hash]"  # null if no checkpoint

context_metrics:
  files_read: [count]
  files_written: [count]
  estimated_budget: "[low/medium/high]"
```

## Step 13: Final State Update

Read `.cdd/state.yaml` and update the module's final status:

**If build is complete (all layers done):**
```yaml
modules:
  [module]:
    status: in_progress   # stays in_progress until verified
    build_status: complete
    progress:
      service: complete
      queries: complete
      routes: [complete|skipped]
      events: [complete|skipped]
    session_file: ".cdd/sessions/[session-id].yaml"
```

**If build is partial (session ending before completion):**
```yaml
modules:
  [module]:
    status: in_progress
    build_status: partial
    progress:
      service: [status]
      queries: [status]
      routes: [status]
      events: [status]
    session_file: ".cdd/sessions/[session-id].yaml"
```

## Step 14: Session Footer

Display the appropriate footer:

**If build is complete:**
```
═══════════════════════════════════════════════════════════════
✅ BUILD SESSION COMPLETE — [module-name]

   Progress saved to .cdd/sessions/[session-id].yaml
   State updated in .cdd/state.yaml

   Files created: [count]
   Files modified: [count]
   Decisions made: [count]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:verify [module-name] to verify the
      implementation matches the contract

   /clear resets your context window to zero. The session file
   carries everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

**If build is partial:**
```
═══════════════════════════════════════════════════════════════
⏸️ BUILD SESSION PAUSED — [module-name]

   Progress saved to .cdd/sessions/[session-id].yaml
   State updated in .cdd/state.yaml

   Completed: [list of completed layers]
   Remaining: [list of pending layers]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:resume to continue building
      from where you left off

   /clear resets your context window to zero. The session file
   carries everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```
