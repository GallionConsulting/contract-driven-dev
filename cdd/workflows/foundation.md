# CDD Foundation Workflow

This document contains the full foundation-building procedure for `cdd:foundation`. Follow every step in order.

## Step 1: Parse Argument and Display Status

Check what argument the user provided after `cdd:foundation`.

**If no argument (or invalid argument):**
Read `.cdd/state.yaml` and `.cdd/config.yaml`. Display the foundation status dashboard:

```
═══════════════════════════════════════════════════════════════
CDD:FOUNDATION — Infrastructure Builder

Available sub-types:
  cdd:foundation db         — Database migrations & tables
  cdd:foundation auth       — Authentication middleware
  cdd:foundation tenant     — Multi-tenancy middleware
  cdd:foundation middleware — Request middleware stack
  cdd:foundation shared     — Shared services
  cdd:foundation verify     — Verify all foundations

Current status:
  [for each configured foundation: name — status (pending/complete/skipped)]

═══════════════════════════════════════════════════════════════
```

Then stop. Do not proceed without a valid sub-type.

**If valid argument:** Proceed to Step 2.

## Step 2: Check Global Pre-conditions

Read `.cdd/state.yaml` and `.cdd/config.yaml`. Verify:

1. `planning.contract.status` is `complete`
2. `planning.contract.locked` is `true`

If either fails, tell the user: "Contracts must be locked before building foundations. Run `cdd:contract` first." Stop.

## Step 3: Check Foundation Sequence

The default foundation sequence is: `db` → `auth` → `tenant` → `middleware` → `shared` → `verify`

Read the `foundations` list from `.cdd/config.yaml` to determine which foundations are configured. Only configured foundations are required. Unconfigured foundations are treated as `skipped`.

**Sequence enforcement rules:**
- `db` — Can always run (first in sequence)
- `auth` — Requires `foundations.db.status: complete`
- `tenant` — Requires `foundations.auth.status: complete` (only if tenant is configured; if not configured, skip this check)
- `middleware` — Requires `auth` complete AND `tenant` complete (or skipped if not configured)
- `shared` — Requires `foundations.middleware.status: complete`
- `verify` — Requires ALL configured foundations to have status `complete`

If the requested sub-type has unmet sequence dependencies, tell the user which prior foundations must be completed first and suggest the correct next command. Stop.

Also check if the requested foundation is already complete:
- If `foundations.[type].status: complete`, tell the user: "Foundation `[type]` is already complete. Run `cdd:foundation [next-type]` or `cdd:foundation verify` to advance."
- Stop (do not re-run a completed foundation).

## Step 3.5: Git Checkpoint

Create a safety checkpoint before modifying any files:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js foundation [sub-type]
```

Parse the JSON output:
- If `created: true` — display checkpoint notice
- If `created: false` and `message: "not_git_repo"` — display warning: "⚠ Not a git repo — no checkpoint created. Changes cannot be rolled back. Consider running `git init` first." Then **ask the user** if they want to continue without rollback capability or abort. If user aborts, stop immediately with no changes.
- If `created: false` and `message: "no_changes"` — silent, continue
- If `created: false` and `error` — display warning with error text. **Ask the user** if they want to continue without a checkpoint or abort.

When checkpoint is created, display:
```
───────────────────────────────────────────────────────────────
CHECKPOINT: [hash]
  To undo this foundation: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

## Step 4: Dispatch to Sub-type

Based on the argument, jump to the appropriate section below.

---

## Sub-type: db

### 4a-Context
Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info (database type, paths)
- `.cdd/contracts/system-invariants.yaml` — for identity strategy (primary key type), audit columns, naming conventions
- ALL files in `.cdd/contracts/data/*.yaml` — for complete table definitions

### 4a-Process

1. **Analyze data contracts:** Read every data contract file. For each table, note:
   - Table name, columns, types, constraints
   - Primary key strategy (from system invariants)
   - Audit columns to include (from system invariants)
   - Foreign key relationships
   - Indexes

2. **Plan migration order:** Determine the correct order for creating tables based on foreign key dependencies. Tables referenced by foreign keys must be created before the tables that reference them.

