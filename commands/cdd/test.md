---
name: cdd:test
description: Generate and run tests for a verified module, then mark it complete
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Generate and run tests for a verified module. Tests are derived from the module's locked contract — every `provides.functions` entry gets tested for expected inputs/outputs, edge cases, and data access patterns. If tests already exist, run them first. If they don't exist, generate them from the contract before running.
</objective>

<execution_context>
You are running the `cdd:test` command. This generates contract-derived tests and runs them.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and display all modules with their verify/test status, highlighting any that are ready to test (verified but not yet tested). Then stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: build_cycle`
3. Verify the module contract exists at `.cdd/contracts/modules/[module].yaml`
4. Verify `modules.[module].verified: true` — if not, tell the user to run `cdd:verify [module]` first

**Context loaded:**
- Module contract (`.cdd/contracts/modules/[module].yaml`) — for understanding expected behavior
- Module source files — for writing and running tests
- `.cdd/config.yaml` — for test framework, paths, and test runner command
- System invariants — for response format conventions
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `build_cycle`
- Module contract exists
- `modules.[module].verified` is `true`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

1. Read the module contract at `.cdd/contracts/modules/[module].yaml`
2. Read `.cdd/config.yaml` for test configuration (test framework, test paths, test runner command)
3. Read `.cdd/contracts/system-invariants.yaml` for response format conventions
4. Find and read the module's source files (from session file or by Glob)
5. Check if tests already exist for this module (Glob for test files matching the module name in the test directory)

## Step 3: Check for Existing Tests

Search for existing test files for this module:
- Use Glob with patterns like `**/test*[module]*`, `**/*[module]*test*`, `**/*[module]*.spec.*`, `**/*[module]*.test.*`
- Also check the test path from `config.yaml` if specified

**If tests exist:**
- Read them to understand coverage
- Run them first (Step 4)
- Then check if they cover all contracted interfaces (Step 5)
- Generate additional tests for any uncovered contract items

**If no tests exist:**
- Skip to Step 5 to generate tests from scratch

## Step 4: Run Existing Tests

If tests exist, run them using the test runner from `config.yaml`:
- Common runners: `npm test`, `npx jest`, `php artisan test`, `pytest`, `go test`, `cargo test`
- Run ONLY the tests for this module, not the entire test suite
- Capture output

**If all pass:** Note the passing count and proceed to coverage check (Step 5)
**If any fail:** Report failures and stop — do not generate more tests until existing ones pass

## Step 4.5: Git Checkpoint

Create a safety checkpoint before generating test files:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js test [module-name]
```

Parse the JSON output:
- If `created: true` — display checkpoint notice
- If `created: false` and `message: "not_git_repo"` — display warning: "⚠ Not a git repo — no checkpoint created. Changes cannot be rolled back. Consider running `git init` first." Then **ask the user** if they want to continue without rollback capability or abort. If user aborts, stop immediately with no changes.
- If `created: false` and `message: "no_changes"` — silent, continue
- If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue without a checkpoint or abort.

When checkpoint is created, display:
```
───────────────────────────────────────────────────────────────
CHECKPOINT: [hash]
  To undo this test generation: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

## Step 5: Generate Contract-Derived Tests

For each entry in the module contract, generate appropriate tests. Follow the test framework conventions from `config.yaml`.

**5a. Function tests (from `provides.functions`):**

For each function in `provides.functions`:

- **Happy path test:** Call the function with valid inputs matching the contract's parameter types. Assert the return value matches the contracted return type and shape.

- **Input validation tests:** Test with:
  - Missing required parameters
  - Wrong types (string where number expected, etc.)
  - Null/undefined values
  - Empty strings, zero values, negative numbers (where applicable)

- **Edge case tests:** Based on the function's semantics:
  - List functions: test with empty results, single result, multiple results
  - Create functions: test duplicate handling (if contract implies uniqueness)
  - Update functions: test with non-existent IDs
  - Delete functions: test with non-existent IDs

**5b. Data access tests (from `data_ownership`):**

- For each table in `data_ownership.writes`: test that create/update/delete operations affect the correct table
- For read operations: test that queries return data in the expected shape
- Test that the module does NOT write to tables outside its `data_ownership.writes`

**5c. Event tests (from `events_emitted`, if applicable):**

- For each event: test that the event is emitted when the triggering action occurs
- Test that the event payload matches the contracted schema
- Test that events are NOT emitted on failure cases

**5d. API route tests (if applicable):**

- For each contracted endpoint: test the HTTP method, path, expected status codes
- Test authentication requirements (authenticated vs public routes)
- Test request validation (invalid inputs should return proper error responses matching system invariants)
- Test response shapes match the contracted output

**Test file naming and location:**
- Follow the project's test conventions from `config.yaml`
- Common patterns: `tests/[module].test.js`, `tests/Unit/[Module]Test.php`, `tests/test_[module].py`
- Place tests alongside the source files or in the designated test directory, matching the project's pattern

## Step 6: Run All Tests

Run the full test suite for this module (existing + newly generated):
- Use the test runner command from `config.yaml`
- Run ONLY this module's tests
- Capture full output

Display results:
```
═══════════════════════════════════════════════════════════════
TEST RESULTS — [module-name]
═══════════════════════════════════════════════════════════════

Tests run: [total]
  ✅ Passed: [count]
  ❌ Failed: [count]
  ⏭️ Skipped: [count]

Coverage:
  Functions tested: [N/total] from provides.functions
  Data access tested: [N/total] tables
  Events tested: [N/total] from events_emitted
  Routes tested: [N/total] endpoints

[If any failures, list them:]
───────────────────────────────────────────────────────────────
FAILURES
───────────────────────────────────────────────────────────────
1. [test name]
   Expected: [expected]
   Actual: [actual]
   File: [test-file:line]

2. ...
═══════════════════════════════════════════════════════════════
```

## Step 7: State Update and Next Steps

**If ALL PASS:**

Read `.cdd/state.yaml` and update:
```yaml
modules:
  [module]:
    tested: true
    tested_at: "[ISO 8601 timestamp]"
    test_count: [number of tests]
    test_file: "[path to test file]"
    status: complete
    build_completed: "[ISO 8601 timestamp]"
```

Then proceed to Step 8 (Module Completion).

**If ANY FAIL:**

Do NOT update `tested` to true. Display:
```
═══════════════════════════════════════════════════════════════
❌ CDD:TEST — [module-name] FAILURES DETECTED

   [N] tests failed out of [total].

   Failures listed above with details.

───────────────────────────────────────────────────────────────
👉 Options:
   • Fix the implementation to make tests pass
     (if the code has bugs)
   • Fix the tests if they don't match the contract
     (if the tests are wrong)
   • Run /cdd:contract-change if the contract itself is wrong

   After fixing, run /cdd:test [module-name] again.

   If context is getting large, run /clear first then
   /cdd:resume to reload with fresh context.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

If failures are minor (e.g., simple assertion mismatches) and context budget is under 30% used, offer to fix them now:
"These failures appear to be minor implementation bugs. Context is still low. Would you like me to fix the code and re-run tests now?"

Stop here — do NOT proceed to Step 8.

## Step 8: Module Completion

This step runs automatically when all tests pass. It marks the module complete, identifies newly unblocked modules, and shows progress.

### 8a. Identify Newly Unblocked Modules

Scan ALL module contracts in `.cdd/contracts/modules/` — read ONLY the `blocked_by` field of each.

For each module that is NOT yet complete:
1. Read its `blocked_by` list
2. Check if every module in that list now has `status: complete` in state.yaml
3. If YES — this module is now unblocked and ready to build

Compile the list of newly unblocked modules (those that were blocked before this completion but are now fully unblocked).

### 8b. Identify Parallel-Eligible Modules

From the newly unblocked modules (and any previously unblocked but not-yet-started modules):
- Check the `parallel_groups` in state.yaml
- Identify modules that can be built simultaneously (same parallel group, all dependencies met)

### 8c. Calculate Progress

Count:
- `total_modules`: total number of modules in state.yaml
- `completed_modules`: modules with `status: complete`
- `in_progress_modules`: modules with `status: in_progress`
- `pending_modules`: modules with `status: pending`
- `failed_modules`: modules with `status: failed`

Calculate percentage: `completed_modules / total_modules * 100`

### 8d. Check if ALL Modules Complete

If ALL modules have `status: complete` AND `tested: true`:
- This is the final module! Update state:
```yaml
phase: complete
completed_at: "[ISO 8601 timestamp]"
```
- Display the all-complete message (see 8f below)
- Stop.

### 8e. Display Completion Report

```
═══════════════════════════════════════════════════════════════
✅ CDD:TEST COMPLETE — [module-name] ALL TESTS PASSED
═══════════════════════════════════════════════════════════════

   [N] tests passed covering [functions/events/routes/data].
   Module marked complete.

Progress: [completed]/[total] modules ([percentage]%)

[Progress bar visualization:]
[████████████░░░░░░░░] 60%

───────────────────────────────────────────────────────────────
NEWLY UNBLOCKED
───────────────────────────────────────────────────────────────
[For each newly unblocked module:]
  🔓 [module-name] — ready to build
     Dependencies: [list, all ✅]

[If no newly unblocked modules:]
  No new modules unblocked by this completion.

───────────────────────────────────────────────────────────────
PARALLEL ELIGIBLE
───────────────────────────────────────────────────────────────
[If multiple modules can be built simultaneously:]
  These modules can be built in parallel (independent):
  - [module-a]
  - [module-b]

[If only one module is next:]
  Next in sequence: [module-name]

───────────────────────────────────────────────────────────────
ALL MODULES
───────────────────────────────────────────────────────────────
[For each module in build_order:]
  [✅|🔨|⏸️|❌|🔒] [module-name] — [complete|in_progress|pending|failed|blocked]

Legend: ✅ complete  🔨 in progress  ⏸️ ready  ❌ failed  🔒 blocked

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:build [recommended-module] to build
      the next module

   ⚠️ /cdd:build needs Opus — switch with /model
      if you're on Sonnet.

   [If parallel eligible:]
   Parallel option: [module-a] and [module-b] can be built
   independently. You could build them in separate sessions.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

The recommended module is:
1. First newly unblocked module (if any)
2. Otherwise, first pending module in build_order whose dependencies are met
3. Otherwise, suggest checking status with `cdd:status`

### 8f. All-Complete Footer

If ALL modules are complete (from 8d), display instead:
```
═══════════════════════════════════════════════════════════════
✅ CDD:TEST COMPLETE — [module-name] ALL TESTS PASSED

🎉 ALL MODULES COMPLETE

   Every module has been built, verified, and tested.
   Total modules: [count]
   Phase transition: build_cycle → complete

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:audit to perform a final
      cross-module integration audit

   💰 /cdd:audit works well on Sonnet — stay on Sonnet
      or switch with /model to save costs (optional).
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
