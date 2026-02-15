# CDD Contract Generation Workflow
<!-- workflow-version: 1.0 -->

This document contains the full contract generation procedure for `cdd:contract`. Follow every step in order.

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `phase` is `planning`
- `planning.modularize.status` is `complete`
- `planning.contract.status` is `pending`

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info and context settings
- `.cdd/state.yaml` — for module list and build order
- `.cdd/contracts/REQUIREMENTS.md` — for functional requirements, data entities, integration points, and design & consistency guidelines (DG- rules)
- `.cdd/contracts/MODULES.md` — for module definitions, dependencies, data ownership, context budgets

## Step 3: Generate System Invariants

Create `.cdd/contracts/system-invariants.yaml` with this exact structure:

```yaml
# System Invariants
# These rules apply to ALL modules. Every build session must comply.
# Locked: changes require cdd:contract-change

version: "1.0"
locked: true

identity:
  primary_key:
    type: [uuid|auto-increment|ulid]    # Choose based on stack
    format: "[description]"
  external_references:
    format: "[description of how external IDs are handled]"
  naming_convention:
    tables: [snake_case|PascalCase]
    columns: [snake_case|camelCase]
    api_endpoints: [kebab-case|snake_case]
    code_identifiers: "[language convention]"

multi_tenancy:
  strategy: [none|row-level|schema-level|database-level]
  tenant_identifier: "[field name if applicable]"
  enforcement: "[how tenancy is enforced — middleware, model scopes, etc.]"

audit:
  standard_columns:
    - name: created_at
      type: timestamp
      nullable: false
    - name: updated_at
      type: timestamp
      nullable: false
    # Add deleted_at if soft deletes are used
  soft_delete: [true|false]

authentication:
  type: [session|jwt|api-key|oauth]
  provider: "[framework default or specific library]"
  token_location: "[header/cookie/etc.]"

authorization:
  strategy: [rbac|abac|acl|simple]
  roles: [list of role names from requirements]

response_format:
  success:
    structure: |
      {
        "data": {},
        "meta": {}
      }
  error:
    structure: |
      {
        "error": {
          "code": "string",
          "message": "string",
          "details": {}
        }
      }
  pagination:
    strategy: [cursor|offset]
    default_page_size: [number]
    max_page_size: [number]
    structure: |
      {
        "data": [],
        "meta": {
          "total": 0,
          "page": 0,
          "per_page": 0,
          "last_page": 0
        }
      }

validation:
  strategy: "[form requests, middleware, inline — based on framework]"
  error_format: "[how validation errors are returned]"

design_guidelines:
  # Captured from REQUIREMENTS.md Design & Consistency Guidelines section
  # These rules apply to ALL modules and are verified during cdd:verify and cdd:audit

  user_experience:
    tone: "[from DG rules — e.g., 'Simple, non-technical for everyday users']"
    guidelines:
      - "[DG-N]: [guideline text]"

  api_conventions:
    endpoint_naming: "[kebab-case|snake_case|camelCase]"
    url_pattern: "[e.g., /api/v1/{resource-plural}/{id}]"
    guidelines:
      - "[DG-N]: [convention text]"

  terminology:
    # Domain-specific terms that must be used consistently
    - term: "[term]"
      meaning: "[definition]"
      usage: "[when/how to use]"

  consistency_rules:
    - "[DG-N]: [cross-module rule]"
```

Fill in every field based on the stack (from config.yaml), requirements, and standard conventions for the chosen framework. Populate the `design_guidelines` section from the Design & Consistency Guidelines in REQUIREMENTS.md — every DG- rule should appear here. Make reasonable choices and document them.

## Step 4: Generate Module Contracts

For EACH module listed in MODULES.md, create `.cdd/contracts/modules/[module-name].yaml` with this exact structure:

