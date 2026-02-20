---
name: cdd:add-module
description: Add new modules to a built system (post-build feature addition)
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Interactive scoping session for adding new modules to a built CDD project. Discover what the user wants to add, decompose into modules if needed, generate requirements, produce an addition file, and update planning artifacts. This is the conversational "front half" — the contract generation happens in a separate `/cdd:add-contract` session per module.
</objective>

<execution_context>
You are running the `cdd:add-module` command. This is an INTERACTIVE SCOPING command — no contracts are generated, no code is written.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Verify `phase` is `build_cycle` OR `complete` — if `planning` or `foundation`, tell the user to finish the normal CDD flow first. Stop.
4. Verify `planning.contract.locked: true` — if not, tell the user contracts must be locked first. Stop.

**Context loaded (LIGHTWEIGHT):**
- `.cdd/state.yaml` — full file (phase check, existing module list, addition tracking)
- `.cdd/config.yaml` — full file (stack info, context window settings)
- `.cdd/contracts/MODULES.md` — Module Summary table + Data Ownership Matrix only (NOT the full file)
- `.cdd/contracts/REQUIREMENTS.md` — Grep for highest `FR-\d+` number only (NOT the full file)

**Context NOT loaded:**
- Module contract YAMLs (not needed for scoping)
- Data contract YAMLs (not needed for scoping)
- System invariants (not needed for scoping)
- Events registry (not needed for scoping)
- Source code, session files, BRIEF.md
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify phase and contract lock status.

If pre-conditions fail, explain why and suggest the correct next command. Stop.

If an incomplete addition exists (state.yaml `module_additions` entry where some modules have `contract_generated: false`), display it and ask:
- "Resume this addition? Or start a new one?"
- If resume, show where they left off and suggest `/cdd:add-contract [next-module]`
- If new, proceed to Step 2

## Step 2: Show Existing System

Read `.cdd/contracts/MODULES.md` — extract ONLY the Module Summary table and Data Ownership Matrix sections. Do NOT read the full file.

Grep `.cdd/contracts/REQUIREMENTS.md` for the highest `FR-\d+` number to determine the next FR number.

Display a compact summary of the existing system to orient the user:

```
═══════════════════════════════════════════════════════════════
EXISTING SYSTEM — [project_name]
═══════════════════════════════════════════════════════════════

MODULES ([count]):
  [module-name] ........... [one-line responsibility] ([status])
  [module-name] ........... [one-line responsibility] ([status])
  ...

DATA OWNED:
  [table] → [owner-module]
  [table] → [owner-module]
  ...

───────────────────────────────────────────────────────────────
What would you like to add to this system?
═══════════════════════════════════════════════════════════════
```

## Step 3: Interactive Discovery

Run an open-ended interview. This is NOT scoped to "one module" — the user might describe one feature or five. The goal is to capture everything they want to add, then decompose.

**3a: What and Why**
- "What new capabilities are you adding? What user need or business requirement drives this?"
- "Is this user-facing, an integration, or internal infrastructure?"
- Let the user describe broadly — don't constrain to one thing

**3b: Scope and Boundaries**
- "Walk me through the key behaviors. What does the user (or system) do, and what happens?"
- "What's explicitly NOT part of this addition?"
- Push for clarity on boundaries, same as `cdd:brief`

**3c: Data**
- "Does this need new database tables? What new entities are involved?"
- "Does it need to read or write data from existing modules?" (Reference the Data Ownership table from Step 2)
- Not every module needs its own data — pure integration or orchestration modules are fine with no owned tables

**3d: Dependencies and Integration**
- "How does this connect to the existing system? Which existing modules does it interact with?"
- "Does it need to call functions from existing modules, or do existing modules need to call it?"

**3e: Events**
- "Does anything need to happen reactively? (e.g., 'when a record is created, notify Slack')"
- "Does it need to react to things that already happen in the system?"

**Interview rules:**
- Allow broad, multi-feature descriptions
- Ask follow-up questions when answers are vague
- Summarize periodically to confirm understanding
- When you have enough, say "I have a clear picture. Let me break this down."

## Step 4: Decompose Into Modules

Analyze the discovery conversation and determine:
- Is this one module or multiple?
- Apply the same decomposition logic as `cdd:modularize`:
  - "What must be true for this to be independently buildable?"
  - "What does this area own that nothing else should touch?"
  - "What minimal interface does this area need to expose?"
  - Does any single module exceed the context budget ceiling?

**If one module:** Confirm the name and scope with the user.

**If multiple modules:**
- Present the decomposition:
  ```
  ───────────────────────────────────────────────────────────────
  MODULE DECOMPOSITION
  ───────────────────────────────────────────────────────────────

  What you described breaks down into [N] modules:

  1. [module-name] — [one-line responsibility]
     Owns: [entities]
     Depends on: [existing modules]

  2. [module-name] — [one-line responsibility]
     Owns: [entities]
     Depends on: [module-1 above, existing modules]

  [3. ...]

  Build order: [module-1] → [module-2] → [...]
  ───────────────────────────────────────────────────────────────
  Does this decomposition look right? Any modules to merge, split, or rename?
  ```
- Allow revision until the user approves the decomposition

## Step 5: Validate Module Names

For each module:
- Name must be lowercase-hyphenated
- Must NOT collide with any existing module name in state.yaml
- If collision, suggest alternatives

