---
name: cdd:status
description: Show current project status and progress
allowed-tools:
  - Read
  - Glob
---

<objective>
Display a comprehensive, read-only project status dashboard. This is the cheapest command to run — it reads only state.yaml and config.yaml, never modifies anything, and gives the user a complete picture of where their project stands with a recommended next action.
</objective>

<execution_context>
You are running the `cdd:status` command. This is a READ-ONLY command — do NOT modify any files.

**Pre-conditions — check these FIRST:**
1. Check if `.cdd/state.yaml` exists — if not, say "No CDD project found. Run `/cdd:init` to get started." and stop.
2. Read `.cdd/state.yaml`
3. Read `.cdd/config.yaml`

**Context loaded (LIGHTWEIGHT):**
- `.cdd/state.yaml` — full state file
- `.cdd/config.yaml` — project name and settings only
- `.cdd/sessions/` — scan for most recent session file (names only, do not read contents)
- `.cdd/changes/outstanding-contract-changes.yaml` — outstanding contract change tracking (if exists)

**Context NOT loaded:**
- Module contracts
- Source code files
- Full session file contents
</execution_context>

<process>

## Step 1: Read State

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Extract:
- `project_name` from config
- `phase` from state
- All planning step statuses
- All foundation statuses
- All module statuses
- `build_order` and `parallel_groups`
- `contract_changes` count
- Read `.cdd/changes/outstanding-contract-changes.yaml` (if it exists)

## Step 2: Display Status Dashboard

Display the following, populating all fields from the state data:

```
═══════════════════════════════════════════════════════════════
PROJECT STATUS: [project_name]
═══════════════════════════════════════════════════════════════

PHASE: [current phase]

PLANNING:
  [icon] brief ([status])
  [icon] plan ([status])
  [icon] modularize ([status])
  [icon] contract ([status], [locked: yes/no])

FOUNDATIONS:
  [For each foundation entry in state.yaml:]
  [icon] [type] ([status], [verified: yes/no], [stubbed: yes/no if applicable])

  [If no foundations configured:]
  (none configured)

MODULES:
  [For each module in build_order:]
  [icon] [name] — [status] [build_status if in_progress] [verified/tested flags]

  [If no modules defined:]
  (not yet modularized)

PROGRESS: [completed_count]/[total_count] modules complete
[████████████░░░░░░░░] [percentage]%

CONTRACT CHANGES: [count from contract_changes array length]

[If outstanding-contract-changes.yaml exists and has entries:]
⚠️  OUTSTANDING CONTRACT CHANGES: [N]
  [For each entry:]
  • [module] — [description]
    → [next_step]

[If no outstanding file or empty:]
OUTSTANDING CONTRACT CHANGES: 0

MODULE ADDITIONS: [count from module_additions array length, if > 0]
  [For each addition in module_additions:]
  [slug] — [N] module(s), [M] contracts pending

CURRENT SESSION:
  [If any module has status: in_progress:]
  Module: [name], Session: [current_session], Phase: [build/verify/test based on progress]
  [If no in-progress work:]
  No active session
═══════════════════════════════════════════════════════════════
```

**Status icon legend:**
- `✅` — complete
- `🔨` — in_progress
- `⏳` — pending / ready (dependencies met)
- `🔒` — blocked (dependencies not met)
- `❌` — failed

For modules, determine blocked vs pending:
- If a module's `blocked_by` dependencies are NOT all `complete` in state.yaml, show `🔒` (blocked)
- If dependencies are met and status is `pending`, show `⏳` (ready)

## Step 3: Suggest Next Action

Based on the current state, determine and display the recommended next step:

**If phase is `planning`:**
- Find the first planning step with status not `complete` and suggest it
- e.g., "Run `/cdd:brief` to start capturing your project vision"

**If phase is `foundation`:**
- Find the first foundation not complete and suggest it
- e.g., "Run `/cdd:foundation db` to build the database foundation"

**If phase is `build_cycle`:**
- If any module is `in_progress`: suggest `/cdd:resume`
- If any module is `failed`: suggest `/cdd:build [module]` or `/cdd:reset [module]`
- If any module has `status: complete` but `verified: false` (post-fix state): suggest `/cdd:verify [module]`
- If any module has `status: complete` and `verified: true` but `tested: false` (post-fix, re-verified): suggest `/cdd:test [module]`
- If pending change files exist in `.cdd/changes/pending/`: mention them (e.g., "N pending change file(s) — run `/cdd:change [name]`")
- If any module is buildable (pending + dependencies met): suggest `/cdd:build [module]`
- If any module is built but not verified: suggest `/cdd:verify [module]`
- If any module is verified but not tested: suggest `/cdd:test [module]`
- If all modules are complete and all `tested: true`: suggest `/cdd:audit`

**If phase is `complete`:**
- "Project is complete! Run `/cdd:audit` for a final cross-module check."

**Outstanding contract change priority check:**
If outstanding contract changes exist AND the suggested next action is
/cdd:verify or /cdd:test for an affected module, prepend:

"⚠️ [module] has [N] outstanding contract change(s). Consider running
 [next_step] first to resolve the contract mismatch."

Display the suggestion:
```
───────────────────────────────────────────────────────────────
👉 Recommended next step:
   [suggested command and brief explanation]
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

## Step 4: Session Footer

This is a lightweight, read-only command. Display:
```
   Context used: minimal (state + config only)
   /clear is optional — this command uses very little context.
```

</process>
