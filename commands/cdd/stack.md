---
name: cdd:stack
description: Install the project's technology stack from locked contracts
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebSearch
  - WebFetch
---

<objective>
Install the framework, dependencies, and build tooling defined by the locked contracts. This command bridges the gap between contract generation (which defines WHAT technologies are needed) and foundation building (which assumes the framework already exists). It reads the dependency draft produced by `cdd:contract`, resolves versions, checks compatibility, installs everything, configures the build pipeline, and verifies it all compiles.
</objective>

<execution_context>
You are running the `cdd:stack` command. This installs the project's technology stack so that foundation and build sessions have a working framework to build on.

**Model check:** If not Opus, warn: "⚠️ Works best on **Opus** but you're on **{your-model-name}**. `/model` to switch, or type 'continue'." Wait for response.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Read `.cdd/config.yaml`
3. Verify `planning.contract.status: complete` AND `planning.contract.locked: true` — if not, tell the user contracts must be locked first and suggest `cdd:contract`
4. Verify `foundations.stack.status` is `pending` — if `complete`, tell the user the stack is already installed and suggest `cdd:foundation db`

**Context loaded:** `.cdd/config.yaml`, `.cdd/state.yaml`, `.cdd/contracts/DEPENDENCIES-DRAFT.yaml`, `.cdd/contracts/system-invariants.yaml`. Module contracts are only scanned if the draft is missing or incomplete. Do NOT load BRIEF.md, REQUIREMENTS.md, or source code.

Read the full stack workflow from `~/.claude/cdd/workflows/stack.md` and follow it exactly.
</execution_context>

<process>
1. Read the full stack workflow from `~/.claude/cdd/workflows/stack.md`
2. Follow every step in that workflow document precisely
3. Do NOT skip any step or abbreviate the process
</process>