## Step 6: Generate Requirements

Determine the next FR number from the grep in Step 2's context loading.

For each new module, generate functional requirements using `cdd:plan` format rules:
- Expanded format for complex/multi-step flows
- Compact format for straightforward CRUD
- Number continuing from the highest existing FR
- Group by module

Present requirements to the user for review before writing.

## Step 7: Generate Addition File

Create the `.cdd/additions/` directory if it does not exist.

Write `.cdd/additions/[slug].md` where `[slug]` is derived from the addition (e.g., `slack-integration`, `reporting-webhooks`).

The addition file is a **scoping bridge** — it captures the discovery context and cross-references canonical artifacts. It does NOT duplicate the full requirements or module details that live in MODULES.md and REQUIREMENTS.md.

```markdown
# Addition: [Title]
<!-- addition-version: 1.0 -->
<!-- created: [YYYY-MM-DD] -->

## Reason
[Why this addition is being made — from Step 3a]

## Modules

### [module-name-1]
- **Responsibility:** [what it does]
- **Owns data:** [entities, or "none — integration/orchestration only"]
- **Dependencies (existing):** [list of existing modules it depends on]
- **Dependencies (new):** [list of other new modules it depends on, if any]
- **Reads from:** [existing tables and columns needed]
- **Events consumed:** [from existing modules]
- **Events emitted:** [new events]
- **Endpoints:** [summary of API endpoints]
- **Context budget estimate:** [Nk tokens]
- **Requirements:** FR-[start] through FR-[end]

### [module-name-2]  (if multiple)
[same structure]

## Build Order (new modules only)
1. [module-name-1] — [reason]
2. [module-name-2] — [depends on module-name-1]

## Dependencies on Existing System
- [module-name-1] requires [existing-module].functionName()
- [module-name-2] reads [table] from [existing-module]
- ...

## Foundation Needs
[Foundations that will be auto-created during /cdd:build for each added module]

### New Tables Requiring Migrations
- [table-name] (owned by [module-name]) — [column count] columns
- Or: "None — no new tables"

### New Shared Services
- [ServiceName].[method]() — needed by [module-name]
- Or: "None — uses only existing shared services"

### Middleware Requirements
- [Any new middleware needs — e.g., "new role 'reporter' for RBAC"]
- Or: "None — existing middleware sufficient"
- Note: New middleware cannot be auto-created. Flag for manual handling if needed.

## Known Contract Change Requirements
[List anything that will require cdd:contract-change on existing modules]
- [e.g., "Column X on table Y needs public: true for module-name-1 to read it"]
- [e.g., "existing-module needs to consume new-event from module-name-2"]
- Or: "None — fully additive"
```

## Step 8: Update Planning Artifacts

**Append to `.cdd/contracts/REQUIREMENTS.md`:**
- The new FRs from Step 6, with `(Added: [YYYY-MM-DD])` annotations

**Append to `.cdd/contracts/MODULES.md`:**
- New module row(s) in Module Summary table
- New module(s) in Build Order (at end or after dependencies)
- New Module Details section(s) with `(Added: [YYYY-MM-DD])` annotation
- New rows in Data Ownership Matrix
- Do NOT modify existing module entries

## Step 9: Update State

Read and update `.cdd/state.yaml`:

```yaml
# If phase was 'complete', change back to 'build_cycle'
phase: build_cycle

# Add new module(s)
modules:
  [existing modules unchanged]
  [module-name-1]:
    status: pending
  [module-name-2]:
    status: pending

# Append to build_order
build_order:
  - [existing order unchanged]
  - [module-name-1]
  - [module-name-2]

# Update parallel_groups
parallel_groups:
  [existing groups unchanged]
  - [[module-name-1]]            # new group, or merge into existing if no deps
  - [[module-name-2]]            # separate group if depends on module-name-1

# Track the addition with per-module contract status
module_additions:
  - date: "[YYYY-MM-DD]"
    addition_file: "[slug].md"
    modules:
      - name: [module-name-1]
        contract_generated: false
      - name: [module-name-2]
        contract_generated: false
    requirement_range: "FR-[start] through FR-[end]"
```

## Step 10: Present Summary and Session Footer

```
═══════════════════════════════════════════════════════════════
CDD:ADD-MODULE — SCOPING COMPLETE
═══════════════════════════════════════════════════════════════

Addition: [title]
Modules defined: [count]
New requirements: FR-[start] through FR-[end] ([count] FRs)

MODULES:
  [module-name-1] ........... [responsibility]
  [module-name-2] ........... [responsibility]

Build order: [module-1] → [module-2]

FILES WRITTEN:
  .cdd/additions/[slug].md .......... addition scoping file
  .cdd/contracts/REQUIREMENTS.md .... [N] FRs appended
  .cdd/contracts/MODULES.md ......... [N] module(s) appended
  .cdd/state.yaml ................... [N] module(s) added

[If known contract changes needed:]
  These will require /cdd:contract-change before or after building:
   - [issue description]

───────────────────────────────────────────────────────────────
Next steps:
   1. Run /clear to reset your context window
   2. Run /cdd:add-contract [module-name-1]
      to generate its interface contract

   [If multiple modules:]
   Then for each additional module:
   3. Run /clear
   4. Run /cdd:add-contract [module-name-2]

   Generate contracts in the build order shown above.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