3. **Generate migration files:** Create migration files at the path specified in `config.yaml` `paths.migrations`. Follow the framework's migration conventions:
   - **Laravel:** `database/migrations/YYYY_MM_DD_HHMMSS_create_[table]_table.php`
   - **Django:** Create or update model definitions; migrations are auto-generated
   - **Express/Knex:** `migrations/YYYYMMDDHHMMSS_create_[table].js`
   - **Rails:** `db/migrate/YYYYMMDDHHMMSS_create_[table].rb`
   - **Other frameworks:** Follow their standard migration patterns

   For each table in the data contracts:
   - Create the table with all columns, types, and constraints
   - Respect the primary key type from system invariants (uuid, auto-increment, ulid)
   - Include audit columns (created_at, updated_at, and deleted_at if soft_delete is true)
   - Create all specified indexes
   - Create foreign key constraints with the specified on_delete behavior
   - Add any default values specified in the contract

4. **Run migrations:** Execute the migration command for the framework:
   - **Laravel:** `php artisan migrate`
   - **Django:** `python manage.py makemigrations && python manage.py migrate`
   - **Knex:** `npx knex migrate:latest`
   - **Rails:** `rails db:migrate`
   - Adapt for other frameworks as needed

   If migrations fail, report the error clearly and stop. Do NOT update state.

5. **Verify tables:** After migrations succeed, verify the database structure matches the contracts:
   - Check that each contracted table exists
   - Verify column names and types match
   - Verify indexes exist
   - Report any discrepancies

6. **Display results:**
   ```
   Database Foundations:
     Tables created: [count]
     Migration files: [list of files created]
     Indexes created: [count]
     Foreign keys: [count]
     Verification: [PASS/FAIL with details]
   ```

### 4a-State Update
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  db:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    tables_created: [count]
    migration_files: [count]
```

### 4a-Footer
```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION DB COMPLETE

Tables created: [count]
Migrations: [list]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation auth to set up
      authentication middleware

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Sub-type: auth

### 4b-Context
Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info and `allow_stub` setting on auth foundation
- `.cdd/contracts/system-invariants.yaml` — for authentication section (type, provider, token_location) and authorization section (strategy, roles)

### 4b-Process

1. **Read auth configuration:** From system invariants, extract:
   - Auth type (session, jwt, api-key, oauth)
   - Provider (framework default or specific library)
   - Token location (header, cookie, etc.)
   - Authorization strategy (rbac, abac, acl, simple)
   - Defined roles

2. **Check for stub mode:** Read the auth foundation entry in `config.yaml`. If `allow_stub: true`, ask the user:
   - "Would you like to implement real authentication or use a development stub? The stub will provide a fake authenticated user matching the contracted interface, allowing you to build modules without a full auth system."
   - If they choose stub: implement a lightweight stub middleware
   - If they choose real: implement full authentication

3. **Implement authentication middleware:**

   **For REAL auth:**
   - Set up the authentication provider/guard matching the system invariants
   - Configure token handling (JWT secret/keys, session driver, etc.)
   - Create the auth middleware that:
     - Validates the token/session
     - Extracts and provides `userId` (as the contracted type — e.g., UUID)
     - Returns 401 for unauthenticated requests
   - Set up any required configuration files (jwt config, auth config, etc.)

   **For STUB auth:**
   - Create a stub middleware that:
     - Skips real token validation
     - Injects a hardcoded test user matching the contracted interface
     - Provides `userId` as the contracted type
     - Includes a clear comment: "CDD STUB — Replace with real auth before production"
   - The stub must provide the EXACT SAME interface as real auth would

4. **Implement authorization (if applicable):**
   - If RBAC: set up role definitions and a role-checking middleware/helper
   - If simple: set up basic permission checking
   - Roles should match those listed in system invariants

5. **Verify the middleware:**
   - Verify the middleware is registered with the framework
   - Verify it provides `userId` in the format specified by system invariants (check the identity.primary_key.type)
   - If RBAC: verify roles are defined and the role-checking mechanism works

6. **Display results:**
   ```
   Authentication Foundations:
     Type: [jwt|session|api-key|oauth]
     Implementation: [real|stubbed]
     Middleware registered: [yes/no]
     userId type: [uuid|integer|etc.]
     Authorization: [rbac|simple|none]
     Roles defined: [list]
     Verification: [PASS/FAIL with details]
   ```

