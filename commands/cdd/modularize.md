---
name: cdd:modularize
description: Break system into modules with context budgets
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

<objective>
Read the structured requirements (REQUIREMENTS.md) and decompose the system into independently-buildable modules. Each module gets a clear responsibility boundary, dependency declaration, context budget estimate, and build order position. The output is MODULES.md.
</objective>

<execution_context>
You are running the `cdd:modularize` command. This breaks the system into modules suitable for contract-driven building.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: planning`
3. Verify `planning.plan.status: complete` — if not, tell the user to run `cdd:plan` first
4. Verify `planning.modularize.status: pending` — if `complete`, tell the user modularization is done and suggest `cdd:contract`

**Context budget:** This command loads ONLY `.cdd/contracts/REQUIREMENTS.md` and state/config files. Do NOT read BRIEF.md, source code, or other files.
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `planning`
- `planning.plan.status` is `complete`
- `planning.modularize.status` is `pending`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Check for Pre-existing Modules

Check if `.cdd/contracts/MODULES.md` already exists.

**If it exists:**
- Read it and display a summary (module count, build order, total estimated sessions)
- Tell the user: "I found an existing MODULES.md. Let me review it for completeness."
- Check if it covers all required sections (Module Summary, Dependency Graph, Build Order, Parallel Groups, Module Details, Data Ownership Matrix, Shared Services)
- If any sections are missing or thin, point them out and ask if the user wants to fill them in
- If it looks complete, ask for approval and skip to Step 10
- This path supports re-running after a `/clear` during revision

**If it does not exist:** Proceed to Step 3.

## Step 3: Read Requirements

Read `.cdd/contracts/REQUIREMENTS.md` as your sole input. Also read `.cdd/config.yaml` for context window settings.

Extract the `context.window_size` and `context.max_usage_percent` from config.yaml to calculate the per-session budget ceiling:
- `session_budget = window_size * (max_usage_percent / 100)`
- `module_ceiling = session_budget * 0.40` (no single module may exceed 40% of the session budget)

Default: 200k window * 40% = 80k session budget, 40% of 80k = 32k module ceiling.

## Step 4: Identify Modules

Apply goal-backward planning — for each functional area in the requirements, ask:
- "What must be true for this to be independently buildable?"
- "What does this area own that nothing else should touch?"
- "What minimal interface does this area need to expose?"

Group requirements into modules. For each module, define:

### Module Definition
- **Name:** lowercase-hyphenated (e.g., `user-management`, `billing`, `notifications`)
- **Responsibility:** One sentence describing what this module does (and implicitly, what it does NOT do)
- **Owns:** The data entities this module is the sole owner of
- **Requirements covered:** List of FR-numbers this module implements
- **Dependencies:** Other modules this module depends on (by name)
- **Estimated sessions:** How many build sessions this module will likely need (1-3)

### Context Budget Estimate
For each module, estimate token counts for:

| Category | Description | Estimate |
|----------|-------------|----------|
| `contract_files` | This module's contract YAML + system invariants | [tokens] |
| `dependency_interfaces` | `provides` sections from dependency modules | [tokens] |
| `reference_files` | Existing implementation files to read for context | [tokens] |
| `implementation_target` | Code to be written/modified | [tokens] |
| `test_target` | Test code to be written | [tokens] |
| **Total** | | **[tokens]** |

**Budget rules:**
- If any module's total exceeds the module ceiling (default 32k tokens), it MUST be split into sub-modules
- Estimates should be conservative — overestimate rather than underestimate
- Rough guide: 1 token ≈ 4 characters. A typical 100-line code file ≈ 2-3k tokens.

## Step 5: Validate Dependency Graph

The module dependency graph MUST be a Directed Acyclic Graph (DAG). Verify:

1. **No cycles:** If module A depends on B and B depends on A (directly or transitively), you must restructure. Common fixes:
   - Extract the shared dependency into a new module
   - Invert one dependency by using events/callbacks instead of direct calls
   - Merge the tightly coupled modules

2. **No orphans:** Every module should either depend on something or be depended upon (unless it's truly standalone)

3. **Topological sort:** Compute a valid build order where every module is built only after all its dependencies are built

## Step 6: Identify Parallel Groups

Group modules that have NO mutual dependencies (direct or transitive) into parallel groups. Modules in the same parallel group can theoretically be built in any order or simultaneously.

## Step 7: Create Data Ownership Matrix

Build a matrix mapping every data entity from the requirements to exactly one owning module:

| Entity | Owner Module | Read By | Write By |
|--------|-------------|---------|----------|
| [entity] | [module] | [modules that read] | [only owner writes] |

**Rules:**
- Every entity has exactly ONE owner module
- Only the owner module may write to the entity's tables (strictly enforced)
- Other modules may read directly using framework-native patterns (ORM, query builder, etc.) — reads are declared for dependency tracking, not to restrict access patterns
- If two modules need to write to the same entity, restructure the ownership

## Step 8: Identify Shared Services

List any cross-cutting concerns that multiple modules need:
- Logging/audit trail
- Event bus/dispatch
- File storage
- Email/notification dispatch
- Caching layer

These become part of the `foundations` phase, not module contracts.

## Step 9: Generate MODULES.md

Write `.cdd/contracts/MODULES.md` with this structure:

```markdown
# [Project Name] — Module Architecture