```yaml
# Module Contract: [Module Name]
# DO NOT modify without cdd:contract-change

module: "[module-name]"
version: "1.0"
locked: true
description: "[one-line description from MODULES.md]"

blocked_by:
  # Modules that must be complete before this module can be built
  # Derived from requires.from_modules — list each unique dependency module name
  - "[dependency-module-name]"

context_estimate:
  contract_files: [tokens]
  dependency_interfaces: [tokens]
  reference_files: [tokens]
  implementation_target: [tokens]
  test_target: [tokens]
  total: [tokens]

requires:
  from_middleware:
    # What this module expects middleware to provide on every request
    # e.g., authenticated user, tenant context
    - name: "[item]"
      type: "[data type]"
      description: "[what it is]"

  from_url_params:
    # Route parameters this module's endpoints expect
    - name: "[param]"
      type: "[data type]"
      validation: "[rules]"

  from_modules:
    # Functions this module calls from other modules
    # EACH ENTRY MUST EXACTLY MATCH a provides.functions entry in the referenced module
    - module: "[dependency-module-name]"
      function: "[function-name]"
      inputs:
        - name: "[param]"
          type: "[type]"
      output:
        type: "[return type]"
        description: "[what it returns]"

  from_shared:
    # Shared services this module uses
    - service: "[service-name]"
      methods:
        - name: "[method]"
          description: "[what it does]"

provides:
  functions:
    # Functions this module exposes for other modules to call
    # These are the interfaces other modules depend on
    - name: "[function-name]"
      description: "[what it does]"
      inputs:
        - name: "[param]"
          type: "[type]"
          required: [true|false]
      output:
        type: "[return type]"
        description: "[what it returns]"
      errors:
        - code: "[error-code]"
          condition: "[when this error occurs]"

  events_emitted:
    # Events this module publishes
    - name: "[event-name]"
      description: "[when this event fires]"
      payload:
        - name: "[field]"
          type: "[type]"

  events_consumed:
    # Events this module listens to
    - name: "[event-name]"
      from_module: "[emitting-module]"
      handler: "[what this module does when the event fires]"

  endpoints:
    # API endpoints this module provides (if applicable)
    - method: "[GET|POST|PUT|PATCH|DELETE]"
      path: "[/api/resource]"
      description: "[what it does]"
      auth_required: [true|false]
      request_body:
        - name: "[field]"
          type: "[type]"
          required: [true|false]
          validation: "[rules]"
      response:
        success_code: [200|201|204]
        body: "[description or reference to response format]"
      errors:
        - code: [400|401|403|404|409|422]
          condition: "[when this error occurs]"

data_ownership:
  owns:
    # Tables this module is the sole owner of — only this module may write
    - table: "[table-name]"
      description: "[what this table stores]"
  reads:
    # Tables this module reads from but does NOT own.
    # Direct framework-native read access (ORM, query builder) is allowed.
    # Declared here for dependency tracking — NOT to enforce access patterns.
    # Optional: access_via names a service function for complex/computed queries.
    #
    # For standard tables: columns is REQUIRED — list only columns marked
    # public: true in the data contract (plus any column on tables the module owns).
    # For public tables: columns is omitted (all columns accessible);
    # add public_table: true to indicate this.
    - table: "[table-name]"
      owner: "[owning-module]"
      columns: ["[col1]", "[col2]"]   # Required for standard tables — must all be public
      access_via: "[optional — function name for complex queries, omit for direct reads]"
    - table: "[public-table-name]"
      public_table: true              # All columns accessible — no columns list needed
  writes:
    # Tables from 'owns' plus public tables where this module is a declared writer.
    # Standard-table writes are strictly enforced through ownership.
    # Public-table writes require this module to be listed in the table's writers array.
    - table: "[owned-table-name]"     # From owns — traditional
    - table: "[public-table-name]"    # Public table — must be listed in writers
```

