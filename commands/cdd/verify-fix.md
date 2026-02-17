---
name: cdd:verify-fix
description: Triage and resolve verify failures — targeted fix, rebuild, or contract change
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Triage a module's verify failures and resolve them through one of three paths: FIX (targeted surgery for isolated code issues), REBUILD (reset and rebuild for systemic failures), or CONTRACT CHANGE (recommend contract modification when the contract itself is wrong). This command runs in a FRESH SESSION after `/cdd:verify` has reported failures — separating the judge (verify) from the surgeon (verify-fix) to keep context clean and decisions sharp.
</objective>

<execution_context>
You are running the `cdd:verify-fix` command. This is a TRIAGE AND RESOLUTION command — it reads a verify failure report, determines the right resolution path, and executes it.

**Argument:** The user MUST provide a module name. If no argument is provided, check `.cdd/verify-failures/` for any failure reports and list them:
```
CDD:VERIFY-FIX — No module specified.

Failure reports on file:
  auth          2026-02-17T14:30:00Z   5 failures across 2 dimensions
  billing       2026-02-16T09:15:00Z   2 failures across 1 dimension

Usage: /cdd:verify-fix [module-name]
```
If no failure reports exist, say "No verify failure reports found. Run `/cdd:verify [module]` first." and stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: build_cycle`
3. Verify the module contract exists at `.cdd/contracts/modules/[module].yaml`
4. Verify the module's `verified` field is explicitly `false` (meaning `/cdd:verify` ran and failed). If `verified` is `true`, say "Module [module] already passed verification — nothing to fix." and stop. If `verified` is absent or null, say "Module [module] has not been verified yet. Run `/cdd:verify [module]` first." and stop.
5. Find the most recent failure report for this module in `.cdd/verify-failures/` — if none exists, say "No failure report found for [module]. Run `/cdd:verify [module]` first." and stop.
6. Verify the module's build is complete — this command fixes built code, not in-progress builds.

**Context loaded — DELIBERATELY MINIMAL:**
- Failure report (`.cdd/verify-failures/[module]-[timestamp].yaml`) — small, structured
- Module contract (`.cdd/contracts/modules/[module].yaml`)
- ONLY the failing source files (referenced in the failure report) — not the whole module
- System invariants (`.cdd/contracts/system-invariants.yaml`) — only if coherence failed
- Rebuild recommendation from prior attempt (`.cdd/rebuild-recommendations/[module]-*.md`) — if one exists
- Contract change recommendation from prior attempt (`.cdd/contract-change-recommendations/[module]-*.md`) — if one exists

**Context NOT loaded:**
- Other modules' source code or contracts
- Non-failing source files in this module
- Session files, planning artifacts, test files
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `build_cycle`
- Module contract exists at `.cdd/contracts/modules/[module].yaml`
- Module's `verified` field is explicitly `false` — this confirms `/cdd:verify` ran and found failures. If `verified` is `true`, the module already passed. If `verified` is absent/null, verification hasn't been run yet. Either way, stop with a clear message.
- Module build is complete

Find the most recent failure report for this module by globbing `.cdd/verify-failures/[module]-*.yaml` and selecting the newest by timestamp.

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

1. Read the failure report YAML
2. Read the module contract at `.cdd/contracts/modules/[module].yaml`
3. Read ONLY the source files referenced in the failure report's `details` entries (the `file` fields) — do NOT read the entire module
4. If `coherence_failed: true` in the failure report, read `.cdd/contracts/system-invariants.yaml`
5. Check for prior rebuild recommendation: glob `.cdd/rebuild-recommendations/[module]-*.md` — if found, read the most recent one
6. Check for prior contract change recommendation: glob `.cdd/contract-change-recommendations/[module]-*.md` — if found, read the most recent one

Display what was loaded:
```
───────────────────────────────────────────────────────────────
CDD:VERIFY-FIX — [module-name]
───────────────────────────────────────────────────────────────
Failure report: .cdd/verify-failures/[module]-[timestamp].yaml
  [N] failures across [M] dimensions
  Failed dimensions: [list]
  Coherence failed: yes/no

Files loaded for analysis:
  [file1:line]
  [file2:line]
  ...

[If prior rebuild recommendation exists:]
  Prior rebuild recommendation found — this is a repeat failure.
