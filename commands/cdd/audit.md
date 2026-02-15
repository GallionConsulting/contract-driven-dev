---
name: cdd:audit
description: Full system contract compliance check
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

<objective>
Perform a full system audit across four dimensions: system invariants, database schema, module compliance, and event wiring. This is a HEAVYWEIGHT read-mostly command that loads contracts and samples source code to detect drift, missing implementations, and broken wiring. The audit produces a comprehensive compliance report with actionable remediation steps.
</objective>

<execution_context>
You are running the `cdd:audit` command. This is a HEAVYWEIGHT ANALYSIS command — it loads significant context.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase` is `build_cycle` or `complete` — if in `planning` or `foundation`, tell the user the audit is most useful after modules are built and suggest the appropriate command for their current phase. Stop.
3. Verify at least ONE module has `status: complete` — if no modules are complete, tell the user the audit requires at least one completed module and suggest `cdd:build [module]`. Stop.

**Context loaded:**
- `.cdd/state.yaml` — full state
- `.cdd/config.yaml` — project config
- `.cdd/contracts/system-invariants.yaml` — system-wide rules
- ALL module contracts: `.cdd/contracts/modules/*.yaml`
- `.cdd/contracts/data/*.yaml` — data contracts (if they exist)
- Source code SAMPLES from each completed module (not full source — enough to verify patterns)
  - Use session files in `.cdd/sessions/` to find file paths for each module
  - Read key files: main service file, route definitions, data access layer, event emissions
  - Do NOT read every file — sample strategically

**Context NOT loaded:**
- Full source code of all modules (would blow context budget)
- Test files (not relevant for contract compliance)
- Planning artifacts (BRIEF.md, REQUIREMENTS.md, etc.)

**IMPORTANT:** This command loads a LOT of context. Always recommend `/clear` after completion.
</execution_context>

<process>

## Step 0: Check Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify:
- `phase` is `build_cycle` or `complete`
- At least one module has `status: complete`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

Count completed modules vs total modules to report audit coverage.

## Step 1: Load Contracts

Read ALL contract files:
1. `.cdd/contracts/system-invariants.yaml`
2. All files in `.cdd/contracts/modules/*.yaml`
3. All files in `.cdd/contracts/data/*.yaml` (if directory exists)
4. Check for an events registry — look for `.cdd/contracts/events-registry.yaml` or event definitions within module contracts

Build an internal map of:
- All system invariants and their rules
- All modules, their contracts, statuses, and dependencies
- All data schemas (contracted tables, columns, types)
- All events (emitters, consumers, payload shapes)

## Step 2: Dimension 1 — System Invariants

Read `.cdd/contracts/system-invariants.yaml`. For each invariant defined:

**Check across ALL completed modules** by sampling source code. Common invariants to verify:

- **Multi-tenancy strategy:** Is the tenant isolation pattern consistently applied? Check that every data access includes tenant scoping.
- **Primary key format:** Are all primary keys the contracted type (UUID, auto-increment, etc.)? Sample migration files or schema definitions.
- **External references:** Are foreign keys and cross-module references in the contracted format?
- **Audit columns:** Are `created_at`, `updated_at`, `created_by` (or whatever was contracted) present on all required tables?
- **Response format:** Do API responses follow the standard envelope format from invariants?
- **Authentication/Authorization:** Is the contracted middleware consistently applied to protected routes?
- **Error handling:** Do error responses follow the invariant format?

For each invariant, record:
- `PASS` — invariant holds across all sampled modules
- `WARN` — invariant mostly holds but minor inconsistencies found
- `FAIL` — invariant is violated in one or more modules

```
SYSTEM INVARIANTS:
  [✅|⚠️|❌] [invariant name] — [status detail]
```

## Step 3: Dimension 2 — Database Schema

For each table defined in data contracts (`.cdd/contracts/data/*.yaml`) or in module contracts' `data_ownership` sections:

**If actual database/migration files are accessible:**
- Compare contracted schema vs actual schema (migration files, ORM models, or SQL definitions)
- Flag **DRIFT**: Contract says X, actual says Y (column type mismatch, missing constraint, etc.)
- Flag **MISSING**: Contract defines a table/column that doesn't exist in code
- Flag **EXTRA**: Code defines a table/column not in any contract

**If database files are not directly accessible:**
- Check ORM models, migration files, or schema definition files found via Glob/Grep
- Compare model definitions against contracted data schemas

Use Glob to find migration/schema files:
- `**/migrations/**`
- `**/models/**`
- `**/schema/**`
- `**/entities/**`
- `**/*.prisma`, `**/*.sql`, etc. (based on config.yaml tech stack)

For each table, record:
- `PASS` — contracted schema matches implementation
- `DRIFT` — mismatch between contract and implementation (detail what differs)
- `MISSING` — contracted but not implemented
- `EXTRA` — implemented but not contracted

```
DATABASE SCHEMA:
  [✅|⚠️|❌] [table name] — [status / drift details]
```

## Step 4: Dimension 3 — Module Compliance

For each COMPLETED module (status: `complete` in state.yaml):

Perform a LIGHTWEIGHT compliance check (lighter than `cdd:verify` — sample-based, not exhaustive):

1. **Naming check:** Do exported function/class names match contracted `provides.functions` names?
   - Use Grep to search for function definitions matching contracted names
   - Flag any contracted function that cannot be found

2. **Data access check:** Does the module respect data ownership and column visibility?
   - Grep for table names, model references, or query patterns in the module's source
   - Flag any WRITE to a table not in `data_ownership.writes` (strict violation)
   - Flag any READ from a table not declared in `data_ownership.reads` or `data_ownership.owns` (undeclared dependency — warning)
   - For non-owned standard table reads: spot-check that accessed columns are in the module's declared `columns` list (which must be public)
   - Do NOT flag framework-native read patterns (ORM relationships, joins, eager loading) for declared tables/columns — direct reads are allowed

3. **Dependency check:** Does the module import from its declared dependencies only?
   - Check import/require statements for references to other modules
   - Flag imports from modules not listed in `requires.from_modules`

4. **Completeness check:** Are all contracted `provides.functions` implemented?
   - For each function in the contract's `provides`, verify it exists in source

For each module, record:
- `PASS` — all spot checks pass
- `WARN` — minor issues found (naming inconsistencies, extra imports)
- `FAIL` — significant contract violations (missing functions, undeclared data access)

```
MODULE COMPLIANCE:
  [✅|⚠️|❌] [module name] — [status / issues found]
```

For modules that are NOT complete, display:
```
  ⏭️ [module name] — skipped (status: [pending|in_progress|failed])
```

## Step 5: Dimension 4 — Event Wiring

Collect all events from:
- Module contracts' `provides.events_emitted` sections
- Module contracts' `provides.events_consumed` sections
- The events registry file if one exists (`.cdd/contracts/events-registry.yaml`)

For each event:

1. **Verify emitter:** The module that declares `events_emitted: [event]` actually emits it in source code
   - Grep the emitter module's source for the event name
   - Flag if event is contracted but never emitted

2. **Verify consumers:** Every module that declares it consumes the event actually has a handler
   - Grep consumer module source for the event name or handler pattern
   - Flag if consumption is declared but no handler found

3. **Check for orphans:** Events emitted but with zero consumers declared
   - These are warnings, not failures (may be consumed by external systems)

4. **Check for broken wiring:** Consumer expects an event that no module declares as emitted
   - This is a FAIL — indicates a contract inconsistency

For each event, record:
- `PASS` — emitter emits, all consumers consume
- `WARN` — orphaned event (emitted but no consumers) or consumer not yet built
- `FAIL` — broken wiring (consumer expects event no one emits) or emitter doesn't emit

```
EVENT WIRING:
  [✅|⚠️|❌] [event name] — [emitter] → [consumers] — [status]
```

If NO events are defined in any contract, display:
```
EVENT WIRING:
  (no events defined in contracts — skipped)
```

## Step 6: Generate Audit Report

Compile all results into the final report:

```
═══════════════════════════════════════════════════════════════
FULL SYSTEM AUDIT — [project_name]
═══════════════════════════════════════════════════════════════
Audit date: [YYYY-MM-DD]
Modules audited: [completed_count]/[total_count]
Coverage: [percentage]%

───────────────────────────────────────────────────────────────
SYSTEM INVARIANTS
───────────────────────────────────────────────────────────────
  [✅|⚠️|❌] [invariant] — [status]
  ...

  Result: [N] checked, [P] pass, [W] warnings, [F] failures

───────────────────────────────────────────────────────────────
DATABASE SCHEMA
───────────────────────────────────────────────────────────────
  [✅|⚠️|❌] [table] — [status / drift details]
  ...

  Result: [N] checked, [P] pass, [D] drift, [M] missing, [E] extra

───────────────────────────────────────────────────────────────
MODULE COMPLIANCE
───────────────────────────────────────────────────────────────
  [✅|⚠️|❌|⏭️] [module] — [status / issues]
  ...

  Result: [N] audited, [S] skipped, [P] pass, [W] warnings, [F] failures

───────────────────────────────────────────────────────────────
EVENT WIRING
───────────────────────────────────────────────────────────────
  [✅|⚠️|❌] [event] — [emitter] → [consumers] — [status]
  ...

  Result: [N] checked, [P] pass, [O] orphaned, [B] broken

═══════════════════════════════════════════════════════════════
AUDIT RESULT: [✅ ALL CLEAR | ⚠️ ISSUES FOUND (N) | ❌ FAILURES (N)]
═══════════════════════════════════════════════════════════════
```

## Step 7: Recommended Actions

Based on audit findings, generate specific, actionable remediation steps:

**If ALL CLEAR:**
```
═══════════════════════════════════════════════════════════════
✅ AUDIT PASSED — No issues found.

   All [N] completed modules comply with their contracts.
   System invariants hold across all modules.
   [If all modules complete:] Project is ready for deployment.
   [If some modules pending:] Continue building remaining modules.

───────────────────────────────────────────────────────────────
👉 Recommended next steps:
   [If all modules complete:]
   • Project is fully audited and ready for integration testing
   [If modules remain:]
   • Continue with /cdd:build [next-module]
   • Re-run /cdd:audit after all modules are complete

   1. Run /clear to reset your context window (audit loads
      significant context)

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

**If ISSUES FOUND:**
```
═══════════════════════════════════════════════════════════════
Recommended actions:
───────────────────────────────────────────────────────────────
[Number each action:]
1. [specific action — e.g., "Fix tenant scoping in grid-ui service layer"]
   → Command: /cdd:build grid-ui (to remediate)

2. [specific action — e.g., "Add missing created_by column to imports table"]
   → Command: /cdd:contract-change (if contract needs updating)
   → Or fix the migration directly (if contract is correct)

3. [specific action]
   → Command: [relevant cdd command]

...

Priority: Address ❌ failures first, then ⚠️ warnings.
───────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────
👉 Next step:
   1. Run /clear to reset your context window
   2. Address the highest-priority issue listed above

   /clear is STRONGLY recommended — this audit loaded
   significant context into your session.

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

## Step 8: Update State (Optional)

If the audit was run when ALL modules are complete (full audit), record the audit in state.yaml:

```yaml
last_audit:
  date: "[YYYY-MM-DD]"
  modules_audited: [count]
  total_checks: [count]
  pass: [count]
  warnings: [count]
  failures: [count]
  result: "[ALL_CLEAR|ISSUES_FOUND|FAILURES]"
```

If the audit was partial (not all modules complete), note it but do NOT overwrite a previous full audit result.

</process>
