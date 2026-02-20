---
name: cdd:plan-review
description: Validate requirements completeness against user journeys and success criteria
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
---

<objective>
Validate that the structured requirements (REQUIREMENTS.md) describe a complete, usable application — not just a collection of individually correct features. Walk through every success criterion and user journey to find "connective tissue" gaps: missing navigation, inaccessible UI elements, screens with no way in or out, and features that fall between modules.
</objective>

<execution_context>
You are running the `cdd:plan-review` command. This validates requirements completeness before modularization.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: planning`
3. Verify `planning.plan.status: complete` — if not, tell the user to run `cdd:plan` first
4. Verify `planning.plan_review.status: pending` — if `complete`, tell the user the plan review is done and suggest `cdd:modularize`

**Context budget:** This command loads ONLY `.cdd/contracts/BRIEF.md`, `.cdd/contracts/REQUIREMENTS.md`, and state/config files. Do NOT read source code or other files.
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `planning`
- `planning.plan.status` is `complete`
- `planning.plan_review.status` is `pending`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Inputs

Read both files:
- `.cdd/contracts/BRIEF.md` — for success criteria and user types
- `.cdd/contracts/REQUIREMENTS.md` — the requirements to validate

Extract:
- All success criteria (SC-N items)
- All user types
- All functional requirements (FR-N items)
- All design guidelines (DG-N items)
- Foundation-provided functionality (auth pages, middleware, etc.)

## Step 3: Check 1 — Success Criteria Traceability

For each success criterion (SC-N) in the brief, trace a complete path through requirements:

```
SC-1: "[criterion text]"
  -> FR-X: [supporting requirement] [PASS/MISSING]
  -> FR-Y: [supporting requirement] [PASS/MISSING]
  -> [gap description if any step is missing]
```

A success criterion PASSES only if the user can achieve it through an unbroken chain of requirements, starting from a reachable page/screen/endpoint and ending at the stated outcome.

**Key question for each SC:** "If I built exactly these FRs and nothing else, could a user actually accomplish this criterion?" If the answer is "almost, but they'd need X" — that's a gap.

## Step 4: Check 2 — User Journey Walkthrough

For each user type from the brief, enumerate the full workflow from first touch to exit:

```
[User Type] Journey:
  1. [Action] -> [FR that covers it] [PASS/GAP]
  2. [Action] -> [FR that covers it] [PASS/GAP]
  ...
```

Every step must have:
- A trigger (how does the user get here?)
- A corresponding FR
- A path to the next step

Walk through the COMPLETE journey: first visit, core tasks, edge cases (empty states, errors), and exit (logout, close). Pay special attention to transitions between features — these are where gaps hide.

## Step 5: Check 3 — UI Surface Coverage

List every distinct screen, page, or view the user will encounter:

```
Screens:
  - [Screen name] ([source: FR-N or foundation]) [PASS/GAP]

Persistent UI elements:
  - [Element] — [which FR covers it or MISSING]
```

For each screen: Is there a way IN and a way OUT?
For the app shell: Are persistent elements (header, footer, nav, error display) specified?
For modals/overlays: Is there a dismiss/close mechanism specified?

## Step 6: Check 4 — Connective Tissue Audit

Check for common categories of "between-feature" requirements that are often missed:

| Category | Question |
|----------|----------|
| Navigation | Can users reach every screen from every other reachable screen? |
| Authentication UI | Is login/logout accessible from every authenticated page? |
| Empty states | What do lists/collections look like with zero items? |
| Loading states | Do async operations show feedback? |
| Error recovery | When operations fail, can the user try again? |
| Foundation-Module seams | Do foundation pages connect to module pages? |

**Important:** Not all of these need explicit requirements. Some are builder discretion (exact loading spinner style). The review flags them and categorizes each as:

- **REQUIRED** — Without this FR, a user literally cannot complete a task or reach a screen. Must be added.
- **SUGGESTED** — Improves usability significantly; the app would feel broken without it. Should probably be added.
- **OPTIONAL** — Nice to have; reasonable to leave to builder discretion. Flag but don't push.

## Step 7: Generate Review Report

Write the review report to `.cdd/contracts/PLAN-REVIEW-REPORT.md`:

```markdown
# Plan Review Report

