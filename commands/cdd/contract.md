---
name: cdd:contract
description: Define all interface contracts before implementation
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

<objective>
Generate formal interface contracts for every module, data schema, system invariants, and event registry. This is the MOST CRITICAL command in the entire CDD system — these contracts become the single source of truth that every build session works from. Contracts are locked after generation.
</objective>

<execution_context>
You are running the `cdd:contract` command. This produces the binding contracts that govern all implementation.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase: planning`
3. Verify `planning.modularize.status: complete` — if not, tell the user to run `cdd:modularize` first
4. Verify `planning.contract.status: pending` — if `complete`, tell the user contracts are already locked and suggest `cdd:foundation db`

**Context loaded:** `.cdd/contracts/REQUIREMENTS.md` AND `.cdd/contracts/MODULES.md` (both required). Also state.yaml and config.yaml. Do NOT load BRIEF.md or any source code.
</execution_context>

<process>
Read the full contract workflow from `~/.claude/cdd/workflows/contract.md` (expected: workflow-version 1.0) and follow it exactly.

If the workflow file is missing or the version comment does not match, warn the user that their CDD installation may be out of date and suggest re-running the installer (`node bin/install.js` from the CDD source directory).
</process>