───────────────────────────────────────────────────────────────
```

## Step 3: Deep-Dive Analysis

For each failure in the report, analyze not just WHAT failed but WHY it failed. This is the critical step that determines the verdict.

For each failure, determine:
1. **Is this an isolated mistake?** A typo, a missing field, a wrong variable name — the surrounding code shows the developer understood the intent.
2. **Is this a pattern failure?** The same mistake repeated across multiple locations — suggests the build agent misunderstood a convention.
3. **Is this architecturally wrong?** The code structure itself doesn't match what the contract requires — not a mistake but a wrong approach.
4. **Is the contract impossible?** The code is internally consistent and well-structured but literally cannot satisfy the contract as written.

Document findings for each failure before proceeding to verdict.

## Step 4: Triage Verdict

Based on the deep-dive analysis, select ONE verdict for the entire module. Do NOT mix verdicts — the module gets one path forward.

### Decision Logic:

```
IF any prior rebuild recommendation exists for this module
   AND the current failures overlap with issues from that recommendation
   THEN → Verdict 2: REBUILD (escalation — previous fix didn't work)

ELSE IF coherence_failed: true
   OR failures span 3+ dimensions
   OR failures show a PATTERN (same mistake in multiple places)
   OR failures indicate wrong architecture (not wrong code)
   THEN → Verdict 2: REBUILD

ELSE IF the implementation is internally consistent
   AND failures are because the contract is impossible/wrong
   (e.g., assumes a dependency interface that doesn't exist,
    two requirements are mutually exclusive,
    technically impossible with the chosen stack)
   THEN → Verdict 3: CONTRACT CHANGE

ELSE (failures are isolated code errors in ≤2 dimensions,
      no coherence issues, no pattern failures)
   THEN → Verdict 1: FIX
```

Display the verdict prominently:
```
═══════════════════════════════════════════════════════════════
VERDICT: [FIX | REBUILD | CONTRACT CHANGE]
═══════════════════════════════════════════════════════════════

Rationale:
  [2-3 sentence explanation of why this verdict was chosen]

[List each failure with its classification:]
  1. [dimension] — [description]
     Classification: [isolated mistake | pattern failure | wrong architecture | impossible contract]
     Evidence: [file:line reference and brief explanation]

  2. ...
═══════════════════════════════════════════════════════════════
```

Then execute the appropriate verdict path below.

---

## Verdict 1: FIX — Targeted Surgery

**Criteria met:** Failures are isolated code errors in the original 5 dimensions (inputs, outputs, deps, events, data) or minor coherence issues. Few in number. No pattern failures. The module structure is sound.

### Step 5-FIX: Git Checkpoint

Create a safety checkpoint before modifying any files:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js verify-fix [module-name]
```

Parse the JSON output:
- If `created: true` — display checkpoint notice
- If `created: false` and `message: "not_git_repo"` — display warning: "Warning: Not a git repo — no checkpoint created. Changes cannot be rolled back." Then **ask the user** if they want to continue or abort. If user aborts, stop immediately with no changes.
- If `created: false` and `message: "no_changes"` — silent, continue
- If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue or abort.

When checkpoint is created, display:
```
───────────────────────────────────────────────────────────────
CHECKPOINT: [hash]
  To undo this fix: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

### Step 6-FIX: Apply Targeted Fixes

For each failure in the report:
1. Make the minimal code change needed to resolve the violation
2. Stay within contract bounds — do NOT change behavior beyond what's needed
3. Do NOT refactor surrounding code — surgical precision only
4. Track all changes made (file, lines, what changed)

**Rules:**
- Only modify files referenced in the failure report
- Do not add new files
- Do not modify code in other modules
- Every change must directly resolve a specific verification failure

### Step 7-FIX: Auto Re-Verify

After all fixes are applied, run the verification inline. Follow the same verification process as `/cdd:verify` (Steps 3-8 from verify.md) but within this session.

**If re-verify PASSES:**

Update `.cdd/state.yaml`:
```yaml
modules:
  [module]:
    verified: true
    verified_at: "[ISO 8601 timestamp]"
    verification_checks: [total check count]
```

Clean up the failure report — delete `.cdd/verify-failures/[module]-[timestamp].yaml`.

Display:
```
═══════════════════════════════════════════════════════════════
✅ CDD:VERIFY-FIX COMPLETE — [module-name] FIXED AND VERIFIED

   [N] fixes applied. Re-verification passed ([M] checks).

   Changes made:
     [file1:lines] — [description]
     [file2:lines] — [description]
     ...

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:test [module-name] to run tests

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

**If re-verify FAILS:**

The fix attempt uncovered deeper issues. Escalate to Verdict 2 (REBUILD). Do NOT attempt a second round of fixes — that's the "patching masks root causes" problem this command is designed to prevent.

Display:
```
═══════════════════════════════════════════════════════════════
⚠️  FIX ATTEMPT FAILED RE-VERIFICATION — Escalating to REBUILD

   Fixes applied but [N] new/remaining violations found.
   This indicates deeper issues than isolated code errors.

   Escalating to REBUILD verdict...
═══════════════════════════════════════════════════════════════
```

Then proceed to the REBUILD path (Step 5-REBUILD onward), using the combined failure information from both the original report and the re-verify.

---

## Verdict 2: REBUILD — Fresh Build Needed

**Criteria met:** Coherence failures, widespread failures across multiple dimensions, pattern failures suggesting wrong understanding, or escalation from a failed FIX attempt.

### Step 5-REBUILD: Write Rebuild Recommendation

Ensure `.cdd/rebuild-recommendations/` directory exists (create if needed).

Write to `.cdd/rebuild-recommendations/[module]-[ISO-timestamp].md`:

```markdown
# Rebuild Recommendation: [module-name]
Generated: [ISO 8601 timestamp]

## Why this module needs rebuilding

[2-3 paragraphs explaining what went wrong at a systemic level.
Not just "these checks failed" but WHY the build produced wrong code.
What did the build agent misunderstand?]

## What went wrong

[Bulleted list of specific failure patterns, grouped by theme:]
- [Theme 1]: [specific failures and their locations]
- [Theme 2]: [specific failures and their locations]
- ...

## Guidance for rebuild

[Specific instructions for the rebuild session to avoid the same mistakes:]
- [Instruction 1 — reference specific system invariants or contract clauses]
- [Instruction 2]
- ...

[If this is an escalation from a failed FIX attempt:]
## Previous fix attempt
A targeted fix was attempted but re-verification still failed.
The fix resolved [N] of [M] original failures but revealed [K] additional issues.
This confirms the problems are systemic, not isolated.

## Previous verify failure report
[path to failure report YAML]
```

### Step 6-REBUILD: Reset Module

Execute the reset logic (equivalent to `/cdd:reset` Steps 5-7):

1. Create a git checkpoint:
   ```bash
   node ~/.claude/cdd/hooks/lib/checkpoint.js verify-fix-rebuild [module-name]
   ```
   Handle output same as Step 5-FIX checkpoint.

2. Read the session file for this module (from state.yaml's `modules.[module].current_session` or `modules.[module].session_file`). If it exists, update it:
   ```yaml
   reset:
     reset_at: "[ISO 8601 timestamp]"
     reason: "Rebuild recommended by verify-fix — systemic failures"
     files_kept: false
     status: abandoned
   ```

3. Update `.cdd/state.yaml`:
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

4. Do NOT delete source files — git history has them via the checkpoint. The rebuild session should build fresh from the contract, not be tempted to copy-paste from flawed code. The source files will be overwritten by the fresh build.

### Step 7-REBUILD: Display Result

```
═══════════════════════════════════════════════════════════════
🔄 CDD:VERIFY-FIX — [module-name] → REBUILD

   Module reset to pending. Rebuild recommendation written.

   Recommendation: .cdd/rebuild-recommendations/[module]-[timestamp].md
   Checkpoint:     [hash] (git reset --hard [hash] to undo)

   The rebuild recommendation will be picked up automatically
   by /cdd:build to guide the fresh build.

───────────────────────────────────────────────────────────────
👉 Next steps:
   1. Run /clear to reset your context window
   2. Run /cdd:build [module-name] to rebuild from contract

   The build session will load the rebuild recommendation
   as guidance — it will know what went wrong last time
   without seeing the old (flawed) code.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Verdict 3: CONTRACT CHANGE — Contract Is Wrong

**Criteria met:** The implementation is internally consistent and well-structured. The code matches the spirit of the brief/plan. But it cannot satisfy the contract because the contract itself is wrong (impossible requirement, wrong dependency assumption, mutually exclusive clauses, technically infeasible).

### Step 5-CONTRACT: Write Contract Change Recommendation

Ensure `.cdd/contract-change-recommendations/` directory exists (create if needed).

Write to `.cdd/contract-change-recommendations/[module]-[ISO-timestamp].md`:

```markdown
# Contract Change Recommendation: [module-name]
Generated: [ISO 8601 timestamp]

## Why the contract needs changing

[2-3 paragraphs explaining what's wrong with the contract.
Reference specific clauses. Explain WHY it's impossible/wrong,
not just that verification failed.]

## What should change

### Option A (recommended): [brief description]
- Contract file: [path]
- Clause: [specific clause reference]
- Current: [current value/requirement]
- Proposed: [new value/requirement]
- Impact: [what this changes for consumers/dependents]

### Option B: [brief description]
- [same structure]
- Why less preferred: [explanation]

[Include as many options as are reasonable. Always recommend one.]

## Current implementation status

[Brief description of what the build produced and how it relates
to the contract change. After the contract change, will the
existing code pass verify as-is, or will it need fixes/rebuild?]

## Previous verify failure report
[path to failure report YAML]
```

### Step 6-CONTRACT: Display Result

```
═══════════════════════════════════════════════════════════════
📋 CDD:VERIFY-FIX — [module-name] → CONTRACT CHANGE

   The contract itself needs modification. Recommendation written.

   Recommendation:
     .cdd/contract-change-recommendations/[module]-[timestamp].md

   The recommendation includes [N] options for how to change
   the contract, with analysis of each option's impact.

───────────────────────────────────────────────────────────────
👉 Next steps:
   1. Review the recommendation file above
   2. Run /clear to reset your context window
   3. Run /cdd:contract-change [module-name]

   The contract-change session will pick up the recommendation
   as pre-work, reducing investigation overhead while
   maintaining the heavyweight change gate.

   After the contract change completes:
   4. Run /cdd:verify [module-name] to re-verify
      (the code may now pass, or may need fixes/rebuild)
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

Do NOT reset the module. Do NOT modify any code. The contract must change first, then re-verification determines the next step.

</process>
