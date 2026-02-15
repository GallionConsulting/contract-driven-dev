---
name: cdd:plan
description: Transform project brief into structured requirements
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

<objective>
Read the project brief (BRIEF.md) and transform it into a formal, structured REQUIREMENTS.md document. This is a TRANSFORMATION task — not a conversation. You are converting informal prose into precise, actionable requirements.
</objective>

<execution_context>
You are running the `cdd:plan` command. This transforms the conversational brief into structured requirements.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: planning`
3. Verify `planning.brief.status: complete` — if `pending`, tell the user to run `cdd:brief` first
4. Verify `planning.plan.status: pending` — if `complete`, tell the user the plan is already done and suggest `cdd:modularize`

**Context budget:** This command loads ONLY `.cdd/contracts/BRIEF.md` and state/config files. Do NOT read any source code or other files.
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `planning`
- `planning.brief.status` is `complete`
- `planning.plan.status` is `pending`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Check for Pre-existing Requirements

Check if `.cdd/contracts/REQUIREMENTS.md` already exists.

**If it exists:**
- Read it and display a summary (section counts, FR count, assumption count)
- Tell the user: "I found an existing REQUIREMENTS.md. Let me review it for completeness."
- Check if it covers all required sections
- If any sections are missing or thin, point them out and ask if the user wants to fill them in
- If it looks complete, ask for approval and skip to Step 6
- This path supports re-running after a `/clear` during revision

**If it does not exist:** Proceed to Step 3.

## Step 3: Read the Brief and Estimate Scope

Read `.cdd/contracts/BRIEF.md` as your sole input. Also read `.cdd/config.yaml` for stack context.

As you read, identify:
- Ambiguities (things that could be interpreted multiple ways)
- Gaps (things not addressed that should be)
- Implicit assumptions the brief makes without stating
- Contradictions (if any)

**Scope estimation — do this before generating anything:**

Count the feature areas and estimate the number of functional requirements:
- Count distinct feature areas mentioned in the brief (e.g., "User Management", "Billing", "Notifications")
- Estimate FRs per area (typically 2-6 per area)
- Calculate total estimated FRs

Display the estimate to the user:

```
SCOPE ESTIMATE
──────────────────────────────────────
Feature areas identified: [N]
Estimated functional requirements: [N]
Estimated document size: [small/medium/large]

  small  = <30 FRs  (~8-12k tokens) — standard format
  medium = 30-60 FRs (~12-20k tokens) — standard format
  large  = >60 FRs  (~20k+ tokens) — compact format recommended
──────────────────────────────────────
```

**If estimated FRs exceed 60**, inform the user:
> "This is a large project. I'll use a compact FR format for straightforward requirements (like standard CRUD) to keep the document within budget for downstream commands. Complex or unique flows will still get the full expanded format."

**If estimated FRs exceed 100**, warn:
> "This project may be too large for a single REQUIREMENTS.md. Consider whether the brief describes multiple distinct systems that should each have their own CDD pipeline, or whether some features should be moved to Out of Scope for a v2."

Proceed after the user acknowledges.

## Step 4: Generate REQUIREMENTS.md

Generate the document **section by section**, writing progressively. This prevents context loss from a single massive generation and lets you focus on one section at a time.

### Generation order:

**4a.** Write the header, Problem Statement, and User Types to `.cdd/contracts/REQUIREMENTS.md`.

**4b.** Append Functional Requirements, one feature area at a time. Use the Edit tool to append each area to the file. Apply the FR format rules below.

**4c.** Append the remaining sections in order: Non-Functional Requirements, Out of Scope, Technical Constraints, Data Entities, Integration Points, Design & User Experience Guidelines, Success Criteria, Assumptions.

### Document structure:

```markdown
# [Project Name] — Requirements

## Problem Statement
[Formal, precise restatement of the problem. One paragraph, no ambiguity.]

## User Types

| User Type | Description | Authentication | Key Needs |
|-----------|-------------|----------------|-----------|
| [type] | [description] | [auth method] | [primary needs] |

## Functional Requirements

### [Feature Area 1]
[FRs using expanded or compact format — see format rules below]

### [Feature Area 2]
[same pattern...]

## Non-Functional Requirements
- [ ] **NFR-[number]:** [requirement — e.g., response time, uptime, security]

## Out of Scope
- **OS-[number]:** [thing] — [rationale]

## Technical Constraints
- **TC-[number]:** [constraint] — [impact on design]

## Data Entities (Preliminary)

| Entity | Description | Owner/Creator | Key Relationships |
|--------|-------------|---------------|-------------------|
| [name] | [what it represents] | [who creates it] | [related entities] |

## Integration Points

| System | Purpose | Protocol | Required? | Notes |
|--------|---------|----------|-----------|-------|
| [name] | [what for] | [REST/SDK/etc] | [yes/no] | [key details] |

## Design & User Experience Guidelines