### 4b-State Update
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  auth:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    type: [real|stubbed]
    auth_method: [jwt|session|api-key|oauth]
```

### 4b-Footer
```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION AUTH COMPLETE

Auth type: [jwt|session|api-key|oauth]
Implementation: [real|stubbed]
Authorization: [rbac|simple|none]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation [tenant|middleware]
      [Show "tenant" if configured, otherwise "middleware"]

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Sub-type: tenant

### 4c-Context
Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info
- `.cdd/contracts/system-invariants.yaml` — for multi_tenancy section (strategy, tenant_identifier, enforcement)

### 4c-Pre-check
If `tenant` is not listed in the configured foundations in `config.yaml`, display:
```
Tenant foundation is not configured for this project.
Skipping. Run /cdd:foundation middleware to continue.
```
Update state: `foundations.tenant.status: skipped` and stop.

### 4c-Process

1. **Read tenancy configuration:** From system invariants, extract:
   - Strategy (row-level, schema-level, database-level, none)
   - Tenant identifier field name
   - Enforcement mechanism (middleware, model scopes, etc.)

2. **Implement tenant middleware based on strategy:**

   **Row-level tenancy:**
   - Create middleware that extracts tenant ID from the request (header, subdomain, URL, or auth token — based on invariants)
   - Attach tenant ID to the request context so all downstream queries can use it
   - Create a base model scope/trait/mixin that automatically filters queries by tenant ID
   - Verify that the tenant identifier column exists in relevant tables (cross-reference with data contracts)

   **Schema-level tenancy:**
   - Create middleware that determines the correct schema name from the request
   - Switch the database connection to the appropriate schema
   - Provide `schemaName` to downstream handlers

   **Database-level tenancy:**
   - Create middleware that determines the correct database from the request
   - Switch the database connection accordingly
   - Provide the connection identifier to downstream handlers

3. **Verify the middleware:**
   - Verify the middleware is registered with the framework
   - Verify it provides the tenant identifier in the contracted format
   - Verify the enforcement mechanism is in place

4. **Display results:**
   ```
   Tenant Foundations:
     Strategy: [row-level|schema-level|database-level]
     Tenant identifier: [field name]
     Enforcement: [mechanism]
     Middleware registered: [yes/no]
     Verification: [PASS/FAIL with details]
   ```

### 4c-State Update
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  tenant:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    strategy: [row-level|schema-level|database-level]
```

### 4c-Footer
```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION TENANT COMPLETE

Strategy: [strategy]
Tenant identifier: [field]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation middleware to register the
      full middleware stack

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Sub-type: middleware

### 4d-Context
Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info and paths
- `.cdd/contracts/system-invariants.yaml` — for response format, validation strategy, and any middleware-level config
- ALL files in `.cdd/contracts/modules/*.yaml` — but ONLY read each module's `requires.from_middleware` section

### 4d-Process

1. **Scan module contracts for middleware requirements:** For every module contract, extract the `requires.from_middleware` section. Compile a complete list of everything that middleware must provide to the request lifecycle. Common items:
   - `userId` (from auth)
   - `tenantId` or `schemaName` (from tenant, if configured)
   - Request validation
   - CORS headers
   - Rate limiting
   - Response formatting

2. **Determine middleware stack order:** Define the correct registration order. The general order is:
   1. CORS / security headers
   2. Rate limiting (if applicable)
   3. Body parsing / request formatting
   4. Authentication
   5. Tenant resolution (if configured)
   6. Authorization
   7. Request validation
   8. Route handlers
   9. Error handling / response formatting

   Adapt this order to the framework's conventions.

3. **Register the middleware stack:**
   - Register each middleware in the framework's middleware pipeline in the correct order
   - Set up route groups with appropriate middleware:
     - **Public routes:** No auth middleware
     - **Authenticated routes:** Auth + (tenant if configured)
     - **Admin routes:** Auth + admin role check (if RBAC)
   - Configure error handling middleware that produces responses matching the `response_format.error` structure from system invariants
   - Configure validation error handling matching the `validation.error_format` from system invariants

