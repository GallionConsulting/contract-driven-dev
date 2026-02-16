---
name: cdd:fix
description: Process a per-module fix file — research, verdict, and fix issues
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Process ONE fix file for a single module. For each issue in the file: research the code, deliver a verdict (CONFIRMED / FALSE_POSITIVE / CONTRACT_ISSUE / DEFERRED), apply targeted fixes for confirmed issues, then update state to require re-verification and re-testing. No inline verify/test — those run as separate sessions afterward.
</objective>

<execution_context>
You are running the `cdd:fix` command. This is a PER-MODULE ISSUE PROCESSOR that makes targeted fixes while respecting contracts.

**Argument:** The fix file name (without path). Resolved to `.cdd/fixes/pending/[name].yaml`.

If no argument is provided, list pending fix files from `.cdd/fixes/pending/` and stop:
```
CDD:FIX — No fix file specified.

Pending fix files:
  auth-FIX-20260215-1030              (3 issues)
  task-management-FIX-20260215-1030   (5 issues)

Usage: /cdd:fix [fix-file-name]
Example: /cdd:fix auth-FIX-20260215-1030
```

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase` is `build_cycle` or `complete`
3. Verify the fix file exists at `.cdd/fixes/pending/[name].yaml`
4. Verify the fix file `status` is `pending` (not already processed)
5. Verify the module referenced in the fix file has `status: complete` in state.yaml

**Context loaded per module:**
- Fix file (`.cdd/fixes/pending/[name].yaml`)
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

## Step 1: Load Fix File and Module Context

1. Read the fix file from `.cdd/fixes/pending/[name].yaml`
2. Read `.cdd/state.yaml` and `.cdd/config.yaml`
3. Read module contract at `.cdd/contracts/modules/[module].yaml`
4. Read `.cdd/contracts/system-invariants.yaml`
5. Read data contracts for this module's `data_ownership` tables (from `.cdd/contracts/data/*.yaml`)
6. Find and read module source files — check `.cdd/sessions/` for the latest session file listing `files_created`/`files_modified`, or use Glob based on config.yaml paths

## Step 2: Display Fix Plan

Show the issues from the fix file in a table. Proceed without waiting (this is not interactive).

```
CDD:FIX — [module-name] ([N] issues)
Batch: [batch_id]

| ID    | Severity | Category | Description                          |
|-------|----------|----------|--------------------------------------|
| FIX-2 | medium   | contract | DG-10 query param mismatch           |
| FIX-5 | medium   | bug      | Loose != comparison risks type-juggling |
| ...   | ...      | ...      | ...                                  |

Processing...
```

## Step 3: Research and Verdict Each Issue

For each issue in the fix file (ordered by severity: critical > high > medium > low):

### 3a. Research

- Read relevant code sections (specific files/functions, not everything)
- Grep for related patterns within the module's source
- Check against contract and system invariants
- Document findings

### 3b. Verdict — one of:

| Verdict | Meaning | Action |
|---------|---------|--------|
| **CONFIRMED** | Real bug, code needs to change | Fix in Step 4 |
| **FALSE_POSITIVE** | Not actually a bug | Document reasoning, no code change |
| **CONTRACT_ISSUE** | Real issue but fix requires contract change | Flag for `/cdd:contract-change`, no code change |
| **DEFERRED** | Real but too broad or risky to fix in isolation | Document scope and recommend approach |

**Verdict reasoning must be specific:**
- Reference exact file:line locations
- Quote the relevant contract clause if applicable
- Explain WHY this verdict was chosen over alternatives

## Step 4: Fix Confirmed Issues

For each issue with verdict `CONFIRMED`:

1. Apply targeted fixes using Edit/Write
2. Track all file changes (file path, lines changed, what changed)
3. Minimize blast radius — change only what's needed

**Fix rules — STRICTLY enforce:**
- Do NOT restructure unrelated code
- Do NOT change function signatures (parameter names, types, return types) — that's a contract change
- Do NOT modify code in other modules' directories
- Do NOT add new dependencies not in the contract
- If a fix would introduce a new contract violation, REVERT the fix and reclassify the issue as `DEFERRED` with explanation

## Step 5: Update Fix File

Move from pending to completed. Ensure `.cdd/fixes/completed/` directory exists (create if needed).

Write to `.cdd/fixes/completed/[name].yaml`:

```yaml
batch_id: "FIX-20260215-1030"
module: task-management
generated_at: "2026-02-15T10:30:00Z"
completed_at: "2026-02-15T11:15:00Z"
status: complete

summary:
  confirmed: 3
  false_positives: 1
  contract_issues: 0
  deferred: 1

issues:
  - id: FIX-2
    severity: medium
    category: contract
    description: "DG-10 query param mismatch (status vs include_archived)"
    verdict: CONFIRMED
    reasoning: "TaskController.php:45 uses 'status' query param but contract DG-10 specifies 'include_archived'"
    changes:
      - file: "app/Http/Controllers/TaskController.php"
        lines: "45-48"
        description: "Changed query param from 'status' to 'include_archived'"

  - id: FIX-5
    severity: medium
    category: bug
    description: "Loose != comparison risks type-juggling"
    verdict: FALSE_POSITIVE
    reasoning: "TaskManagementService.php:112 uses != but both operands are always strings from validated input"

  - id: FIX-8
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
    # Add fix metadata
    last_fix:
      date: "[ISO 8601 timestamp]"
      batch_id: "[batch_id from fix file]"
      issues_processed: [total count]
      confirmed: [count]
      false_positives: [count]
      contract_issues: [count]
      deferred: [count]
      fix_file: ".cdd/fixes/completed/[name].yaml"
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
CDD:FIX COMPLETE — [module-name]

Issues processed: [total]

| Verdict        | Count |
|----------------|-------|
| CONFIRMED      | [N]   |
| FALSE_POSITIVE | [N]   |
| CONTRACT_ISSUE | [N]   |
| DEFERRED       | [N]   |

Files modified: [N]
Fix file: .cdd/fixes/completed/[name].yaml

Module state updated:
  verified: false — needs /cdd:verify
  tested: false   — needs /cdd:test

[If any CONTRACT_ISSUE verdicts:]
  CONTRACT ISSUES: Run /cdd:contract-change to address

[If any DEFERRED verdicts:]
  DEFERRED: FIX-[N] — [description] (recommend [approach])

Next steps:
   /clear
   /cdd:verify [module]
   /clear
   /cdd:test [module]
```

</process>
</output>
