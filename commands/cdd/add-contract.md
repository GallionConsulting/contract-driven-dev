---
name: cdd:add-contract
description: Generate a locked contract for an added module
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Generate the locked interface contract for ONE added module. Loads the addition file and dependency contracts, generates a module contract YAML, creates or updates data contracts, wires events, runs cross-reference verification, and logs the change. This is the contract generation "back half" — run once per module from `/cdd:add-module`, with `/clear` between each.
</objective>

<execution_context>
You are running the `cdd:add-contract` command. This generates ONE module contract per session.

**Model check — Opus recommended:**
Check your model from the system prompt. If you are NOT an Opus model, STOP and tell the user:
> ⚠️ This command works best on **Opus** but you're running **{your-model-name}**. Run `/model` to switch before proceeding, or type "continue" to proceed anyway.
Do not continue until the user responds.

**Argument:** The module name to generate a contract for. If no argument is provided, show pending contracts and suggest the next one.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Verify `phase` is `build_cycle`
4. Verify `planning.contract.locked: true`
5. Verify the module `[name]` exists in `state.yaml` with `status: pending`
6. Verify a `module_additions` entry contains this module with `contract_generated: false`
7. If a contract already exists at `.cdd/contracts/modules/[name].yaml`, tell the user the contract already exists. Suggest `/cdd:build [name]`. Stop.
8. If no `module_additions` entry contains this module, tell the user to run `/cdd:add-module` first. Stop.

**If called with no module name**, display which modules need contracts:
```
═══════════════════════════════════════════════════════════════
PENDING CONTRACTS
═══════════════════════════════════════════════════════════════
From addition: [slug]

  [icon] [module-name-1] — contract not yet generated
  [icon] [module-name-2] — contract generated [YYYY-MM-DD]

───────────────────────────────────────────────────────────────
Run: /cdd:add-contract [module-name-1]
═══════════════════════════════════════════════════════════════
```
Then stop.

**Context loaded (MODERATE):**
- `.cdd/state.yaml` — full file (phase check, module statuses, addition tracking)
- `.cdd/config.yaml` — full file (stack info)
- `.cdd/additions/[slug].md` — full file (module scoping, dependencies)
- `.cdd/contracts/system-invariants.yaml` — full file (new module must comply)
- Dependency `.cdd/contracts/modules/*.yaml` — `provides` and `data_ownership` sections ONLY (interface matching, dependency verification)
- Relevant `.cdd/contracts/data/*.yaml` — tables referenced by the new module (column visibility, ownership)
- `.cdd/contracts/events-registry.yaml` — full file (event wiring)

**Key context rule:** Only contracts listed in the new module's `Dependencies (existing)` and `Dependencies (new)` from the addition file are loaded. This keeps context bounded regardless of total project size.

**Context NOT loaded:**
- REQUIREMENTS.md, MODULES.md, BRIEF.md
- Source code, session files
- Non-dependency module contracts
</execution_context>

<process>

## Step 1: Check Pre-conditions

Verify phase, contract lock, module exists in state and `module_additions`.

If any pre-condition fails, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

1. Find the addition file: scan `module_additions` entries in state.yaml for the one containing the target module. Read `.cdd/additions/[slug].md` and extract the target module's section.
2. Read `.cdd/contracts/system-invariants.yaml`
3. Read `.cdd/contracts/events-registry.yaml`
4. For each module listed in the target module's `Dependencies (existing)` and `Dependencies (new)`:
   - Read `.cdd/contracts/modules/[dep].yaml` — extract ONLY the `provides` and `data_ownership` sections