4. **Set up response formatting helpers:**
   - Create helpers/utilities that produce responses matching the `response_format.success` structure from system invariants
   - Include pagination helper matching the `pagination` structure from system invariants

5. **Verify the full request lifecycle:** Walk through a conceptual request and verify that every value contracted by modules in `requires.from_middleware` is provided at the correct point in the lifecycle. List each required value and confirm where it's attached.

6. **Display results:**
   ```
   Middleware Foundations:
     Stack order: [ordered list]
     Route groups: [list of groups with their middleware]
     Middleware requirements satisfied:
       [for each from_middleware item: name — provided by: middleware-name]
     Response format: [confirmed matching system invariants]
     Verification: [PASS/FAIL with details]
   ```

### 4d-State Update
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  middleware:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    middleware_count: [number of middleware registered]
    route_groups: [number of route groups]
```

### 4d-Footer
```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION MIDDLEWARE COMPLETE

Middleware registered: [count]
Route groups configured: [count]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation shared to build
      shared services
      [If no shared services configured, suggest: cdd:foundation verify]

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Sub-type: shared

### 4e-Context
Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info
- ALL files in `.cdd/contracts/modules/*.yaml` — but ONLY read each module's `requires.from_shared` section
- `.cdd/contracts/system-invariants.yaml` — for any conventions that shared services must follow (response formats, naming, etc.)

### 4e-Pre-check
If `shared_services` is not listed in the configured foundations in `config.yaml`, display:
```
Shared services foundation is not configured for this project.
Skipping. Run /cdd:foundation verify to validate all foundations.
```
Update state: `foundations.shared_services.status: skipped` and stop.

Also scan all module contracts for `requires.from_shared`. If no module requires any shared services, display:
```
No modules require shared services. Nothing to build.
Skipping. Run /cdd:foundation verify to validate all foundations.
```
Update state: `foundations.shared_services.status: skipped` and stop.

### 4e-Process

1. **Scan module contracts for shared service requirements:** For every module contract, extract the `requires.from_shared` section. Build a comprehensive list of all unique shared services needed and the methods required from each:

   ```
   Shared services required:
     [ServiceName]
       - method1 (used by: module-a, module-b)
       - method2 (used by: module-c)
     [ServiceName2]
       - method1 (used by: module-a)
   ```

2. **Define interfaces for each shared service:** For each shared service, compile its full interface from all consuming modules' requirements:
   - Method names
   - Input parameters (types and descriptions)
   - Return types
   - Error conditions

   If two modules require the same method but with different signatures, flag it as a conflict and resolve it (usually by creating a more flexible interface that satisfies both).

3. **Implement each shared service:**
   - Create the service class/module at the appropriate location in the source tree (follow framework conventions)
   - Implement every method matching the compiled interface
   - Follow the framework's service/provider patterns (e.g., Laravel Service Providers, Express middleware, Django services)
   - Register the service with the framework's dependency injection container (if applicable)
   - Add clear docblocks/comments showing which modules use each method

4. **Verify each service:**
   - Verify the service is registered/accessible via DI or import
   - Verify every method signature matches the compiled interface
   - Verify return types are correct

5. **Display results:**
   ```
   Shared Services Foundations:
     Services created: [count]
     [For each service:]
       [ServiceName]
         Methods: [count]
         Used by: [module list]
         Registered: [yes/no]
     Verification: [PASS/FAIL with details]
   ```

### 4e-State Update
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  shared_services:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    services_created: [count]
    total_methods: [count]
```

### 4e-Footer
```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION SHARED COMPLETE

