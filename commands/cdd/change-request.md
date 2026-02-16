---
name: cdd:change-request
description: Sort changes into per-module change files for focused processing
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
---

<objective>
Parse change requests (from audit findings, code reviews, manual inspection, or feature tweaks) into structured YAML change files grouped by module. This is the lightweight triage step — no code reading, no changes applied, no context pressure. Each change file feeds into a separate `/cdd:change` session for focused per-module processing.
</objective>

<execution_context>
You are running the `cdd:change-request` command. This is a LIGHTWEIGHT TRIAGE command that writes structured change files.

**Argument:** The user may provide a list of changes inline with the command. Accepted formats:
- Markdown table with columns for module, change description, severity, and/or category
- Numbered list (e.g., `1. module-name: description`)
- Bullet list (e.g., `- module-name: description`)
- Plain text paragraphs describing changes (will be parsed best-effort)

If no changes are provided, enter interactive mode — ask the user to describe their changes. Accept the same formats listed above. Continue to Step 2 once you have their response.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase` is `build_cycle` or `complete` — if in `planning` or `foundation`, tell the user that changes require at least one completed module. Stop.
3. Verify at least ONE module has `status: complete` — if no modules are complete, tell the user to complete a module first with `/cdd:build`. Stop.

**Context loaded (LIGHTWEIGHT):**
- `.cdd/state.yaml` — for module names, statuses, and build_order
- `.cdd/config.yaml` — for project name only

**Context NOT loaded:**
- Module contracts
- Source code files
- Data contracts
- System invariants
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify:
- `phase` is `build_cycle` or `complete`
- At least one module has `status: complete`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Parse Changes

Parse the user-provided change list into structured entries. Extract for each change:
- **Module name** — which module is affected
- **Description** — what the change is
- **Severity** — critical / high / medium / low (default to `medium` if not specified)
- **Category** — bug / ui / enhancement / removal / performance / security / contract / style / portability (inferred from description if not specified — see inference rules below)

Assign sequential IDs: `CHG-1`, `CHG-2`, `CHG-3`, etc.

**Category inference (when not explicitly specified):**
Use best-effort inference from the description text. Check in this order:
- Bug-indicating words ("broken", "crash", "error", "wrong", "incorrect", "fails", "not working") → `bug`
- Movement/visual words ("move", "rename", "reposition", "restyle", "relabel", "reorder") → `ui`
- Removal words ("remove", "delete", "hide", "drop", "get rid of") → `removal`
- Addition words ("add", "include", "support", "enable", "introduce") → `enhancement`
- Performance words ("slow", "optimize", "cache", "batch", "performance") → `performance`
- Security words ("vulnerability", "injection", "auth", "sanitize", "XSS") → `security`
- Fall back to `bug` only if inference produces no match

**Module resolution:**
- Match module names against modules listed in `state.yaml`
- Accept partial matches, case-insensitive (e.g., "grid" matches "grid-ui")
- If a module name cannot be resolved, collect it as an unresolved change

**If ANY changes have unresolved modules**, display them and stop:
```
CDD:CHANGE-REQUEST — UNRESOLVED MODULES

The following changes reference modules that don't exist in state.yaml:

  CHG-[N]: "[description]" — module "[name]" not found

Available modules:
  - [list of modules from state.yaml]

Please correct the module names and re-run /cdd:change-request.
```

## Step 3: Handle Cross-Module Changes

If a change spans multiple modules (e.g., "inconsistent response building in Auth and Team Membership"):
- Split into separate changes per module: CHG-9a (auth), CHG-9b (team-membership)
- Each gets the same description with a note that it's part of a cross-module change

## Step 4: Handle System-Level Changes

Changes targeting "system-level" or referencing system invariants/config (not a specific module):
- Route to the most relevant module based on the change description
- Or flag as `contract` category if it's purely a contract/invariant labeling problem

## Step 5: Filter by Module Completion Status

Check each resolved module's `status` in `state.yaml`:
- **`status: complete`** — generate a change file for this module (proceed to Step 6)
- **Any other status** — do NOT generate a change file. Collect these changes as deferred.

This prevents generating change files that `/cdd:change` would reject (change requires `status: complete`).

## Step 6: Group by Module and Generate Change Files

Generate a timestamp for the batch: `CHG-YYYYMMDD-HHMM` (e.g., `CHG-20260215-1030`).

Ensure directories exist: `.cdd/changes/pending/` (create if needed).

Generate one YAML file per **complete** module at `.cdd/changes/pending/[module]-CHG-[timestamp].yaml`:

```yaml
# Change batch for [module]
# Generated by /cdd:change-request

batch_id: "CHG-20260215-1030"
module: task-management
generated_at: "2026-02-15T10:30:00Z"
status: pending

issues:
  - id: CHG-2
    severity: medium
    category: removal
    description: "Remove Password column from Users grid"

  - id: CHG-3
    severity: low
    category: bug
    description: "Loose != comparison risks type-juggling"
```

Issues within each file are ordered by severity: critical > high > medium > low.

## Step 7: Display Run Sheet

```
CDD:CHANGE-REQUEST — [N] changes triaged into [M] change batches

Change files created:

  .cdd/changes/pending/auth-CHG-20260215-1030.yaml           ([N] issues)
  .cdd/changes/pending/task-management-CHG-20260215-1030.yaml ([N] issues)

[If any changes were deferred due to module not complete:]
DEFERRED — module not complete
  CHG-[N]: [module] ([status]) — [description]
  CHG-[N]: [module] ([status]) — [description]

  These changes cannot be processed until their modules are complete.
  Complete the modules first, then re-run /cdd:change-request.

RUN SHEET — execute in order, /clear between each command

  /clear
  /cdd:change auth-CHG-20260215-1030
  /clear
  /cdd:verify auth
  /clear
  /cdd:test auth
  /clear
  /cdd:change task-management-CHG-20260215-1030
  /clear
  /cdd:verify task-management
  /clear
  /cdd:test task-management

Total: [M] change sessions + [M] verify sessions + [M] test sessions
Module order follows build_order from state.yaml.
```

</process>
