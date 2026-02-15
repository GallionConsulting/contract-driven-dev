---
name: cdd:reset
description: Abandon a partial module build and return to ready state
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Abandon a partial or failed module build, log what was attempted and why, optionally clean up partial implementation files, and reset the module's state to `pending` so it can be rebuilt fresh. The session log is always preserved so lessons can be learned from the failed attempt. This command gives users a clean escape from builds that went sideways — it is NOT destructive to contracts, only to implementation state.
</objective>

<execution_context>
You are running the `cdd:reset` command. This is a RECOVERY command — it resets a module's build state without touching contracts.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and display any modules with `status: in_progress` or `status: failed`, then ask the user which module to reset. If no modules are in-progress or failed, say "No modules need resetting. All modules are either pending or complete." and stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify the module exists in state.yaml
3. Verify the module's status is `in_progress` or `failed` — if `pending`, say "Module is already in pending state — nothing to reset." Stop. If `complete`, say "Module is already complete. To rebuild a complete module, you would need to manually set its status back." Stop.

**Context loaded:**
- `.cdd/state.yaml` — full state
- Session file for the module (if exists) — to log what was attempted
- File listing from session's `files_created` — to offer cleanup

**Context NOT loaded:**
- Module contracts (not needed for reset)
- Source code contents (not needed — only paths matter for cleanup)
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Find the module. Verify its status is `in_progress` or `failed`.

If pre-conditions fail, explain why and suggest alternatives. Stop.

## Step 2: Gather Reset Reason

Ask the user why the build is being reset. This is important for the session log:

"Why are you resetting module [module-name]? (This will be logged in the session file for future reference.)"

Common reasons include:
- Approach didn't work out
- Contract needs changes first
- Dependencies weren't actually ready
- Context window was exhausted
- Implementation got too tangled

Wait for the user's response.

## Step 3: Read Session File

Read the session file for this module (from `modules.[module].session_file` or `modules.[module].current_session`).

If a session file exists, extract:
- `files_created` — list of files created during the build
- `files_modified` — list of files modified during the build
- `decisions_made` — decisions made during the attempt
- `issues_discovered` — issues found

If no session file exists, note that and proceed.

## Step 4: Ask About Partial Files

If the session file lists any `files_created`, ask the user:

"The following files were created during this build attempt:

[list files with paths]

Would you like to:
1. **Keep** partial files (for reference when rebuilding)
2. **Delete** partial files (clean slate)

Note: Modified files cannot be automatically reverted — only newly created files can be deleted."

Wait for the user's response.

## Step 5: Update Session File

If a session file exists, update it to record the reset:

Add to the session file:
```yaml
reset:
  reset_at: "[ISO 8601 timestamp]"
  reason: "[user's reason]"
  files_kept: [true/false]
  status: abandoned
```

Update the session's `status` field to `abandoned`.

If no session file exists, create a minimal one:
```yaml
# CDD Session File — Reset Record
session_id: "reset-[module]-[YYYYMMDD-HHMMSS]"
module: "[module-name]"
command: reset
started_at: "[original build_started from state, or unknown]"
ended_at: "[ISO 8601 timestamp]"
status: abandoned

reset:
  reset_at: "[ISO 8601 timestamp]"
  reason: "[user's reason]"
  files_kept: [true/false]

context_for_next_session: |
  Previous build attempt was abandoned. Reason: [user's reason].
  [If issues_discovered existed: "Issues found during attempt: [list]"]
  Fresh build recommended.
```

## Step 6: Delete Partial Files (if requested)

If the user chose to delete partial files:
- For each file in `files_created`, check if it exists
- Delete existing files
- Do NOT delete files listed in `files_modified` — those existed before the build
- Count how many files were deleted

## Step 7: Reset State

Read `.cdd/state.yaml` and update the module:

```yaml
modules:
  [module]:
    status: pending
    build_status: null
    current_session: null
    progress: null
    build_started: null
    verified: null
    tested: null
```

Remove the progress, session, and build fields — return the module entry to a clean pending state. Preserve any fields that were set before the build (like `blocked_by` references from other state entries).

## Step 8: Display Reset Confirmation

```
═══════════════════════════════════════════════════════════════
MODULE RESET: [module-name]
═══════════════════════════════════════════════════════════════

Previous attempt logged: .cdd/sessions/[session-id].yaml
Reason: [user's reason]
Files created during attempt: [count]
  [Kept for reference / Deleted]
Module status: pending (ready for fresh build)

───────────────────────────────────────────────────────────────
👉 Options:
   /cdd:build [module] — start a fresh build
   /cdd:status — see full project status
   Review session log: .cdd/sessions/[session-id].yaml

   If the contract needs changes first:
   /cdd:contract-change — formally request a contract update

───────────────────────────────────────────────────────────────
   Tip: Review the session log before rebuilding — it contains
   decisions and issues from the previous attempt that may
   help avoid the same problems.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
