---
name: cdd:foundation
description: Build infrastructure foundations (db, auth, tenant, middleware, shared, verify)
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Build the infrastructure foundation layer that all modules depend on. This command dispatches to a sub-type via its argument: `cdd:foundation [type]` where type is one of `db`, `auth`, `tenant`, `middleware`, `shared`, or `verify`. Each sub-type builds one layer of infrastructure, guided entirely by the locked contracts. The final `verify` sub-type confirms all foundations are correct and advances the project to the build cycle phase.
</objective>

<execution_context>
You are running the `cdd:foundation` command. This is the first implementation phase — you are writing REAL CODE that forms the project's infrastructure layer.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**Argument:** The user MUST provide a sub-type argument. If no argument is provided, display the available sub-types and their status, then stop.

**Valid sub-types:** `db`, `auth`, `tenant`, `middleware`, `shared`, `verify`

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Verify `planning.contract.status: complete` AND `planning.contract.locked: true` — if not, tell the user contracts must be locked first and suggest `cdd:contract`
4. Verify `foundations.stack.status: complete` — if not, tell the user to run `cdd:stack` first to install the project's technology stack
5. Check sequence enforcement (detailed in the workflow)

**Context budget:** Each sub-type loads ONLY its relevant contract sections. Never load full source code trees or unrelated contracts. The workflow file specifies exactly what each sub-type reads.

Read the full foundation workflow from `~/.claude/cdd/workflows/foundation.md` and follow it exactly.
</execution_context>

<process>
1. Read the full foundation workflow from `~/.claude/cdd/workflows/foundation.md`
2. Follow every step in that workflow document precisely
3. Do NOT skip any step or abbreviate the process
</process>
