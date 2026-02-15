---
name: cdd:complete
description: Mark a module as complete and identify next steps
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

<objective>
Mark a verified and tested module as complete. This is a lightweight state-management command — it updates the project state, identifies which modules are now unblocked by this completion, finds parallel-eligible next modules, and displays a progress report. When the last module completes, it advances the project to the final phase.
</objective>

<execution_context>
You are running the `cdd:complete` command. This is a STATE MANAGEMENT command — it does not write any implementation code.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and display all modules with their status, highlighting any that are ready to complete (verified AND tested but not yet marked complete). Then stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: build_cycle`
3. Verify the module exists in `state.yaml` modules
4. Verify `modules.[module].verified: true` — if not, tell the user to run `cdd:verify [module]` first
5. Verify `modules.[module].tested: true` — if not, tell the user to run `cdd:test [module]` first
6. Verify the module is NOT already `status: complete` — if it is, tell the user it's already complete

**Context loaded (LIGHTWEIGHT — state only):**
- `.cdd/state.yaml` — full state file
- `.cdd/contracts/modules/*.yaml` — ONLY the `blocked_by` field of each module contract (for unblock logic)
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `build_cycle`
- `modules.[module]` exists
- `modules.[module].verified` is `true`
- `modules.[module].tested` is `true`
- `modules.[module].status` is NOT `complete`

If any pre-condition fails, explain why and suggest the correct next command. Stop.

## Step 2: Update Module Status

Read `.cdd/state.yaml` and update:
```yaml
modules:
  [module]:
    status: complete
    build_completed: "[ISO 8601 timestamp]"
```

## Step 3: Identify Newly Unblocked Modules

Scan ALL module contracts in `.cdd/contracts/modules/` — read ONLY the `blocked_by` field of each.

For each module that is NOT yet complete:
1. Read its `blocked_by` list
2. Check if every module in that list now has `status: complete` in state.yaml
3. If YES — this module is now unblocked and ready to build

Compile the list of newly unblocked modules (those that were blocked before this completion but are now fully unblocked).

## Step 4: Identify Parallel-Eligible Modules

From the newly unblocked modules (and any previously unblocked but not-yet-started modules):
- Check the `parallel_groups` in state.yaml
- Identify modules that can be built simultaneously (same parallel group, all dependencies met)

## Step 5: Calculate Progress

Count:
- `total_modules`: total number of modules in state.yaml
- `completed_modules`: modules with `status: complete`
- `in_progress_modules`: modules with `status: in_progress`
- `pending_modules`: modules with `status: pending`
- `failed_modules`: modules with `status: failed`

Calculate percentage: `completed_modules / total_modules * 100`

## Step 6: Check if ALL Modules Complete

If `completed_modules == total_modules`:
- This is the final module! Update state:
```yaml
phase: complete
completed_at: "[ISO 8601 timestamp]"
```
- Display the all-complete message (see footer below)
- Stop.

## Step 7: Display Completion Report

```
═══════════════════════════════════════════════════════════════
MODULE COMPLETE: [module-name]
═══════════════════════════════════════════════════════════════

Progress: [completed]/[total] modules ([percentage]%)

[Progress bar visualization:]
[████████████░░░░░░░░] 60%

───────────────────────────────────────────────────────────────
NEWLY UNBLOCKED
───────────────────────────────────────────────────────────────
[For each newly unblocked module:]
  🔓 [module-name] — ready to build
     Dependencies: [list, all ✅]

[If no newly unblocked modules:]
  No new modules unblocked by this completion.

───────────────────────────────────────────────────────────────
PARALLEL ELIGIBLE
───────────────────────────────────────────────────────────────
[If multiple modules can be built simultaneously:]
  These modules can be built in parallel (independent):
  - [module-a]
  - [module-b]

[If only one module is next:]
  Next in sequence: [module-name]

───────────────────────────────────────────────────────────────
ALL MODULES
───────────────────────────────────────────────────────────────
[For each module in build_order:]
  [✅|🔨|⏸️|❌|🔒] [module-name] — [complete|in_progress|pending|failed|blocked]

Legend: ✅ complete  🔨 in progress  ⏸️ ready  ❌ failed  🔒 blocked

═══════════════════════════════════════════════════════════════
```

## Step 8: Session Footer

**If more modules remain:**
```
───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:build [recommended-module] to build
      the next module

   [If parallel eligible:]
   Parallel option: [module-a] and [module-b] can be built
   independently. You could build them in separate sessions.

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

The recommended module is:
1. First newly unblocked module (if any)
2. Otherwise, first pending module in build_order whose dependencies are met
3. Otherwise, suggest checking status with `cdd:status`

**If ALL modules are complete:**
```
═══════════════════════════════════════════════════════════════
🎉 ALL MODULES COMPLETE

   Every module has been built, verified, and tested.
   Total modules: [count]
   Phase transition: build_cycle → complete

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:audit to perform a final
      cross-module integration audit

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
