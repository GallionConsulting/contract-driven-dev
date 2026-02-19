---
name: cdd:brief
description: Capture project vision through interactive discussion
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - Glob
---

<objective>
Capture the user's project vision through an interactive discovery session and produce a structured BRIEF.md document at `.cdd/contracts/BRIEF.md`. This is the ONLY CDD command that is open-ended and conversational — your job is to be a skilled interviewer who draws out a complete picture of the project.
</objective>

<execution_context>
You are running the `cdd:brief` command. This is the first planning step after `cdd:init`.

**Model check — Opus recommended:**
Check your model from the system prompt. If you are NOT an Opus model, STOP and tell the user:
> ⚠️ This command works best on **Opus** but you're running **{your-model-name}**. Run `/model` to switch before proceeding, or type "continue" to proceed anyway.
Do not continue until the user responds.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: planning` — if not, stop and tell the user which phase they're in
3. Verify `planning.brief.status: pending` — if `complete`, tell the user the brief is already done and suggest `cdd:plan`
4. Read `.cdd/config.yaml` to get the project name and stack info

**Context budget:** This command loads NO project source code. The only files read are state.yaml and config.yaml.
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify:
- `phase` is `planning`
- `planning.brief.status` is `pending`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Check for Pre-existing Brief

Check if `.cdd/contracts/BRIEF.md` already exists.

**If it exists:**
- Read it and display a summary
- If it starts with `<!-- CDD:INCOMPLETE`, tell the user: "I found a partial brief from a previous session. I'll pick up where we left off." Remove the incomplete marker, use the existing content as context for already-covered topics, and resume the interview from the first missing section. Set `source: interactive` when updating state.
- Otherwise, tell the user: "I found an existing BRIEF.md. Let me review it for completeness."
- Check if it covers all required sections (Problem, Vision, Users, Core Features, Out of Scope, Data Model, Technical Constraints, Integration Points, Design & User Experience Guidelines, Success Criteria)
- If any sections are missing or thin, point them out and ask if the user wants to fill them in
- If it looks complete, ask for approval and skip to Step 5
- Set `source: provided` when updating state (unless resuming from incomplete, which uses `interactive`)

**If it does not exist:** Proceed to Step 3. Set `source: interactive` when updating state.

## Step 3: Interactive Discovery Session

Run a structured interview. Do NOT ask all questions at once — have a natural conversation, going deeper where answers are vague. Cover these topics in order:

### 3a: The Problem & Vision
- "What problem does this project solve? Who has this problem today, and how do they deal with it?"
- "What does success look like? Paint me the picture of a user having a great experience with the finished product."
- Push back on vague answers. If the user says "it makes things easier," ask HOW and for WHOM.

### 3b: Users
- "Who are the distinct user types? What does each one need to accomplish?"
- For each user type, ask about their primary goals and pain points
- Distinguish between user types that have different permissions, workflows, or views

### 3c: Core Features
- "What are the must-have features for a first version?"
- For each feature, ask: "Can you describe the basic flow? What triggers it, what happens, what's the outcome?"
- Prioritize ruthlessly — push the user to separate "must have" from "nice to have"

### 3d: Out of Scope
- "What are you explicitly NOT building? What might someone assume is included but isn't?"
- This is critical for preventing scope creep. Press the user on boundaries.

### 3e: Data Model Intuition
- "What are the main 'things' (entities) in your system? How do they relate to each other?"
- Don't design a schema — just capture the user's mental model of the data
- Ask about ownership: "Who creates a [thing]? Who can see it? Who can modify it?"

### 3f: Technical Constraints
- Reference the stack from config.yaml (language, framework, database)
- "Are there any technical constraints I should know about? Hosting requirements, performance targets, compliance needs, existing systems to integrate with?"
- Ask about authentication requirements specifically

### 3f-check: Config Sanity Check

After discussing technical constraints, silently cross-reference what the user has described so far against the stack in `config.yaml`:

- Does the described architecture match the framework? (e.g., user describes MVC patterns but config says a non-MVC framework)
- Do the database requirements match the selected database? (e.g., row-level security needs PostgreSQL but config says MySQL; JSON columns described but config says a DB without native JSON support)
- Does the language match the ecosystem the user is describing? (e.g., user talks about Laravel conventions but config says Python)

**If a conflict is detected:**

1. Save all interview progress so far to `.cdd/contracts/BRIEF.md` as a partial document. At the very top of the file, add this marker line before the title:
   ```
   <!-- CDD:INCOMPLETE — config conflict detected, interview paused -->
   ```
2. Tell the user what the conflict is and bail:
   ```
   I noticed a conflict between your config and what you're describing:

     Config says: [field]: [value]
     You described: [what they said that contradicts it]

   Please run /clear and then /cdd:init to correct your stack settings.
   Your brief progress has been saved — when you re-run /cdd:brief,
   I'll pick up where we left off.
   ```
3. Do NOT attempt to modify config.yaml — that is init's job. Stop here.

**If no conflict:** Continue the interview normally.

### 3g: Integration Points
- "Does this system need to talk to any external services? APIs, payment processors, email services, file storage?"
- For each integration, ask: "Is this a hard requirement or could we stub it initially?"

### 3h: Design & User Experience Guidelines
- "What should the user experience feel like? Describe the tone and style — is it simple and non-technical? Power-user dense? Developer-oriented API docs?"
- For systems with a UI: "Are there any UI conventions, design systems, or visual patterns you want followed? Accessibility requirements?"
- For APIs: "What should the API feel like to consume? RESTful conventions, naming style, versioning approach?"
- "What about consistency? Any naming conventions, terminology rules, or style guidelines that should be enforced across all modules?"
- The goal is to capture enough to prevent rework from inconsistent design decisions across build sessions

### 3i: Success Criteria
- "How will you know the project is done? What are the concrete, testable criteria?"
- Push for measurable criteria, not vague goals

**Interview rules:**
- Ask follow-up questions when answers are vague or incomplete
- Summarize what you've heard periodically to confirm understanding
- If the user gives a wall of text, break it down and confirm each piece
- Be direct — "I don't have enough detail on X to write a good brief. Can you tell me more about...?"
- When you have enough information on all topics, tell the user you're ready to draft the brief

## Step 4: Generate BRIEF.md

Write the brief to `.cdd/contracts/BRIEF.md` using this exact template structure:

```markdown
# [Project Name] — Project Brief