## Success Criteria Traceability
| SC | Status | Supporting FRs | Gap |
|----|--------|---------------|-----|
| SC-N | COVERED / PARTIAL / MISSING | FR-X, FR-Y | [gap description or —] |

## User Journey Gaps
- **[Journey step]:** [description of gap]
  -> Suggested: [proposed FR text]

## UI Surface Gaps
- **[Screen/element]:** [description of gap]
  -> Suggested: [proposed FR text]

## Connective Tissue Flags
- [REQUIRED/SUGGESTED/OPTIONAL] [description]

## Recommended Additions
1. [REQUIRED] FR-NN: [requirement text]
2. [SUGGESTED] FR-NN amendment: [what to add]
3. [OPTIONAL] FR-NN: [requirement text]
```

## Step 8: Present Summary for Approval

**Do NOT display the full report in your response.** The document is already written to disk.

Display a structured summary:

```
=====================================================================
PLAN REVIEW SUMMARY
=====================================================================

Checks performed:
  Success Criteria Traceability .... [N] SC checked, [N] gaps found
  User Journey Walkthrough ......... [N] journeys, [N] gaps found
  UI Surface Coverage .............. [N] screens, [N] gaps found
  Connective Tissue Audit .......... [N] flags raised

GAPS FOUND: [total]
  REQUIRED:  [count] — must add before modularize
  SUGGESTED: [count] — recommended additions
  OPTIONAL:  [count] — builder discretion

REQUIRED ADDITIONS:
  1. FR-NN: [one-line description]
  2. FR-NN: [one-line description]
  ...

SUGGESTED ADDITIONS:
  1. FR-NN: [one-line description]
  ...

OPTIONAL FLAGS:
  1. [one-line description]
  ...

---------------------------------------------------------------------
Full report: .cdd/contracts/PLAN-REVIEW-REPORT.md

Review the report, then tell me:
  - Approve all REQUIRED additions? (recommended)
  - Which SUGGESTED additions to include?
  - Any OPTIONAL flags to promote to requirements?
=====================================================================
```

### Revision handling:

The user may:
1. **Approve all** — apply all REQUIRED and chosen SUGGESTED additions to REQUIREMENTS.md
2. **Approve selectively** — choose which additions to apply
3. **Skip** — proceed without changes (with warning that gaps were found)

When adding requirements to REQUIREMENTS.md:
- Number new FRs sequentially after the existing highest FR number
- Place each new FR in the most appropriate existing feature area, or create a new area if needed (e.g., "Application Shell" or "Navigation")
- Use the same format (expanded or compact) as similar existing FRs

## Step 9: Apply Approved Additions

Edit `.cdd/contracts/REQUIREMENTS.md` to add the approved FRs.

After editing, update the review report to mark which additions were applied.

## Step 10: State Update

When the user approves (or explicitly skips):

1. Read the current `.cdd/state.yaml`
2. Update it:
   - Set `planning.plan_review.status: complete`
   - Add `planning.plan_review.completed_at: [ISO 8601 timestamp]`
   - Add `planning.plan_review.gaps_found: [total gaps found]`
   - Add `planning.plan_review.gaps_resolved: [total gaps resolved via new FRs]`
3. Write the updated state.yaml back

## Step 11: Session Footer

Display:

```
=====================================================================
CDD:PLAN-REVIEW COMPLETE

Review report saved to: .cdd/contracts/PLAN-REVIEW-REPORT.md
Gaps found: [count]
Requirements added: [count]
Updated requirement count: [new total FRs]

---------------------------------------------------------------------
Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:modularize to break the system into
      independently-buildable modules
---------------------------------------------------------------------
=====================================================================
```

</process>