## Module Summary

| Module | Responsibility | Dependencies | Sessions | Budget |
|--------|---------------|--------------|----------|--------|
| [name] | [one-line] | [dep1, dep2] | [1-3] | [Nk tokens] |

## Dependency Graph

[ASCII art or mermaid diagram showing module dependencies]

## Build Order

[Numbered list showing the order modules should be built]
1. [module] — [why first: no dependencies / foundation only]
2. [module] — [depends on: module from step 1]
...

## Parallel Groups

[Group modules that can be built independently]
- **Group 1:** [module-a], [module-b] (no mutual dependencies)
- **Group 2:** [module-c] (depends on Group 1)

## Module Details

### [module-name]
- **Responsibility:** [detailed description]
- **Requirements:** [FR-1, FR-2, ...]
- **Owns data:** [entity1, entity2]
- **Dependencies:** [module1 (for X), module2 (for Y)]
- **Context budget:**
  | Category | Tokens |
  |----------|--------|
  | contract_files | [N] |
  | dependency_interfaces | [N] |
  | reference_files | [N] |
  | implementation_target | [N] |
  | test_target | [N] |
  | **Total** | **[N]** |
- **Estimated sessions:** [N]
- **Notes:** [any special considerations]

[Repeat for each module]

## Data Ownership Matrix

| Entity | Owner | Reads | Writes |
|--------|-------|-------|--------|
| [entity] | [module] | [modules] | [owner only] |

## Shared Services

| Service | Purpose | Used By |
|---------|---------|---------|
| [name] | [what it does] | [modules] |
```

## Step 10: Present Summary for Approval

**Do NOT display the full MODULES.md in your response.** The document is already written to disk and the user can read it there. Displaying it would duplicate the content in the context window.

Instead, display a structured summary:

```
═══════════════════════════════════════════════════════════════
MODULE ARCHITECTURE SUMMARY
═══════════════════════════════════════════════════════════════

Modules: [count]
Estimated total sessions: [count]

MODULE SUMMARY
  [module-name] ........... [one-line responsibility] ([Nk tokens])
  [module-name] ........... [one-line responsibility] ([Nk tokens])
  ...

BUILD ORDER
  1. [module] — [reason]
  2. [module] — [depends on: ...]
  ...

PARALLEL GROUPS
  Group 1: [module-a], [module-b]
  Group 2: [module-c]

DATA OWNERSHIP
  [entity] → [owner-module] (read by: [modules])
  ...

SHARED SERVICES
  [service] — [used by: modules]
  ...

BUDGET NOTES
  - [Any modules that were split due to budget constraints]
  - [Any modules near the ceiling]
  Module ceiling: [N]k tokens

───────────────────────────────────────────────────────────────
📄 Full document: .cdd/contracts/MODULES.md

Review the full document, then tell me:
  - Are any modules too large, too small, or missing?
  - Is the build order reasonable?
  - Any unexpected coupling in the dependency graph?
═══════════════════════════════════════════════════════════════
```

### Revision handling:

Allow the user to request modifications. Edit the file as needed.

**After 2 rounds of revisions**, suggest:
> "We've done a couple of revision rounds. If you need more significant changes, I recommend running `/clear` and then `/cdd:modularize` again — I'll pick up the existing MODULES.md and refine it from there, with a fresh context window."

## Step 11: State Update

When the user approves:

1. Read the current `.cdd/state.yaml`
2. Update it:
   - Set `planning.modularize.status: complete`
   - Add `planning.modularize.completed_at: [ISO 8601 timestamp]`
   - Add `planning.modularize.module_count: [number]`
   - Populate the `modules` section with each module name and status `pending`:
     ```yaml
     modules:
       module-name-1:
         status: pending
       module-name-2:
         status: pending
     ```
   - Populate `build_order` with the ordered list of module names
   - Populate `parallel_groups` with arrays of module names
3. Write the updated state.yaml back

## Step 12: Session Footer

Display:

```
═══════════════════════════════════════════════════════════════
✅ CDD:MODULARIZE COMPLETE

Module architecture saved to: .cdd/contracts/MODULES.md
Modules defined: [count]
Estimated total sessions: [count]
Build order: [module1 → module2 → ...]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:contract to generate interface contracts
      for every module

   This is the most critical step — contracts define the exact
   interfaces between modules. Take your time reviewing them.

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
