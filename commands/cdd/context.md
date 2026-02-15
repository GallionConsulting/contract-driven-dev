---
name: cdd:context
description: Load module contract context without starting a build
allowed-tools:
  - Read
  - Glob
---

<objective>
Display a focused module briefing showing the contract, dependencies, interfaces, and data access — without starting a build or changing any state. This is a read-only "look but don't touch" command useful for debugging, code review, understanding module boundaries, onboarding, or preparing for a build. It loads the same context as `cdd:build` but presents it as a reference document instead of kicking off implementation.
</objective>

<execution_context>
You are running the `cdd:context` command. This is a READ-ONLY command — do NOT modify any files or state.

**Argument:** The user MUST provide a module name. If no argument is provided, read `.cdd/state.yaml` and list all available modules with their status. Then stop.

**Pre-conditions — check these FIRST:**
1. Read `.cdd/state.yaml`
2. Verify `phase` is `foundation`, `build_cycle`, or `complete` — modules must be defined
3. Verify the module contract exists at `.cdd/contracts/modules/[module].yaml`

**Context loaded (same as cdd:build, but read-only):**
- Module contract (`.cdd/contracts/modules/[module].yaml`) — full contract
- System invariants (`.cdd/contracts/system-invariants.yaml`)
- Data contracts for tables this module owns or reads (column definitions from `.cdd/contracts/data/*.yaml`)
- `provides` sections ONLY of dependency modules
- Shared service interfaces relevant to this module
- Session handoff file (if exists) — for current progress info

**Context NOT loaded:**
- Other modules' source code
- Other modules' full contracts (only `provides` sections of dependencies)
- Data contracts for tables not in this module's `data_ownership`
</execution_context>

<process>

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`.

**If no module argument:**
Display all modules:
```
═══════════════════════════════════════════════════════════════
CDD:CONTEXT — Module Briefings

Available modules:
  [For each module in build_order:]
  [icon] [name] — [status]

Usage: /cdd:context [module-name]
═══════════════════════════════════════════════════════════════
```
Stop.

**If module argument provided:**
Verify the contract file exists at `.cdd/contracts/modules/[module].yaml`. If not, list available modules and stop.

## Step 2: Load Module Context

1. Read the full module contract at `.cdd/contracts/modules/[module].yaml`
2. Read `.cdd/contracts/system-invariants.yaml`
3. For each table in the module's `data_ownership.owns` and `data_ownership.reads`, find the data contract file in `.cdd/contracts/data/*.yaml` that defines that table and read its column definitions
4. For each module in the contract's `blocked_by` / `requires.from_modules`, read ONLY the `provides` section of that dependency's contract
5. Check if a session file exists for this module (scan `.cdd/sessions/` for matching files)

## Step 3: Display Module Briefing

```
═══════════════════════════════════════════════════════════════
MODULE BRIEFING: [module-name]
═══════════════════════════════════════════════════════════════

CONTRACT: .cdd/contracts/modules/[module].yaml
LOCK STATUS: [locked: true/false]
MODULE STATUS: [from state.yaml — pending/in_progress/complete/failed]
CONTEXT BUDGET: ~[estimated]k tokens (40% ceiling = [ceiling]k)

───────────────────────────────────────────────────────────────
DESCRIPTION
───────────────────────────────────────────────────────────────
[Module description from contract]

───────────────────────────────────────────────────────────────
DEPENDENCIES
───────────────────────────────────────────────────────────────
[For each dependency in blocked_by:]
  [✅|⏳|🔨] [dep-name] — [status from state.yaml]

[If no dependencies:]
  None (independent module)

───────────────────────────────────────────────────────────────
REQUIRES (what this module consumes)
───────────────────────────────────────────────────────────────
From middleware:
  [For each entry in requires.from_middleware:]
  - [name]: [type] — [description if available]

From modules:
  [For each entry in requires.from_modules:]
  - [module].[function]([params]) → [return type]

From shared services:
  [For each entry in requires.from_shared:]
  - [service].[method]([params]) → [return type]

From URL params:
  [For each entry in requires.url_params (if present):]
  - [param]: [type]

[Omit any "From X" section if empty/not applicable]

───────────────────────────────────────────────────────────────
PROVIDES (what this module exposes)
───────────────────────────────────────────────────────────────
Functions:
  [For each entry in provides.functions:]
  - [function]([params]) → [return type]
    [description if available]

Events emitted:
  [For each entry in events_emitted:]
  - [event-name] → payload: { [field: type, ...] }
    Consumers: [list of consuming modules if specified]

[If no events: "No events emitted."]

───────────────────────────────────────────────────────────────
DATA ACCESS
───────────────────────────────────────────────────────────────
Reads: [tables from data_ownership.reads]
Writes: [tables from data_ownership.writes]

───────────────────────────────────────────────────────────────
DATA SCHEMA (from data contracts)
───────────────────────────────────────────────────────────────
[For each table in owns and reads, show column definitions:]
  [table-name]:
    [column]: [type] [constraints]
    [column]: [type] [constraints]
    ...

───────────────────────────────────────────────────────────────
ENDPOINTS (if applicable)
───────────────────────────────────────────────────────────────
[For each endpoint defined in the contract:]
  [METHOD] [path] — [description]
    Input: [request shape]
    Output: [response shape]

[If no endpoints: "No API endpoints (service-only module)."]

───────────────────────────────────────────────────────────────
BUILD STATUS (if any work has started)
───────────────────────────────────────────────────────────────
[If module has progress in state.yaml:]
  Service: [status]
  Queries: [status]
  Routes: [status]
  Events: [status]
  Verified: [yes/no]
  Tested: [yes/no]
  Session: [session-id if exists]

[If module is pending:]
  No build activity yet.

═══════════════════════════════════════════════════════════════
```

## Step 4: Session Footer

```
───────────────────────────────────────────────────────────────
   This is a READ-ONLY briefing — no state was changed.

   Context used: moderate (contract + dependency provides)
   /clear is optional but recommended before starting a build.

   [Based on module status, suggest appropriate next step:]
   [If pending:] 👉 /cdd:build [module] — start building
   [If in_progress:] 👉 /cdd:resume — continue the build
   [If complete:] 👉 Module is complete. No action needed.
   [If failed:] 👉 /cdd:reset [module] — reset for fresh build
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

</process>