5. For each table referenced by the new module (from the addition file's `Reads from`, `Owns data`):
   - Read the relevant `.cdd/contracts/data/*.yaml` files

## Step 3: Generate Module Contract

Create `.cdd/contracts/modules/[module-name].yaml` using the exact structure from the contract workflow (`contract.md` Step 4).

**Structure** (identical to standard module contracts):
```yaml
# Module Contract: [Module Name]
# DO NOT modify without cdd:contract-change
# Added: [YYYY-MM-DD] via cdd:add-contract

module: "[module-name]"
version: "1.0"
locked: true
description: "[from addition file]"

blocked_by: [...]
context_estimate: { ... }
requires: { from_middleware, from_url_params, from_modules, from_shared }
provides: { functions, events_emitted, events_consumed, endpoints }
data_ownership: { owns, reads, writes }
```

**Critical rules** (same as `cdd:contract`):
- Every `requires.from_modules` entry MUST match a `provides.functions` entry in the referenced module
- `blocked_by` lists every dependency module
- Data ownership follows standard/public table rules
- Column reads from non-owned tables must reference `public: true` columns
- Context estimates follow `cdd:modularize` budgeting rules
- Empty sections use `[]` not omission

## Step 4: Generate/Update Data Contracts

**For NEW tables** owned by the new module:
- If the tables fit an existing data contract domain, append to that file
- If they represent a new domain, create `.cdd/contracts/data/[schema-name].yaml`
- Follow contract workflow Step 5 structure exactly
- Apply system invariant rules (audit columns, PK format, etc.)

**For READS from existing tables:**
- Verify columns are `public: true` in the data contract
- Add new module to `consumer_modules` (additive, non-breaking)
- If needed columns are NOT public, flag as requiring `cdd:contract-change` — do NOT auto-promote

**For WRITES to public tables:**
- Verify table is `public_table: true`
- Add new module to `writers` array

## Step 5: Update Events Registry

**For events the new module EMITS:**
- Append new entries to `.cdd/contracts/events-registry.yaml`
- Consumers can be empty initially

**For events the new module CONSUMES:**
- Add new module as consumer in existing event entries (additive, non-breaking)

## Step 6: Cross-Reference Verification

Run the same checks as `cdd:contract` Step 7, scoped to the new module:

- **Interface consistency:** Every `requires.from_modules` matches a `provides.functions` in the referenced module
- **Data consistency:** Every owned table in a data contract with matching `owner_module`; every read table exists and columns are public
- **Event consistency:** Every emitted event in the registry; every consumed event has an emitter
- **Budget verification:** Module fits within context ceiling
- **No circular dependencies:** Adding this module doesn't create cycles
- **Public column consistency:** Read columns match `public: true` in data contracts

Fix inconsistencies before presenting.

## Step 7: Impact Summary

Present the contract to the user for approval:

```
═══════════════════════════════════════════════════════════════
CONTRACT: [module-name]
═══════════════════════════════════════════════════════════════

DESCRIPTION
  [one-line description]

DEPENDENCIES
  Depends on: [list of existing modules, or "none"]
  Blocked by: [list — includes existing + other new modules]

INTERFACE
  Provides: [count] functions, [count] endpoints, [count] events
  Requires: [count] functions from [count] modules

NEW FILES
  .cdd/contracts/modules/[module-name].yaml
  [.cdd/contracts/data/[schema-name].yaml — if new data domain]

MODIFIED FILES (additive only)
  [.cdd/contracts/data/[schema].yaml — consumer_modules/writers updated]
  [.cdd/contracts/events-registry.yaml — events/consumers added]

DATA ACCESS
  Owns tables: [list, or "none"]
  Reads from: [table (owner) — columns: [list], ...]
  Writes to: [public tables, if any]

CONTEXT BUDGET
  Estimated: [N]k tokens (ceiling: [M]k)

[If contract changes needed:]
  REQUIRES SEPARATE CONTRACT CHANGES:
  - [description]
  Run /cdd:contract-change for each before building.

FOUNDATION NEEDS (auto-created during /cdd:build)
  [If new tables in data_ownership.owns:]
  New tables requiring migrations:
    - [table-name] ([column count] columns)
  [If requires.from_shared references services/methods that don't exist yet:]
  New shared services:
    - [ServiceName].[method]()
  [If neither:]
  None — all foundations already exist.

  Note: These will be created automatically during /cdd:build
  via the foundation catch-up step. No manual action needed.

───────────────────────────────────────────────────────────────
Cross-reference check: [PASSED / issues]
═══════════════════════════════════════════════════════════════
```

Ask the user to **APPROVE** or **CANCEL**.

## Step 7.5: Git Checkpoint (on APPROVE)

Create a safety checkpoint before modifying any files:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js add-contract [module-name]
```

Parse the JSON output:
- If `created: true` — display checkpoint notice
- If `created: false` and `message: "not_git_repo"` — display warning: "⚠ Not a git repo — no checkpoint created. Changes cannot be rolled back. Consider running `git init` first." Then **ask the user** if they want to continue without rollback capability or abort. If user aborts, stop immediately with no changes.
- If `created: false` and `message: "no_changes"` — silent, continue
- If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue without a checkpoint or abort.

When checkpoint is created, display:
```
───────────────────────────────────────────────────────────────
CHECKPOINT: [hash]
  To undo this contract addition: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

## Step 8: Apply Changes (on APPROVE)

Write all files:

1. Create `.cdd/contracts/modules/[module-name].yaml`
2. Create or update data contracts in `.cdd/contracts/data/`
3. Update `.cdd/contracts/events-registry.yaml`
4. Append to `.cdd/contracts/CHANGE-LOG.md`:

```markdown
## Module Addition: [module-name] — [YYYY-MM-DD]
- **Type:** New module contract generated
- **Addition:** [slug] ([N] of [total] modules in this addition)
- **Module:** [module-name]
- **Description:** [one-line description]
- **Dependencies:** [list or "none"]
- **New tables:** [list or "none"]
- **New events:** [list or "none"]
- **Additive data contract changes:** [consumer_modules/writers updates, or "None"]
- **Requires contract-change:** [list of issues, or "None"]
```

5. Update `.cdd/state.yaml` — set `contract_generated: true` for this module in the `module_additions` entry (module status remains `pending` until built)

## Step 9: Cancel Path (on CANCEL)

Make NO changes. Display alternatives:
```
═══════════════════════════════════════════════════════════════
CANCELLED — No changes made.

───────────────────────────────────────────────────────────────
Alternatives:
  - Revise the module scope in .cdd/additions/[slug].md
    and try again
  - Use /cdd:contract-change if the issue is with existing
    module contracts
  - Run /cdd:status to see project state
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

## Step 10: Session Footer (on APPROVE)

```
═══════════════════════════════════════════════════════════════
CDD:ADD-CONTRACT — [module-name]

Contract: .cdd/contracts/modules/[module-name].yaml
Change logged: .cdd/contracts/CHANGE-LOG.md
Version: 1.0, locked: true

[If this is the last module in the addition:]
All [N] modules from this addition now have contracts.

[If more modules remain:]
Remaining modules without contracts:
  [module-name-2] — run /cdd:add-contract [module-name-2]

[If contract changes needed:]
  Contract changes required before building:
   - [issue]
   Run /cdd:contract-change for each.

───────────────────────────────────────────────────────────────
Next steps:
   1. Run /clear to reset your context window

   [If more modules need contracts:]
   2. Run /cdd:add-contract [next-module-name]

   [If all contracts done, no contract-changes needed:]
   2. Run /cdd:build [module-name]
      (or the first module in the addition's build order)

   [If contract-changes needed:]
   2. Run /cdd:contract-change for flagged issues
   3. Run /clear
   4. Run /cdd:build [module-name]

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