**Critical rules for module contracts:**
- Every `requires.from_modules` entry MUST have a corresponding `provides.functions` entry in the referenced module. If it doesn't match, fix it.
- `blocked_by` MUST list every unique module name from `requires.from_modules`. If a module has no dependencies, use an empty array `[]`.
- `data_ownership.writes` MUST only list tables from `data_ownership.owns` OR tables marked `public_table: true` where this module is listed as a `writer` in the data contract. All other cross-module writes are strictly forbidden.
- `data_ownership.reads` declares which tables a module reads for dependency tracking. Direct framework-native read access (ORM relationships, query builder, etc.) is allowed for declared reads. The `access_via` field is optional — include it only when the module should use a specific service function for complex or computed queries.
- For standard (non-public) table reads, `columns` is REQUIRED and must list only columns marked `public: true` in the data contract (plus any column on tables the module owns). For public table reads, omit `columns` (all columns accessible) and add `public_table: true`.
- Context estimates should come from MODULES.md, verified and adjusted if the contract is more complex than expected.
- If a section is empty (e.g., no events consumed), use an empty array `[]` rather than omitting the section.

## Step 5: Generate Data Contracts

For each distinct data domain (group related tables together), create `.cdd/contracts/data/[schema-name].yaml`:

```yaml
# Data Contract: [Schema Name]
# DO NOT modify without cdd:contract-change

schema: "[schema-name]"
version: "1.0"
locked: true
description: "[what this data domain covers]"

tables:
  # --- Standard table (single owner, private-by-default columns) ---
  - name: "[table-name]"
    description: "[what this table stores]"
    owner_module: "[module-name]"
    columns:
      - name: "[column-name]"
        type: "[database type — e.g., uuid, varchar(255), integer, text, timestamp, boolean, jsonb]"
        nullable: [true|false]
        primary_key: [true|false]
        public: [true|false]          # Optional — columns are private by default.
                                      # Set public: true for columns intended for
                                      # external (cross-module) consumption.
        default: "[default value if any]"
        description: "[what this column stores]"
      - name: "[foreign-key-column]"
        type: "[type]"
        nullable: [true|false]
        public: [true|false]          # FK columns must be explicitly marked public
        foreign_key:
          table: "[referenced-table]"
          column: "[referenced-column]"
          on_delete: "[cascade|set-null|restrict]"
    indexes:
      - columns: ["[col1]", "[col2]"]
        unique: [true|false]
        name: "[index-name]"
    consumer_modules:
      - "[module-name-that-reads-this-table]"

  # --- Public table (multi-writer, all columns implicitly public) ---
  - name: "[table-name]"
    description: "[what this table stores]"
    public_table: true                # All columns are implicitly public.
    writers:                          # Replaces owner_module — lists all modules
      - "[module-name]"               # that may write to this table.
      - "[module-name]"
    columns:
      - name: "[column-name]"
        type: "[database type]"
        nullable: [true|false]
        primary_key: [true|false]
        # public: implicit — all columns are public on a public_table
        default: "[default value if any]"
        description: "[what this column stores]"
    indexes:
      - columns: ["[col1]", "[col2]"]
        unique: [true|false]
        name: "[index-name]"
    consumer_modules:
      - "[module-name-that-reads-this-table]"

# Repeat for each table in this schema domain
```