Shared services created: [count]
Total methods: [count]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation verify to validate all
      foundations before starting module builds

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```

---

## Sub-type: verify

### 4f-Context
Read these files:
- `.cdd/config.yaml` — for configured foundations list and stack info
- `.cdd/state.yaml` — for foundation statuses
- `.cdd/contracts/system-invariants.yaml` — for all system rules
- ALL files in `.cdd/contracts/data/*.yaml` — for table definitions
- ALL files in `.cdd/contracts/modules/*.yaml` — for `requires.from_middleware` and `requires.from_shared` sections

Also read the actual implementation files created by the previous foundation steps. Use the project's source paths from `config.yaml` to locate them.

### 4f-Pre-check
Read `.cdd/state.yaml`. For every foundation that is configured (listed in `config.yaml` foundations):
- Check that its status is either `complete` or `skipped`
- If ANY configured foundation has status `pending`, tell the user which foundations still need to be built and suggest the correct next command. Stop.

### 4f-Process

1. **Verify database foundations (if configured):**
   - Confirm migration files exist for every table in the data contracts
   - Verify the database has been migrated (tables exist)
   - Check that column types match data contracts
   - Check that indexes exist as specified
   - Check that foreign key constraints are in place
   - Check that audit columns (created_at, updated_at, etc.) are present on all tables per system invariants
   - **Result:** PASS or FAIL with specific issues

2. **Verify auth foundations (if configured):**
   - Confirm auth middleware file exists
   - Verify middleware is registered with the framework
   - Verify it provides `userId` as the contracted type (check against system invariants identity.primary_key.type)
   - If stubbed: verify the stub provides the same interface as real auth would
   - Check that authorization roles are defined (if RBAC)
   - **Result:** PASS or FAIL with specific issues

3. **Verify tenant foundations (if configured and not skipped):**
   - Confirm tenant middleware file exists
   - Verify middleware is registered
   - Verify it provides the tenant identifier in the contracted format
   - Verify enforcement mechanism is in place (model scopes, query filters, etc.)
   - **Result:** PASS or FAIL with specific issues

4. **Verify middleware stack (if configured):**
   - Confirm middleware is registered in the correct order
   - Walk through every module contract's `requires.from_middleware` and verify each required value is provided by the middleware stack
   - Verify error response format matches system invariants
   - Verify validation error format matches system invariants
   - **Result:** PASS or FAIL with specific issues

5. **Verify shared services (if configured and not skipped):**
   - For each shared service: confirm the implementation file exists
   - Verify it's registered with the framework's DI container
   - Walk through every module contract's `requires.from_shared` and verify each required method exists with the correct signature
   - **Result:** PASS or FAIL with specific issues

6. **Compile verification report:**

   **If ALL pass:**
   ```
   ═══════════════════════════════════════════════════════════════
   FOUNDATIONS VERIFIED

     ✅ db — [N] tables match data contracts
     ✅ auth — middleware provides userId ([type]) [real|stubbed]
     ✅ tenant — middleware provides [identifier] ([strategy])
        [or: ⏭️ tenant — skipped (not configured)]
     ✅ middleware — request lifecycle complete ([N] middleware)
     ✅ shared_services — [N] services, all interfaces match
        [or: ⏭️ shared_services — skipped (not configured)]

   All foundations verified successfully.
   ═══════════════════════════════════════════════════════════════
   ```

   **If ANY fail:**
   ```
   ═══════════════════════════════════════════════════════════════
   FOUNDATION VERIFICATION FAILED

     ✅ db — tables match data contracts
     ❌ auth — userId type mismatch (expected uuid, got integer)
     ✅ middleware — request lifecycle complete
     ...

   Issues found: [count]
   [Detailed list of each failure]

   Fix the issues above, then run /cdd:foundation verify again.
   ═══════════════════════════════════════════════════════════════
   ```
   Do NOT update state or advance phase if any verification fails. Stop.

### 4f-State Update (only if ALL pass)
Read `.cdd/state.yaml` and update:
```yaml
foundations:
  all_verified: true
  verified_at: "[ISO 8601 timestamp]"
phase: build_cycle
```

This is the critical phase transition: `foundation` → `build_cycle`.

### 4f-Footer (only if ALL pass)

Read `.cdd/state.yaml` to get `build_order`. The first module in the build order is the recommended starting point.

```
═══════════════════════════════════════════════════════════════
✅ CDD:FOUNDATION VERIFY COMPLETE — ALL FOUNDATIONS PASSED

Phase transition: foundation → build_cycle

Foundations verified:
  [list each foundation with status]

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:build [first-module-in-build-order]
      to begin building the first module

   You are now in the build cycle. Each cdd:build session
   will load only the contracts for the target module —
   your context stays lean and focused.

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```
