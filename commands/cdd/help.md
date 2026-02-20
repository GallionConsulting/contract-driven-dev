---
name: cdd:help
description: Show all available CDD commands and current project status
allowed-tools:
  - Read
  - Glob
---

<objective>
Display a complete reference of all CDD commands, grouped by workflow phase, with descriptions and current project status if available.
</objective>

<process>
1. Check if `.cdd/state.yaml` exists in the current project directory
2. If it exists, read it to determine the current phase and progress
3. Display the command reference below, highlighting the recommended next command based on current state

Display the following output:

```
═══════════════════════════════════════════════════════════════
CONTRACT-DRIVEN DEVELOPMENT (CDD) — Command Reference
═══════════════════════════════════════════════════════════════

SETUP
  /cdd:init             Initialize CDD for a new project
  /cdd:help             Show this command reference
  /cdd:explore [topic]  Zero-commitment investigation & brainstorm

PLANNING (sequential, one-time)
  /cdd:brief            Capture project vision through interactive discussion
  /cdd:plan             Transform brief into structured requirements
  /cdd:plan-review      Validate requirements cover all user journeys
  /cdd:modularize       Break system into modules with context budgets
  /cdd:contract         Define all interface contracts (critical step)

FOUNDATION (sequential)
  /cdd:stack            Install framework, dependencies, and build tooling
  /cdd:foundation       Build infrastructure (db, auth, tenant, middleware, shared)

BUILD CYCLE (repeating per module)
  /cdd:build [module]       Implement a module from its contract
  /cdd:verify [module]      Verify implementation matches contract (6 dimensions, report-only)
  /cdd:verify-fix [module]  Triage verify failures → fix, rebuild, or contract change
  /cdd:test [module]        Run tests, then mark module complete

SESSION MANAGEMENT
  /cdd:status           Show full project status
  /cdd:resume           Continue in-progress work from previous session
  /cdd:context [module] Load module briefing without starting a build

POST-BUILD ADDITIONS
  /cdd:add-module       Scope new modules for a built system (interactive)
  /cdd:add-contract [m] Generate a locked contract for an added module

RECOVERY & CHANGES
  /cdd:reset [module]       Abandon partial build, return to ready state
  /cdd:contract-change      Formally request a contract modification
  /cdd:audit                Full system contract compliance check
  /cdd:change-request       Sort changes into per-module change files
  /cdd:change [change-file] Process one module's changes

───────────────────────────────────────────────────────────────
WORKFLOW: init → brief → plan → plan-review → modularize → contract
         → stack → foundation → [build → verify → test]*
         (if verify fails: verify-fix → fix | rebuild | contract-change)
         → audit → [change-request → change → verify → test]*
         → [add-module → add-contract → build → verify → test]*
───────────────────────────────────────────────────────────────
```

4. If `.cdd/state.yaml` exists, append a status summary showing:
   - Current phase
   - Last completed step
   - Recommended next command (with the `👉` indicator)

5. If `.cdd/state.yaml` does NOT exist, append:
```

  No CDD project found in this directory.
  Run /cdd:init to get started.

═══════════════════════════════════════════════════════════════
```
</process>
