---
name: cdd:build
description: Build a module from its interface contract
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Build a single module's implementation strictly from its locked interface contract. This command enforces strict context boundaries — you load ONLY the target module's contract and the `provides` sections of its dependencies. The build follows a mandatory order: service layer → data access → API routes → event emissions. A session file is created at the end to enable cross-session continuity.
</objective>

<execution_context>
You are running the `cdd:build` command. This is the core implementation command — you are writing REAL CODE that implements a module according to its contract.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and display the module status dashboard showing all modules and their current status, then suggest which module to build next based on `build_order` and dependency readiness. Then stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Verify `phase: build_cycle` — if not, tell the user foundations must be verified first and suggest the correct command
4. Verify the module contract exists at `.cdd/contracts/modules/[module].yaml`
5. Verify all modules in this module's `blocked_by` list have `status: complete`
6. Verify the module's status is `pending` or `failed` — if `in_progress`, tell the user to run `cdd:resume` instead

**Context budget — STRICTLY ENFORCED:**
- LOAD: This module's contract (`.cdd/contracts/modules/[module].yaml`)
- LOAD: System invariants (`.cdd/contracts/system-invariants.yaml`)
- LOAD: Data contracts for tables this module owns or reads (column definitions from `.cdd/contracts/data/*.yaml`)
- LOAD: `provides` sections ONLY of dependency modules (from `blocked_by` / `requires.from_modules`)
- LOAD: Shared service interfaces relevant to this module (from `requires.from_shared`)
- LOAD: Session handoff file if resuming from a failed attempt
- DO NOT LOAD: Other module contracts (not dependencies)
- DO NOT LOAD: Other module source code
- DO NOT LOAD: Full dependency contracts (only their `provides` sections)
- DO NOT LOAD: Data contracts for tables not in this module's `data_ownership`

Read the full build workflow from `~/.claude/cdd/workflows/build.md` and follow it exactly.
</execution_context>

<process>
1. Read the full build workflow from `~/.claude/cdd/workflows/build.md`
2. Follow every step in that workflow document precisely
3. Do NOT skip any step or abbreviate the process
</process>