### User Experience
- **DG-[number]:** [Design guideline — e.g., "All user-facing text uses plain language, no technical jargon"]
- [Capture guidelines from the brief's Design & UX section as numbered, enforceable rules]

### API Conventions
- **DG-[number]:** [API convention — e.g., "All endpoints use kebab-case noun plurals: /api/user-profiles"]
- **DG-[number]:** [Naming rule — e.g., "List endpoints always support pagination via ?page=&per_page= params"]

### Terminology
| Term | Meaning | Usage Rule |
|------|---------|------------|
| [term] | [definition] | [when/how to use it consistently] |

## Success Criteria
1. **SC-[number]:** [Measurable, testable criterion]

## Assumptions
[List every assumption you made while transforming the brief. These are things the brief didn't say explicitly but you inferred or decided.]
- **A-[number]:** [assumption] — [why you made it]
```

### FR format rules:

**Expanded format** — use for requirements with complex, non-obvious, or multi-step flows:
```markdown
- [ ] **FR-[number]:** [Precise requirement statement]
  - Actors: [which user types]
  - Trigger: [what initiates this]
  - Flow: [step by step]
  - Outcome: [what changes in the system]
  - Acceptance: [how to verify it works]
```

**Compact format** — use for straightforward CRUD or simple operations where the flow is self-evident:
```markdown
- [ ] **FR-[number]:** [Precise requirement statement]
  - Actors: [which user types] | Acceptance: [how to verify]
```

**When to use which format:**
- **Expanded**: The requirement involves multiple steps, conditional logic, interactions with other modules, non-obvious business rules, or any flow where a developer would have questions about "how exactly does this work?"
- **Compact**: Standard CRUD on a single entity, simple toggles, basic list/filter/sort operations, or anything where "create/read/update/delete [entity]" fully describes the behavior

**Granularity rules — these prevent FR bloat:**
- Standard CRUD operations on a single entity = **1 FR** covering create, read, update, and delete, UNLESS the individual operations have meaningfully different actors, triggers, or business rules
- A "list with filtering/sorting/pagination" = **1 FR**, not separate FRs for list, filter, sort, and paginate
- Only split into separate FRs when the trigger, actors, or acceptance criteria are meaningfully different
- Target range: **30-60 FRs for a medium project**. If you're exceeding 80, you're likely over-splitting — consolidate related operations
- Each FR should map to one **testable behavior**, not one UI button or one API endpoint

### Transformation rules:
- Every feature mentioned in the brief must map to at least one functional requirement
- Number everything (FR-1, NFR-1, OS-1, TC-1, SC-1, DG-1, A-1) for cross-referencing later
- Transform the brief's Design & UX Guidelines into numbered DG- rules that can be enforced during build sessions — these become part of system invariants during `cdd:contract`
- If the brief is vague on something, make a reasonable assumption and document it in the Assumptions section
- Data entities should capture relationships (one-to-many, many-to-many) where apparent
- Do NOT add features not in the brief — transform, don't expand

## Step 5: Present Summary for Approval

**Do NOT display the full REQUIREMENTS.md in your response.** The document is already written to disk and the user can read it there. Displaying it would duplicate the content in the context window.

Instead, display a structured summary:

```
═══════════════════════════════════════════════════════════════
REQUIREMENTS SUMMARY
═══════════════════════════════════════════════════════════════

Feature Areas: [count]
  [area1] ([N] FRs), [area2] ([N] FRs), ...

Functional Requirements:  [total] ([expanded] expanded, [compact] compact)
Non-Functional Requirements: [count]
Out of Scope items: [count]
Technical Constraints: [count]
Data Entities: [count]
Integration Points: [count]
Design Guidelines: [count]
Success Criteria: [count]
Assumptions: [count]

Estimated document size: ~[N]k tokens

ASSUMPTIONS (review these carefully):
  A-1: [assumption] — [rationale]
  A-2: [assumption] — [rationale]
  ...

GAPS IDENTIFIED:
  - [gap description and how it was resolved]
  ...

───────────────────────────────────────────────────────────────
📄 Full document: .cdd/contracts/REQUIREMENTS.md

Review the full document, then tell me:
  - Are the assumptions acceptable?
  - Any requirements to add, change, or remove?
  - Any feature areas that need more or less detail?
═══════════════════════════════════════════════════════════════
```

### Downstream budget check:

After generation, estimate the token count of REQUIREMENTS.md (rough guide: 1 token ≈ 4 characters). Display the estimate in the summary.

- If **under 20k tokens**: Good — well within budget for `cdd:modularize`
- If **20k-30k tokens**: Note: "This is a substantial requirements document. The modularize step will be able to handle it, but keep the downstream budget in mind."
- If **over 30k tokens**: Warn: "This document is large. The `cdd:modularize` command loads it as its sole input and needs room to work. Consider whether any feature areas can be consolidated or whether some should move to Out of Scope."

### Revision handling:

Allow the user to request modifications. Edit the file as needed.

**After 2 rounds of revisions**, suggest:
> "We've done a couple of revision rounds. If you need more significant changes, I recommend running `/clear` and then `/cdd:plan` again — I'll pick up the existing REQUIREMENTS.md and refine it from there, with a fresh context window."

This prevents context exhaustion from extended back-and-forth on a large document.

## Step 6: State Update

When the user approves:

1. Read the current `.cdd/state.yaml`
2. Update it:
   - Set `planning.plan.status: complete`
   - Add `planning.plan.completed_at: [ISO 8601 timestamp]`
   - Add `planning.plan.requirement_count: [number of FRs]`
3. Write the updated state.yaml back

## Step 7: Session Footer

Display:

```
═══════════════════════════════════════════════════════════════
✅ CDD:PLAN COMPLETE

Requirements saved to: .cdd/contracts/REQUIREMENTS.md
Functional requirements: [count] ([expanded] expanded, [compact] compact)
Non-functional requirements: [count]
Assumptions documented: [count]
Estimated document size: ~[N]k tokens

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:modularize to break the system into
      independently-buildable modules

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
