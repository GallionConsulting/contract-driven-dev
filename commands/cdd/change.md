---
name: cdd:change
description: Process a per-module change file — research, verdict, and apply changes
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Process ONE change file for a single module. For each item in the file: research the code and contracts, deliver a verdict (ACTIONABLE / NO_CHANGE_NEEDED / CONTRACT_CHANGE_REQUIRED / DEFERRED), apply changes for actionable items, then update state to require re-verification and re-testing. No inline verify/test — those run as separate sessions afterward.
</objective>

<execution_context>
You are running the `cdd:change` command. This is a PER-MODULE CHANGE PROCESSOR that makes targeted changes while respecting contracts.

**Argument:** The change file name (without path). Resolved to `.cdd/changes/pending/[name].yaml`.

If no argument is provided, list pending change files from `.cdd/changes/pending/` and stop:
```
CDD:CHANGE — No change file specified.

Pending change files:
  auth-CHG-20260215-1030              (3 issues)
  task-management-CHG-20260215-1030   (5 issues)

Usage: /cdd:change [change-file-name]
Example: /cdd:change auth-CHG-20260215-1030
```

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase` is `build_cycle` or `complete`
3. Verify the change file exists at `.cdd/changes/pending/[name].yaml`
4. Verify the change file `status` is `pending` (not already processed)
5. Verify the module referenced in the change file has `status: complete` in state.yaml

**Context loaded per module:**
- Change file (`.cdd/changes/pending/[name].yaml`)
- Module contract (`.cdd/contracts/modules/[module].yaml`)
- Module source files (found via session files or Glob)
- Data contracts for tables this module owns or reads (`.cdd/contracts/data/*.yaml`)
- System invariants (`.cdd/contracts/system-invariants.yaml`)
- `.cdd/config.yaml`

**Context NOT loaded:**
- Other modules' source code
- Test files
- Planning artifacts
</execution_context>

<process>

## Step 1: Load Change File and Module Context

1. Read the change file from `.cdd/changes/pending/[name].yaml`
2. Read `.cdd/state.yaml` and `.cdd/config.yaml`
3. Read module contract at `.cdd/contracts/modules/[module].yaml`
4. Read `.cdd/contracts/system-invariants.yaml`
5. Read data contracts for this module's `data_ownership` tables (from `.cdd/contracts/data/*.yaml`)
6. Find and read module source files — check `.cdd/sessions/` for the latest session file listing `files_created`/`files_modified`, or use Glob based on config.yaml paths

## Step 2: Display Change Plan

Show the issues from the change file in a table. Proceed without waiting (this is not interactive).

```
CDD:CHANGE — [module-name] ([N] issues)
Batch: [batch_id]

| ID    | Severity | Category    | Description                          |
|-------|----------|-------------|--------------------------------------|
| CHG-2 | medium   | removal     | Remove Password column from grid     |
| CHG-5 | medium   | bug         | Loose != comparison risks type-juggling |
| ...   | ...      | ...         | ...                                  |

Processing...
```

## Step 3: Research and Verdict Each Issue

For each issue in the change file (ordered by severity: critical > high > medium > low):

### 3a. Research

- Read relevant code sections (specific files/functions, not everything)
- Grep for related patterns within the module's source
- Check against contract and system invariants
- Document findings

### 3b. Verdict — one of:

| Verdict | Meaning | Action |
|---------|---------|--------|
| **ACTIONABLE** | Can be implemented within current contracts | Apply change in Step 4 |
| **NO_CHANGE_NEEDED** | Already works as described, change would have no effect, or request is based on a misunderstanding | Document reasoning, no code change |
| **CONTRACT_CHANGE_REQUIRED** | Real change but requires contract modification first | Flag with detailed breakdown (see below), no code change |
| **DEFERRED** | Real but too broad or risky to apply in isolation | Document scope and recommend approach |

**Verdict reasoning must be specific:**
- Reference exact file:line locations
- Quote the relevant contract clause if applicable
- Explain WHY this verdict was chosen over alternatives

### 3c. CONTRACT_CHANGE_REQUIRED — Detailed Breakdown

This is the most important verdict to get right. Instead of a dead-end "go use a different command", this verdict must include enough information for the user to make an informed decision and act on it efficiently.

**Required fields for CONTRACT_CHANGE_REQUIRED:**

```yaml
- id: CHG-4
  severity: medium
  category: removal
  description: "Remove Password column from Users grid"
  verdict: CONTRACT_CHANGE_REQUIRED
  reasoning: |
    The Users module contract (users.yaml, clause DG-3) specifies
    GET /users returns: [id, name, email, password_masked, role, created_at].
    The grid component renders all response fields.

    Two paths forward:
    1. HIDE in UI only (keep in API response) — this IS actionable
       within the current contract. Just remove the column from the
       grid template. The API still returns it; the UI just doesn't
       render it.
    2. REMOVE from API response entirely — this requires changing
       clause DG-3 to drop password_masked from the response schema.

    Recommending option 1 unless there's a reason to stop returning
    the field entirely (e.g., security concern about including it
    in API responses even if masked).
  contract_file: ".cdd/contracts/modules/users.yaml"
  contract_clause: "DG-3: GET /users response schema"
  suggested_change: "Remove password_masked from DG-3 response fields"
  next_step: "/cdd:contract-change users — Remove password_masked from DG-3 response"
```

**Key properties of this verdict:**
- Identifies the **specific contract file and clause** affected
- Explains **why** the current contract prevents the change
- Offers **alternatives** when the change could be done a different way within contracts
- Provides the **exact command** to run if a contract change is pursued
- The research context is **preserved in the completed change file**, so the user (or the next session running `contract-change`) has full context

## Step 4: Apply Actionable Changes

For each issue with verdict `ACTIONABLE`:

1. Apply targeted changes using Edit/Write
2. Track all file changes (file path, lines changed, what changed)
3. Minimize blast radius — change only what's needed

**Universal rule (all categories):**
All changes must stay within contract bounds. If a change would violate or modify a contract clause, classify it as CONTRACT_CHANGE_REQUIRED and explain which clause and why. No cross-module source changes. No new dependencies not declared in the contract.

**Category-specific guidance:**

| Category | Guidance |
|----------|----------|
| `bug` | Minimal blast radius. Change only what's broken. Don't restructure surrounding code. |
| `ui` | May change labels, layout ordering, CSS/styling, component structure, and visible text — as long as the contract doesn't specify those elements. |
| `removal` | May remove rendered elements, UI components, display columns — as long as the underlying data contract and API response aren't affected. If the removal affects the data layer, it's CONTRACT_CHANGE_REQUIRED. |
| `enhancement` | May add behavior within existing contract-defined interfaces. If new endpoints, fields, or parameters are needed, it's CONTRACT_CHANGE_REQUIRED. |
| `performance` | May change implementation approach (caching, query optimization, batching) without changing contract-defined behavior. |
| `security` | May tighten validation, add sanitization, fix auth checks. May NOT loosen security constraints. |
| `contract` | These are already explicitly about contract mismatches — handle same as current. |
| `style` | Formatting, naming conventions, code organization within a module. No behavioral changes. |
| `portability` | Replace platform-specific constructs with portable alternatives. No behavioral changes. |

**Additional rules — STRICTLY enforce:**
- Do NOT modify code in other modules' directories
- If a change would introduce a new contract violation, REVERT the change and reclassify the issue as `DEFERRED` with explanation

## Step 5: Update Change File

Move from pending to completed. Ensure `.cdd/changes/completed/` directory exists (create if needed).

Write to `.cdd/changes/completed/[name].yaml`:

```yaml
batch_id: "CHG-20260215-1030"
module: task-management
generated_at: "2026-02-15T10:30:00Z"
completed_at: "2026-02-15T11:15:00Z"
status: complete

summary:
  actionable: 3
  no_change_needed: 1
  contract_changes: 0
  deferred: 1

issues:
  - id: CHG-2
    severity: medium
    category: ui
    description: "Move Buy button to bottom of Order Screen and rename to Purchase"
    verdict: ACTIONABLE
    reasoning: "OrderScreen.jsx:78 renders the Buy button in the header section. Contract does not specify button placement or label text — these are UI-only concerns."
    changes:
      - file: "app/components/OrderScreen.jsx"
        lines: "78-82"
        description: "Moved button from header to footer section, renamed label from 'Buy' to 'Purchase'"

  - id: CHG-5
    severity: medium
    category: bug
    description: "Loose != comparison risks type-juggling"
    verdict: NO_CHANGE_NEEDED
    reasoning: "TaskManagementService.php:112 uses != but both operands are always strings from validated input"

  - id: CHG-8
    severity: low
    category: portability
    description: "FIELD() SQL function is MariaDB-only"
    verdict: DEFERRED
    reasoning: "Would require restructuring query builder pattern; recommend addressing in dedicated refactor"
    recommended_approach: "Replace FIELD() with CASE WHEN or use Eloquent orderByRaw with portable SQL"
```

Delete the pending file after writing the completed file so it is not processed twice.

## Step 6: Update state.yaml

Read `.cdd/state.yaml` and update:

```yaml
# If phase was 'complete', change back to build_cycle
phase: build_cycle

modules:
  [module]:
    # Reset verification/test flags (forces re-verify, re-test)
    verified: false
    tested: false
    # Add change metadata
    last_change:
      date: "[ISO 8601 timestamp]"
      batch_id: "[batch_id from change file]"
      issues_processed: [total count]
      actionable: [count]
      no_change_needed: [count]
      contract_changes: [count]
      deferred: [count]
      change_file: ".cdd/changes/completed/[name].yaml"
    # KEEP these unchanged:
    # status: complete
    # build_status: complete
    # build_completed: (original timestamp)
```

**Why these specific changes:**
- `verified: false` and `tested: false` force the module through the re-verify and re-test pipeline
- `phase: build_cycle` (if currently `complete`) unlocks the verify/test phase gates
- `status: complete` and `build_status: complete` are kept because the build is still valid, just patched

## Step 7: Display Summary and Next Steps

```
CDD:CHANGE COMPLETE — [module-name]

Issues processed: [total]

| Verdict                  | Count |
|--------------------------|-------|
| ACTIONABLE               | [N]   |
| NO_CHANGE_NEEDED         | [N]   |
| CONTRACT_CHANGE_REQUIRED | [N]   |
| DEFERRED                 | [N]   |

Files modified: [N]
Change file: .cdd/changes/completed/[name].yaml

Module state updated:
  verified: false — needs /cdd:verify
  tested: false   — needs /cdd:test

[If any CONTRACT_CHANGE_REQUIRED verdicts:]
  CONTRACT CHANGES REQUIRED:
    CHG-[N]: [description]
      Contract: [contract_file], Clause: [contract_clause]
      Next step: [next_step command]

[If any DEFERRED verdicts:]
  DEFERRED: CHG-[N] — [description] (recommend [approach])

Next steps:
   /clear
   /cdd:verify [module]
   /clear
   /cdd:test [module]
```

</process>
</output>
</output>
