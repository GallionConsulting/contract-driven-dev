---
name: cdd:contract-change
description: Formally request a contract modification (intentionally heavyweight)
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Formally modify a locked contract through a 5-step change process: identify the change, classify the root cause, analyze impact on built/pending modules, plan remediation, and log the change. This process is INTENTIONALLY HEAVYWEIGHT — friction is proportional to impact. Every entry in the change log represents a planning failure, and the process enforces reflection on why it happened and how to prevent it.
</objective>

<execution_context>
You are running the `cdd:contract-change` command. This is a GOVERNANCE command — it controls contract modifications after lock.

**Note:** Users may arrive here via a `CONTRACT_CHANGE_REQUIRED` verdict from `/cdd:change`. If so, check `.cdd/changes/completed/` for prior research context — the change file will contain detailed analysis of which contract clause is affected, why, and suggested changes. Use this context to pre-populate the change request.

**Note:** Users may also arrive here via a `CONTRACT_CHANGE` verdict from `/cdd:verify-fix`. If so, check `.cdd/contract-change-recommendations/` for files matching `[module]-*.md`. If found, read the most recent one — it contains detailed analysis of why the contract needs changing, what should change (with options), and the previous verify failure report reference. Use this to pre-populate the change request in Step 1, reducing the investigation overhead while maintaining the full heavyweight gate.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `planning.contract.locked: true` — if not, tell the user contracts are not yet locked. They can still edit contracts freely before running `cdd:contract`. Suggest running `cdd:contract` to finalize contracts first. Stop.
3. Verify `phase` is `foundation` or `build_cycle` or `complete` — contract changes only make sense after contracts are locked

**Context loaded:**
- `.cdd/state.yaml` — full state file (to know which modules are built, in_progress, pending)
- `.cdd/config.yaml` — project name
- ALL module contracts in `.cdd/contracts/modules/*.yaml` — needed for impact analysis
- `.cdd/contracts/system-invariants.yaml` — if the change targets system invariants
- `.cdd/contracts/CHANGE-LOG.md` — to append the new entry
- `.cdd/changes/outstanding-contract-changes.yaml` — to clear resolved items

**Context NOT loaded:**
- Source code files (not needed for contract changes)
- Session files
- BRIEF.md, REQUIREMENTS.md, MODULES.md (planning artifacts)
</execution_context>

<process>

## Step 1: Identify the Change

Ask the user to specify the change. Gather:

1. **Which contract file?** (e.g., `.cdd/contracts/modules/records.yaml`, `.cdd/contracts/system-invariants.yaml`)
2. **Which field?** (e.g., `requires.from_url_params.tableId.type`, `provides.functions.getRecord.returns`)
3. **Current value?** — Read the contract file and display the current value
4. **Proposed new value?** — Ask what it should be changed to

Display the before/after clearly:

```
───────────────────────────────────────────────────────────────
PROPOSED CHANGE
───────────────────────────────────────────────────────────────
File:  [contract file path]
Field: [YAML path to field]

BEFORE:
  [current YAML snippet with surrounding context]

AFTER:
  [proposed YAML snippet with surrounding context]
───────────────────────────────────────────────────────────────
```

If the user hasn't provided enough specifics, ask clarifying questions. Do NOT proceed until the exact change is identified.

## Step 2: Root Cause Classification

Ask the user WHY this wasn't caught during the `cdd:contract` phase. Present these options:

1. **Missing requirement** — we didn't know this was needed during planning
2. **Requirement misunderstood** — we thought X but actually Y
3. **Technical constraint discovered** — only found during implementation
4. **Scope change** — new feature or capability being added
5. **Other** — ask user to explain

Record the classification AND ask the user to provide a one-sentence explanation of the specific root cause.

Display:
```
Classification: [selected option]
Root cause: [user's explanation]
```

## Step 3: Impact Analysis

Read ALL module contracts from `.cdd/contracts/modules/*.yaml`. For each module:
1. Search the entire contract YAML for references to the changed field, value, or related identifiers
2. Cross-reference with `state.yaml` to determine each module's current status

Categorize affected modules:

**ALREADY BUILT modules** (status: `complete`, `in_progress`, or `failed` with prior build work) that reference the changed field:
- These require REMEDIATION — code has already been written against the old contract
- Mark with ❌ REMEDIATION REQUIRED

**NOT YET BUILT modules** (status: `pending`) that reference the changed field:
- These will automatically use the new contract value when built
- Mark with ⚠️ Will use new contract

**Unaffected modules** — do not list these.

**Public column / public table impact rules:**
- When a column marked `public: true` is being **removed or modified**: automatically flag ALL modules that list this column in their `data_ownership.reads.columns` as affected.
- When a column's `public` status is being **removed** (public → private): this is a breaking change for all consuming modules. Classify as HEAVY regardless of count.
- When a new column is being **added** as `public: true`: this is additive and typically LIGHT (no existing consumers affected).
- When a table's `public_table` status is being removed or a module is removed from `writers`: flag all affected reader/writer modules.

Classify the change weight:
- **LIGHT** — 0 built modules affected (simple contract update, no code changes needed)
- **MEDIUM** — 1 built module affected (targeted remediation)
- **HEAVY** — 2+ built modules affected, OR any public→private column change (significant remediation effort)

Display:
```
───────────────────────────────────────────────────────────────
IMPACT ANALYSIS
───────────────────────────────────────────────────────────────
Change weight: [LIGHT|MEDIUM|HEAVY]

[If any ALREADY BUILT modules affected:]
❌ REMEDIATION REQUIRED:
  - [module-name] (status: [status]) — [how it's affected]
  - ...

[If any NOT YET BUILT modules affected:]
⚠️ WILL USE NEW CONTRACT:
  - [module-name] (status: pending) — [how it references the field]
  - ...

[If no modules affected:]
No modules reference the changed field.

Total affected: [N] modules ([M] requiring remediation)
───────────────────────────────────────────────────────────────
```

