---
name: cdd:resume
description: Resume in-progress work from a previous session
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Resume an in-progress module build from a previous session. This command replaces chat history with structured session handoff files — it loads the session file, the module contract, and dependency interfaces, then continues the build exactly where it left off. This is the core mechanism that makes multi-session CDD builds work.
</objective>

<execution_context>
You are running the `cdd:resume` command. You are picking up an in-progress build from a previous session. The session handoff file IS your context — you do NOT have the previous chat history, and you do NOT need it.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Find modules with `status: in_progress` in state.yaml
4. If NO in-progress modules found, display:
   ```
   No in-progress work found.

   Options:
     /cdd:build [module] — start building the next module
     /cdd:status — see full project status
   ```
   Then stop.

**Context loaded (same as cdd:build):**
- `.cdd/state.yaml`
- `.cdd/config.yaml`
- The in-progress module's contract (`.cdd/contracts/modules/[module].yaml`)
- The session handoff file (`.cdd/sessions/[session_id].yaml`) — identified by `modules.[module].current_session` or `modules.[module].session_file` in state.yaml
- System invariants (`.cdd/contracts/system-invariants.yaml`)
- Data contracts for tables this module owns or reads (column definitions from `.cdd/contracts/data/*.yaml`)
- `provides` sections ONLY of dependency modules (same rules as `cdd:build`)

**Context NOT loaded:**
- Previous chat history (the session file replaces it)
- Other modules' source code
- Other modules' full contracts
- Data contracts for tables not in this module's `data_ownership`
</execution_context>

<process>

## Step 1: Find In-Progress Work

Read `.cdd/state.yaml`. Scan all modules for `status: in_progress`.

**If multiple modules are in-progress:**
Display them and ask which to resume:
```
Multiple modules are in-progress:
  - [module-a] (session: [session-id])
  - [module-b] (session: [session-id])

Which module would you like to resume?
```
Wait for user response. Then proceed with the chosen module.

**If exactly one module is in-progress:** Proceed with that module.

## Step 2: Load Session Handoff

Read the session file. The session ID is found at:
- `modules.[module].current_session` or
- `modules.[module].session_file` (as a path)

Read the session file at `.cdd/sessions/[session_id].yaml`.

If the session file doesn't exist at the expected path, scan `.cdd/sessions/` for files matching the module name and use the most recent one. If no session file exists at all, say:
```
No session file found for module [module]. The state shows in_progress but there's
no handoff context. Options:
  /cdd:reset [module] — reset and start fresh
  /cdd:build [module] — this will fail because status is in_progress; reset first
```
Stop.

## Step 3: Load Module Context

Load the same context as `cdd:build`:
1. Module contract at `.cdd/contracts/modules/[module].yaml` — full contract
2. System invariants at `.cdd/contracts/system-invariants.yaml`
3. Data contracts for tables this module owns or reads — find each table in `.cdd/contracts/data/*.yaml` and load its column definitions, types, indexes, and foreign keys
4. `provides` sections ONLY of dependency modules (from contract's `blocked_by` / `requires.from_modules`)
5. Shared service interfaces relevant to this module

## Step 4: Display Resume Briefing

```
═══════════════════════════════════════════════════════════════
RESUME SESSION
═══════════════════════════════════════════════════════════════
MODULE: [module-name]
CONTRACT: .cdd/contracts/modules/[module].yaml
SESSION: [session-id]

───────────────────────────────────────────────────────────────
PROGRESS
───────────────────────────────────────────────────────────────
  [For each progress layer from state.yaml:]
  [✅|🔨|⏳] [layer] — [status]

  Example:
  ✅ service — complete
  ✅ queries — complete
  🔨 routes — in_progress / partial
  ⏳ events — pending

───────────────────────────────────────────────────────────────
HANDOFF CONTEXT
───────────────────────────────────────────────────────────────
[Display the context_for_next_session field from the session file verbatim —
 this is the most critical piece of the resume]

───────────────────────────────────────────────────────────────
FILES CREATED
───────────────────────────────────────────────────────────────
[List all files from the session file's files_created section:]
  [status-icon] [path] — [purpose]

───────────────────────────────────────────────────────────────
DECISIONS MADE
───────────────────────────────────────────────────────────────
[List all entries from decisions_made:]
  - [decision]

───────────────────────────────────────────────────────────────
ISSUES DISCOVERED
───────────────────────────────────────────────────────────────
[List all entries from issues_discovered:]
  - [issue]
[If none: "No issues recorded."]

───────────────────────────────────────────────────────────────
NEXT STEPS
───────────────────────────────────────────────────────────────
[List all entries from next_steps:]
  - [step]

═══════════════════════════════════════════════════════════════
```

## Step 5: Read Existing Files

Before continuing the build, re-read the source files that were created in the previous session:
- Read each file listed in `files_created` (where status is `complete` or `partial`)
- Read each file listed in `files_modified`

This restores your understanding of the current implementation state.

## Step 6: Continue the Build

Now continue the build from where it left off. Follow the same build workflow as `cdd:build` (read `~/.claude/cdd/workflows/build.md`), but:

- **Skip completed layers** — if `progress.service: complete`, do NOT rebuild the service layer
- **Resume the in-progress layer** — pick up where the `next_steps` indicate
- **Continue to remaining layers** — proceed through the rest of the build order

Before writing any code, confirm with the user:
"I've reviewed the session handoff and existing files. The [module] build is [X]% complete — [completed layers] are done, [remaining layers] remain. I'll continue with [next layer/step]. Shall I proceed?"

Wait for user confirmation before writing code.

## Step 7: Update Session File

When work is done (or the session is ending), update the session file at `.cdd/sessions/[session_id].yaml`:
- Add any new `files_created` or `files_modified`
- Add any new `decisions_made`
- Add any new `issues_discovered`
- Update `context_for_next_session` with current state
- Update `ended_at` timestamp

If this is a NEW session continuing the same build, you may either:
- Update the existing session file (append to it), OR
- Create a new session file with a new timestamp and update `modules.[module].current_session` in state.yaml

## Step 8: Update State

Update `.cdd/state.yaml` with current progress (same format as the build workflow).

## Step 9: Session Footer

Display the same footer as `cdd:build` — either the "complete" or "partial" variant depending on whether the build is finished.

</process>