**Data contract rules:**
- Group tables by domain (e.g., `users.yaml` for user-related tables, `billing.yaml` for billing tables)
- Every standard table MUST have an `owner_module` that matches exactly one module contract's `data_ownership.owns`
- A table uses EITHER `owner_module` (single owner, standard) OR `public_table: true` + `writers: [...]` (multi-writer). Never both.
- **Columns are private by default.** Add `public: true` only to columns intended for external (cross-module) consumption. FK columns must be explicitly marked public — they are not auto-promoted.
- **Public tables** have ALL columns implicitly public — no per-column `public` annotation is needed.
- On public tables, `consumer_modules` lists modules that READ the table; `writers` lists modules that WRITE.
- Column types should be specific to the database from config.yaml (e.g., use `uuid` not `string` for PostgreSQL UUIDs)
- Include audit columns (created_at, updated_at, etc.) as specified in system-invariants.yaml
- Include indexes for foreign keys and commonly queried columns
- `consumer_modules` lists every module that reads this table (from module contracts' `data_ownership.reads`)

## Step 6: Generate Events Registry

Create `.cdd/contracts/events-registry.yaml`:

```yaml
# Events Registry
# Central registry of all system events
# DO NOT modify without cdd:contract-change

version: "1.0"
locked: true

events:
  - name: "[event-name]"
    description: "[when this event fires]"
    emitter: "[module-name]"
    consumers:
      - module: "[consuming-module]"
        handler: "[what it does]"
    payload:
      - name: "[field]"
        type: "[type]"
        description: "[what this field contains]"

# Repeat for each event
```

**Events registry rules:**
- Every event listed here MUST appear in exactly one module's `provides.events_emitted`
- Every consumer listed here MUST appear in the consuming module's `provides.events_consumed`
- If no events exist in the system, create the file with an empty events list: `events: []`

## Step 7: Completeness Verification

Before presenting to the user, perform these cross-reference checks:

### 7a: Requirements Coverage
Walk through every functional requirement (FR-N) in REQUIREMENTS.md and verify:
- It maps to at least one module
- The module's contract has endpoints/functions that implement it

List any uncovered requirements.

### 7b: Interface Consistency
For every module's `requires.from_modules` entry:
- Find the referenced module's contract
- Verify there's a matching `provides.functions` entry with the same name, inputs, and output type
- Flag any mismatches

### 7c: Data Consistency
For every module's `data_ownership.owns`:
- Verify the table exists in a data contract
- Verify the data contract's `owner_module` matches

For every module's `data_ownership.reads`:
- Verify the table exists in a data contract
- Verify the referenced owner module actually owns it

### 7d: Event Consistency
For every event in the events registry:
- Verify the emitter module's contract lists it in `events_emitted`
- Verify each consumer module's contract lists it in `events_consumed`

### 7e: Budget Verification
For each module, check if the actual contract file sizes plus dependencies still fit within the estimated context budget. If a module's contracts grew significantly, flag it.

### 7f: Public Column Consistency
For every module's `data_ownership.reads` that includes a `columns` list:
- Verify each listed column exists in the data contract for that table
- Verify each listed column has `public: true` in the data contract
- Flag any column that is not public or does not exist

For every module's `data_ownership.writes` that lists a non-owned table:
- Verify the table is marked `public_table: true` in the data contract
- Verify this module is listed in the table's `writers` array
- Flag any non-owned, non-public-table write as a strict violation

### 7g: Report
Compile a verification report. If there are inconsistencies, fix them before presenting to the user.

## Step 8: Present for Approval

Display a summary to the user:

```
Contract Generation Summary:
- System invariants: 1 file
- Module contracts: [N] files
- Data contracts: [N] files  ([N] tables total)
- Events registry: [N] events

Cross-reference verification: [PASS/issues found]
[list any issues]
```

Then show the key design decisions you made:
- Identity strategy chosen
- Multi-tenancy approach
- Authentication/authorization approach
- Any assumptions about data relationships

Ask: "Please review the contracts. I'll show any specific contract in detail if you want to inspect it. Are there any changes needed before I lock them?"

Allow modifications until the user approves.

## Step 9: Lock Contracts

After approval:

1. Verify all contract files have `locked: true` (they should from generation, but double-check)
2. Read the current `.cdd/state.yaml`
3. Update it:
   - Set `phase: foundation` (transition from `planning` — the project now moves into infrastructure building)
   - Set `planning.contract.status: complete`
   - Set `planning.contract.locked: true`
   - Add `planning.contract.completed_at: [ISO 8601 timestamp]`
   - Add `planning.contract.file_count:` with counts of each file type
4. Write the updated state.yaml back

## Step 10: Session Footer

Display:

```
═══════════════════════════════════════════════════════════════
✅ CDD:CONTRACT COMPLETE — CONTRACTS LOCKED

Contracts generated and locked:
  system-invariants.yaml ........ system-wide rules
  modules/[name].yaml ........... [N] module contracts
  data/[name].yaml .............. [N] data schemas
  events-registry.yaml .......... [N] events

Cross-reference check: PASSED
All contracts locked: YES

⚠️  Contracts are now LOCKED. Any changes require the formal
   cdd:contract-change process. This friction is intentional —
   it prevents casual changes that break module boundaries.

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation db to begin building the
      database foundation layer

   The planning phase is complete. You're now in the foundation
   phase. Each foundation session will build one infrastructure
   layer guided by the locked contracts.

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```