## Step 4: Remediation Plan

**If change weight is LIGHT** (no built modules affected):
- Display: "No remediation needed — no built modules are affected by this change."
- Skip to Step 5.

**If change weight is MEDIUM or HEAVY:**
For each already-built module that's affected, describe:
- What specifically needs to change in the implementation
- Which files/layers are likely impacted (service, data access, routes, tests)
- Estimated sessions needed for remediation (1 session = 1 module rebuild/fix)

Display:
```
───────────────────────────────────────────────────────────────
REMEDIATION PLAN
───────────────────────────────────────────────────────────────
[For each affected built module:]

[module-name]:
  Impact: [what needs to change in the code]
  Layers: [service|data|routes|tests affected]
  Estimated effort: [N] session(s)

Total remediation: [N] session(s) across [M] module(s)
───────────────────────────────────────────────────────────────
```

## Step 5: Root Cause Prevention

Ask the user: **"What process change would prevent this kind of contract change in future projects?"**

This is not optional — the answer is logged. It improves future CDD usage by building institutional knowledge about what gets missed during planning.

Examples of good prevention answers:
- "During contract phase, verify parameter types against actual frontend routes"
- "Add a technical spike step before contracts to validate assumptions"
- "Include the database team in contract reviews"

Record their answer.

## Approval Gate

Display the full change request summary:

```
═══════════════════════════════════════════════════════════════
CONTRACT CHANGE REQUEST SUMMARY
═══════════════════════════════════════════════════════════════

File:           [contract file path]
Field:          [YAML path]
From:           [old value]
To:             [new value]

Classification: [root cause type]
Root cause:     [user's explanation]

Change weight:  [LIGHT|MEDIUM|HEAVY]
Affected:       [N] module(s) ([M] requiring remediation)

[If remediation needed:]
Remediation:    [N] estimated session(s)

Prevention:     [user's prevention answer]

═══════════════════════════════════════════════════════════════
```

Ask the user to type **APPROVE** or **CANCEL**.

**On APPROVE:**

0. **Git Checkpoint** — Create a safety checkpoint before modifying contracts:
   ```bash
   node ~/.claude/cdd/hooks/lib/checkpoint.js contract-change [contract-file-name]
   ```
   - If `created: true`, display: "CHECKPOINT: [hash] — To undo: git reset --hard [hash]"
   - If `created: false` and `message: "not_git_repo"` — display warning: "⚠ Not a git repo — no checkpoint created. Changes cannot be rolled back. Consider running `git init` first." Then **ask the user** if they want to continue without rollback capability or abort. If user aborts, stop immediately with no changes.
   - If `created: false` and `message: "no_changes"` — silent, continue
   - If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue without a checkpoint or abort.

1. **Modify the contract file** — Read the contract YAML, apply the change, write back
2. **Update contract version** — If the contract has a `version` field, increment it. If not, add `version: 2` (or increment from current)
3. **Log to CHANGE-LOG.md** — Append a formatted entry to `.cdd/contracts/CHANGE-LOG.md`:

```markdown
## Change #[N] — [YYYY-MM-DD]
- **File:** [contract file path]
- **Field:** [YAML path to field]
- **From:** [old value] → **To:** [new value]
- **Reason:** [Classification] — [user's root cause explanation]
- **Classification:** [root cause type]
- **Weight:** [LIGHT|MEDIUM|HEAVY] ([N] built modules affected)
- **Affected Modules:** [list of affected modules with their status]
- **Remediation:** [remediation summary or "None required"]
- **Prevention:** [user's prevention answer]
```

4. **Update state.yaml** — Add to the `contract_changes` list:
```yaml
contract_changes:
  - date: "[YYYY-MM-DD]"
    file: "[contract file]"
    field: "[YAML path]"
    weight: "[LIGHT|MEDIUM|HEAVY]"
    affected_modules: [list]
    remediation_modules: [list of built modules needing remediation]
```

5. **If built modules are affected** — Set their status to `failed` in `state.yaml` (they need remediation rebuild):
```yaml
modules:
  [affected-module]:
    status: failed
    failure_reason: "Contract change #[N] — requires remediation"
    verified: false
    tested: false
```

6. **Clear Outstanding Tracking:**
   After applying the contract change and updating state.yaml:
   - Read `.cdd/changes/outstanding-contract-changes.yaml` (if it exists)
   - Remove any entries where `contract_file` matches the file just changed AND the change addresses the `contract_clause` listed
   - If the outstanding list is now empty, delete the file
   - If entries remain, write the updated file back

7. **Display confirmation:**
```
═══════════════════════════════════════════════════════════════
✅ CONTRACT CHANGE #[N] APPLIED

   Contract updated: [file]
   Change logged to: .cdd/contracts/CHANGE-LOG.md

   [If remediation needed:]
   ❌ [N] module(s) marked as FAILED (need remediation):
      - [module-name] → run cdd:build [module-name] to remediate
      - ...

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   [If remediation needed:]
   2. Then run /cdd:build [first-remediation-module] to
      start remediation

   [If no remediation needed:]
   2. Continue with your current workflow

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

**On CANCEL:**

Make NO changes to any files. Display:
```
═══════════════════════════════════════════════════════════════
CANCELLED — No changes made.

───────────────────────────────────────────────────────────────
👉 Alternatives:
   • Adapt the implementation to work within the current
     contract (if the contract is technically correct)
   • Investigate further before requesting the change
     (if you're not sure this is the right fix)
   • Run /cdd:status to see project state
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
