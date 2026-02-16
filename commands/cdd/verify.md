---
name: cdd:verify
description: Verify module implementation matches its contract
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

<objective>
Perform an AI-assisted contract verification of a module's implementation. This is NOT automated type checking — it is a thorough review comparing the actual code against the locked contract across five dimensions: inputs, outputs, dependency calls, events, and data access. Any violation is flagged with specific file references.
</objective>

<execution_context>
You are running the `cdd:verify` command. This verifies that implemented code matches the contracted interfaces.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and display all modules with their build/verify status, highlighting any that are ready to verify (build complete but not yet verified). Then stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: build_cycle`
3. Verify the module contract exists at `.cdd/contracts/modules/[module].yaml`
4. Verify the module's build is complete — check `modules.[module].build_status: complete` OR `modules.[module].status: in_progress` with all progress layers complete. If the build is not complete, tell the user to finish building first with `cdd:build [module]` or `cdd:resume`.

**Context loaded:**
- Module contract (`.cdd/contracts/modules/[module].yaml`) — full contract
- System invariants (`.cdd/contracts/system-invariants.yaml`)
- Data contracts for tables this module owns or reads (from `.cdd/contracts/data/*.yaml`) — needed for data access verification
- All implemented source files for this module
- Session file for the most recent build session (to find file paths)
- `.cdd/changes/outstanding-contract-changes.yaml` — to warn about unresolved contract changes

**Context NOT loaded:**
- Other modules' source code
- Other modules' contracts (except `provides` sections if needed for dependency call verification)
- Data contracts for tables not in this module's `data_ownership`
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `build_cycle`
- Module contract exists at `.cdd/contracts/modules/[module].yaml`
- Module build is complete (check progress fields or build_status)

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

1. Read the full module contract at `.cdd/contracts/modules/[module].yaml`
2. Read `.cdd/contracts/system-invariants.yaml`
3. Find the most recent session file for this module in `.cdd/sessions/` — read it to get the list of `files_created` and `files_modified`
4. Read ALL source files listed in the session file
5. If no session file exists, use Glob/Grep to find the module's source files based on config.yaml paths and the module name
6. Read `.cdd/changes/outstanding-contract-changes.yaml` (if it exists) and filter for entries matching this module

## Step 2b: Outstanding Contract Change Warning

If any entries in outstanding-contract-changes.yaml match this module:

Display a prominent warning (do NOT block verification):

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  OUTSTANDING CONTRACT CHANGES for [module]           │
│                                                         │
│ This module has [N] unresolved contract change(s):      │
│   • [description] → [next_step]                         │
│                                                         │
│ Verification will proceed against the CURRENT contract. │
│ Results may include violations that would be resolved   │
│ by the pending contract change.                         │
└─────────────────────────────────────────────────────────┘
```

Continue with verification. Do NOT block — the user may want to
verify first to understand the full picture before deciding on
the contract change.

## Step 3: Verification — Inputs

Check every entry in the module contract's `requires` section against the actual code.

**Check `requires.from_middleware`:**
- Every middleware-provided value (userId, tenantId, etc.) is actually accessed in the code
- The types match (e.g., if contract says userId is uuid, verify it's treated as uuid not integer)

**Check `requires.from_modules`:**
- Every dependency function listed is actually imported/called in the code
- The parameters passed match the contracted types

**Check `requires.from_shared`:**
- Every shared service method listed is actually called in the code
- The parameters passed match the contracted types

**Check `requires.url_params` (if applicable):**
- Every URL parameter listed is actually extracted and used
- Types match (uuid vs slug vs integer)

Record each check as PASS or FAIL with file:line reference.

## Step 4: Verification — Outputs

Check every entry in the module contract's `provides` section against the actual code.

**Check `provides.functions`:**
- Every function listed in the contract exists in the implementation
- Function signatures match: parameter names, parameter types, return types
- Return values match the contracted output shapes
- No contracted functions are missing

**Check API responses (if routes exist):**
- Response shapes match the contracted output structures
- HTTP status codes match conventions from system invariants
- Error responses follow the system invariants' error format

Record each check as PASS or FAIL with file:line reference.

## Step 5: Verification — Dependency Calls

For each entry in `requires.from_modules`:
- Verify the dependency function is actually called somewhere in the code
- Verify it's called with the correct parameter types
- Verify the return value is used correctly (matching the dependency's `provides` specification)

If needed, read the `provides` section of the dependency module's contract to cross-reference.

Record each check as PASS or FAIL with file:line reference.

## Step 6: Verification — Events

Check every entry in the module contract's `provides.events_emitted` section:
- Every contracted event IS emitted somewhere in the code
- The emission point is logical (e.g., after a successful create/update/delete)
- The payload shape matches the contracted schema (field names, types)
- NO un-contracted events are emitted (no extra events beyond what the contract specifies)

If the module has no `events_emitted`, skip this step and mark as N/A.

Record each check as PASS or FAIL with file:line reference.

## Step 7: Verification — Data Access

Check the module's data access against the `data_ownership` section of the contract.

**CDD data access policy: reads are contracted to public columns, writes are enforced.**
- Reads use framework-native patterns (ORM, query builder, relationships) — this is expected and correct. Verify reads are *declared* and respect column visibility.
- Writes are strictly enforced through ownership and public table writer declarations.

**Reads (public columns declared, direct access allowed):**
- Identify all database read operations (queries, ORM calls, relationship loads, joins) in the code
- Every table/model accessed for reads MUST be declared in `data_ownership.reads` or `data_ownership.owns`
- For non-owned standard tables: verify the module only accesses columns listed in its `data_ownership.reads.columns` (which must all be public). Flag access to undeclared or private columns as a contract violation.
- For public tables: all column access is allowed (all columns public)
- For owned tables: all column access is allowed
- Do NOT flag framework-native read patterns (eager loading, joins, relationship accessors) as violations — these are expected for declared tables

**Writes (strictly enforced):**
- Identify all database write operations (inserts, updates, deletes) in the code
- Every write MUST target a table in `data_ownership.writes`
- `data_ownership.writes` may include: (a) tables from `owns`, (b) public tables where this module is a declared writer
- Flag ANY write to a table not meeting these criteria as a strict violation

**Undeclared access:**
- Check that the module does NOT access (read or write) any table that appears nowhere in its `data_ownership` section
- An undeclared read is a missing contract entry (flag as warning — fix by adding to `data_ownership.reads`)
- An undeclared write to a non-owned, non-public table is a design violation (flag as critical failure)
- Access to a private column on a non-owned table is a contract violation (flag as failure)

Record each check as PASS or FAIL with file:line reference.

## Step 8: Generate Verification Report

Compile all results into a structured report:

```
═══════════════════════════════════════════════════════════════
CONTRACT VERIFICATION — [module-name]
═══════════════════════════════════════════════════════════════

| Dimension        | Checks | Pass | Fail | Status |
|------------------|--------|------|------|--------|
| Inputs           |   [n]  | [n]  | [n]  | ✅/❌  |
| Outputs          |   [n]  | [n]  | [n]  | ✅/❌  |
| Dependency Calls |   [n]  | [n]  | [n]  | ✅/❌  |
| Events           |   [n]  | [n]  | [n]  | ✅/❌  |
| Data Access      |   [n]  | [n]  | [n]  | ✅/❌  |
|------------------|--------|------|------|--------|
| TOTAL            |   [n]  | [n]  | [n]  | ✅/❌  |

[If any failures, list them:]
───────────────────────────────────────────────────────────────
VIOLATIONS FOUND
───────────────────────────────────────────────────────────────
1. [dimension] — [description]
   Contract: [what the contract specifies]
   Actual: [what the code does]
   Location: [file:line]
   Severity: [critical/warning]

2. ...
═══════════════════════════════════════════════════════════════
```

## Step 9: State Update and Next Steps

**If ALL PASS:**

Read `.cdd/state.yaml` and update:
```yaml
modules:
  [module]:
    verified: true
    verified_at: "[ISO 8601 timestamp]"
    verification_checks: [total check count]
```

Display footer:
```
═══════════════════════════════════════════════════════════════
✅ CDD:VERIFY COMPLETE — [module-name] PASSED

   All [N] checks passed across 5 verification dimensions.
   Module is verified and ready for testing.

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:test [module-name] to run tests

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

**If ANY FAIL:**

Do NOT update `verified` to true. Display:
```
═══════════════════════════════════════════════════════════════
❌ CDD:VERIFY — [module-name] FAILED

   [N] violations found out of [total] checks.

   Violations listed above with file:line references.

───────────────────────────────────────────────────────────────
👉 Options:
   • Fix the implementation to match the contract
     (if the code is wrong)
   • Run /cdd:contract-change to update the contract
     (if the contract is wrong)

   After fixing, run /cdd:verify [module-name] again.

   If context is getting large, run /clear first then
   /cdd:resume to reload with fresh context.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

If violations are minor and context budget is under 30% used, offer to fix them now:
"These violations appear minor and context is still low. Would you like me to fix them now, or would you prefer to /clear and address them in a fresh session?"

</process>
