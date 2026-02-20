---
name: cdd:explore
description: Zero-commitment investigation — brainstorm and research without changing state
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebSearch
  - WebFetch
---

<objective>
Investigate, brainstorm, or research without creating artifacts or changing CDD state.
This is a "think before you act" command — explore feasibility, compare approaches,
or understand a problem space before committing to briefs, contracts, or builds.
</objective>

<execution_context>
You are running `cdd:explore`. This is a READ-ONLY, NO-ARTIFACT command.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**RULES:**
- Do NOT create or modify any files
- Do NOT update state.yaml
- Do NOT create session files
- Do NOT write contracts, briefs, or plans
- You ARE allowed to read any file, search the codebase, and search the web

**Argument (optional):** A topic, question, or module name to investigate.

**Context loading (adaptive — load what exists):**
1. Check if `.cdd/` exists in the project
   - If YES: read `state.yaml` and `config.yaml` for project context
   - If NO: that's fine — exploration works pre-init too
2. If a module name is provided AND its contract exists: load the contract (read-only)
3. If the project has system invariants: load them for architectural context
4. The user's question/topic drives what else to investigate

**CDD awareness:**
Even without a `.cdd/` directory, you understand the CDD methodology:
- Contract-first: define interfaces before implementation
- Modular: systems are decomposed into focused, independently-buildable modules
- Context-budgeted: each module targets ≤40% of the context window
- Phased: brief → plan → modularize → contract → build → verify → test
- Scope-guarded: one module at a time, no cross-contamination

Use this knowledge to frame your investigation in CDD terms when relevant.
</execution_context>

<process>

## Step 1: Understand the Question

Read the user's argument/question. Categorize it:

- **Pre-brief exploration**: "What should this project look like?" / "Is X a good idea?"
- **Feasibility check**: "Can we do X with Y technology?"
- **Module scoping**: "Where should the boundary be between X and Y?"
- **Approach comparison**: "Should we use A or B?"
- **Technical investigation**: "How does X work in this codebase?"
- **General brainstorm**: Anything else

## Step 2: Load Relevant Context

Based on the category, load what's useful:
- For codebase questions: Glob/Grep/Read the relevant code
- For architectural questions: Load existing contracts/invariants if they exist
- For technology questions: Use WebSearch if needed
- For pre-brief questions: Light context only — don't over-load

## Step 3: Investigate and Respond

Provide a thorough but focused investigation. Structure your response based on what was asked:

For feasibility checks:
- Technical viability assessment
- Risks and unknowns
- Rough complexity estimate (small/medium/large module)
- Dependencies that would need to exist

For approach comparisons:
- Pros/cons table
- CDD implications (which approach leads to cleaner contracts?)
- Recommendation with reasoning

For module scoping:
- Suggested boundaries
- Data ownership implications
- Interface surface area estimate
- Context budget estimate

For brainstorming:
- Structured exploration of the problem space
- Questions that would need answering in a brief
- Potential module breakdown (rough, not committal)

## Step 4: Footer

End with:
```
───────────────────────────────────────────────────────────────
   This was a READ-ONLY exploration — no files were changed.
   No state was modified. No artifacts were created.

   When you're ready to act on these insights:
   [Suggest appropriate next CDD command based on project phase]
───────────────────────────────────────────────────────────────
```

</process>