## The Problem
[Clear statement of the problem being solved, who has it, and current workarounds]

## The Vision
[What the finished product looks like and feels like from the user's perspective]

## Users
[For each user type:]
### [User Type Name]
- **Description:** [who they are]
- **Primary needs:** [what they need to accomplish]
- **Key workflows:** [main things they do in the system]

## Core Features
[Numbered list of must-have features with brief descriptions]
1. **[Feature Name]** — [one-line description]
   - [key detail or flow description]

## Out of Scope
[Bulleted list of things explicitly NOT included]
- [thing] — [why it's excluded or when it might be added]

## Data Model Intuition
[Main entities and their relationships — NOT a database schema, just the mental model]
- **[Entity]** — [what it represents, who owns it, key attributes]

## Technical Constraints
- **Stack:** [from config.yaml]
- **[constraint category]:** [details]

## Integration Points
[For each external system:]
- **[System/Service]** — [what it's used for] ([required|optional])

## Design & User Experience Guidelines
[Capture the intended feel and consistency rules for the project]
- **Overall tone:** [e.g., "Simple, non-technical interface for non-techie users" or "Power-user dashboard for data analysts" or "Developer-friendly REST API"]
- **UI conventions:** [design system, component patterns, accessibility requirements — or "API only, no UI"]
- **API style:** [naming conventions, versioning, response patterns]
- **Terminology:** [domain-specific terms and their correct usage across the system]
- **Consistency rules:** [any cross-module design rules that should be uniform]

## Success Criteria
[Numbered list of concrete, testable criteria]
1. [criterion]
```

Present the generated brief to the user for review. Ask: "Does this accurately capture your project? Anything to add, change, or remove?"

## Step 5: Approval and State Update

When the user approves the brief:

1. Read the current `.cdd/state.yaml`
2. Update it:
   - Set `planning.brief.status: complete`
   - Add `planning.brief.source: interactive` (or `provided` if they supplied their own)
   - Add `planning.brief.completed_at: [ISO 8601 timestamp]`
3. Write the updated state.yaml back

## Step 6: Session Footer

Display:

```
═══════════════════════════════════════════════════════════════
✅ CDD:BRIEF COMPLETE

Brief saved to: .cdd/contracts/BRIEF.md
Source: [interactive|provided]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:plan to transform the brief into
      structured requirements

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
