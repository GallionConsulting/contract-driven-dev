---
name: cdd:init
description: Initialize Contract-Driven Development for a new project
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Initialize the CDD framework for the current project by gathering project information, creating the `.cdd/` directory structure, and writing configuration and state files.
</objective>

<execution_context>
You are running the `cdd:init` command. This is the bootstrap command that creates the project-level `.cdd/` directory and all required files. After this command completes, the project is ready to begin the CDD planning workflow with `cdd:brief`.

The CDD framework files (templates, workflows) are installed at `~/.claude/cdd/`. Read the detailed workflow from `@~/.claude/cdd/workflows/init.md` and follow it exactly.
</execution_context>

<process>
1. Read the full init workflow from `~/.claude/cdd/workflows/init.md`
2. Follow every step in that workflow document precisely
3. Do NOT skip any step or abbreviate the process
</process>
