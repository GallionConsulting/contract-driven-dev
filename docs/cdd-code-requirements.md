# CDD Code Requirements

> **Purpose:** This document defines the requirements that Contract-Driven Development (CDD) imposes on generated code. Use it to evaluate whether a set of coding standards (for any language or framework) is compatible with CDD. If a coding standard conflicts with a requirement here, the coding standard must be adapted.
>
> **How to use:** Point an AI or reviewer at this document alongside your coding standards files and ask: *"Are these coding standards compatible with these CDD requirements? If not, what changes are needed?"*

---

## 1. Module Boundaries & Organization

### 1.1 One Module, One Responsibility
Every module has a single, documented responsibility — what it does AND what it does not do. Code must not blur module boundaries.

### 1.2 Module Independence
Each module must be independently buildable and testable. A module's source files must not import or reference the internal implementation of another module. Cross-module interaction happens exclusively through declared interfaces (exported functions, events, or shared services).

### 1.3 No Circular Dependencies
The module dependency graph must be a DAG (Directed Acyclic Graph). If module A depends on module B, module B must not depend on module A, whether directly or transitively. When bidirectional communication is needed, use events, callbacks, or extract a shared dependency.

### 1.4 Explicit Dependency Declaration
Every dependency a module uses must be explicitly declared in its contract under `requires`. No implicit imports, no side-channel communication, no undeclared service calls. If the code calls it, the contract must list it.

### 1.5 Module Naming
Module names use **lowercase-hyphenated** format (e.g., `user-management`, `billing-service`). Coding standards that mandate a different module naming convention (e.g., PascalCase directories) must adapt to allow hyphenated module identifiers at the CDD level, even if internal file naming follows framework conventions.

---

## 2. Data Ownership & Access

### 2.1 Single Owner Per Entity
Every database table or data entity has exactly ONE owning module. Only the owning module may write to its tables. This is non-negotiable.

### 2.2 Write Restrictions
A module may write ONLY to:
- Tables it **owns** (declared in `data_ownership.owns`)
- **Public tables** where the module is explicitly listed in the table's `writers` array

Any code that writes to a table not in one of these two categories is a contract violation.

### 2.3 Read Access via Public Columns
Non-owning modules may read from tables they declare in `data_ownership.reads`. For non-owned tables, reads should target columns marked `public: true` in the data contract. Owning modules may read all columns of their own tables.

### 2.4 Framework-Native Data Access is Expected
ORM relationship loading, eager loading, joins, and query builder patterns are expected and correct for declared tables. Coding standards must NOT prohibit these patterns for declared data relationships. CDD verification will not flag framework-native read patterns on declared tables.

### 2.5 Audit Columns
System invariants define required audit columns (typically `created_at`, `updated_at`, `created_by`, etc.). Every table must include these columns. Coding standards that define model base classes or traits must ensure audit columns are present.

### 2.6 Primary Key Format
System invariants define the project-wide primary key strategy (UUID, auto-increment, or custom). All tables must follow the declared format. Coding standards must not impose a conflicting PK strategy.

---

## 3. Interface Contracts & Function Signatures

### 3.1 Contracts Are the Single Source of Truth
Every exported function, endpoint, event, and data shape is defined in a YAML contract before implementation. Code must match the contract exactly — same function names, same parameter types, same return types.

### 3.2 Every Exported Function Must Match Its Contract
Each function listed in `provides.functions` must exist in code with:
- The exact function name
- The correct parameter names and types
- The correct return type

Coding standards may dictate naming conventions (e.g., `snake_case` vs `camelCase` for function names), but the contract will already use the project's chosen convention. Standards must not rename contracted functions.

### 3.3 Every Dependency Call Must Match the Provider's Contract
When module A calls a function from module B, the call must use:
- The correct function name from B's `provides.functions`
- The correct parameter types
- Correct handling of B's return type

### 3.4 Empty Sections Use Empty Arrays, Not Omission
Contract sections with no entries use `[]`, never omission. Code generators and standards must not strip empty arrays from YAML structures.

---

## 4. API Endpoints & HTTP Conventions

### 4.1 Standard Response Envelope
All API responses must follow a consistent envelope structure defined in system invariants. Typically:
```
Success: { data: <payload>, meta: <object> }
Error:   { error: { code: <string>, message: <string>, details: <object> } }
```
Coding standards that define their own response wrapper must align with (or be adapted to) the project's declared envelope.

### 4.2 HTTP Status Codes
Modules must follow REST conventions as declared in system invariants:
- `200` — success
- `201` — created
- `204` — no content (successful delete or action with no response body)
- `400` — bad request (malformed request the client should not retry as-is)
- `401` — authentication failure
- `403` — authorization failure
- `404` — not found
- `409` — conflict (e.g., duplicate record)
- `422` — validation failure (field-level errors)
- `500` — server error

Coding standards must not map these differently (e.g., returning 200 for all responses with an error flag in the body).

### 4.3 Validation Errors Include Field-Level Detail
Validation failure responses must identify which fields failed and why. Standards that return generic "validation failed" messages without field detail are incompatible.

### 4.4 Route Naming
API route paths default to **kebab-case plurals** (e.g., `/user-profiles`, `/billing-invoices`), but this is configurable in system invariants via `identity.naming_convention.api_endpoints`. Coding standards that mandate a different route naming convention must verify it matches the project's system invariants.

### 4.5 Authentication & Authorization Consistency
All protected routes must enforce auth via middleware, using the patterns declared in system invariants. Standards must not mix auth strategies (e.g., some routes using middleware, others checking inline).

---

## 5. Error Handling

### 5.1 Consistent Error Format Across All Modules
Every module must produce errors in the same format. System invariants define this format. Coding standards that allow per-module error formatting are incompatible.

### 5.2 No Technical Jargon in User-Facing Errors
Where errors are returned to end users, messages must be in plain language. Stack traces, SQL errors, and internal identifiers must not leak to clients.

### 5.3 Fail Explicitly on Precondition Violations
When a required precondition is not met (missing auth, invalid input, missing dependency), code must fail explicitly with the appropriate HTTP status code — not silently proceed or return partial results.

---

## 6. Events & Async Communication

### 6.1 Events Must Match the Registry
Every event emitted must be declared in the events registry with:
- Event name
- Payload schema (field names and types)
- Emitting module
- Consuming modules

Code must not emit undeclared events or emit events with payloads that differ from the contracted schema.

### 6.2 Events for Cross-Module Async Coupling
When modules need to communicate asynchronously, events are the mechanism. Direct function calls across module boundaries are only for synchronous declared dependencies. Coding standards should support an event emission/consumption pattern.

### 6.3 No Events on Failure
Events should only be emitted on successful operations, not on failures, unless the contract explicitly declares a failure event.

---

## 7. Testing Requirements

### 7.1 Tests Are Contract-Derived
Tests are generated from the contract, not invented ad hoc. Every function in `provides.functions` gets tested. Every endpoint in `provides.endpoints` gets tested.

### 7.2 Required Test Coverage Per Function
Each contracted function requires tests for:
- **Happy path** — correct inputs produce correct outputs
- **Input validation** — missing required params, wrong types, null, empty string, zero, negative values
- **Edge cases** — empty result sets, single item, multiple items, duplicates, non-existent IDs

### 7.3 Required Test Coverage Per Endpoint
Each contracted endpoint requires tests for:
- Correct HTTP method and path
- Expected status codes (success and each error case)
- Authentication/authorization enforcement
- Request validation (reject malformed input)
- Response shape matches contract

### 7.4 Data Access Tests
Tests must verify:
- Writes affect only the correct tables (within ownership rules)
- Reads return the expected data shapes
- The module does NOT write to tables outside its ownership

### 7.5 Event Tests
If the module emits events:
- Event is emitted when the triggering action succeeds
- Payload matches the contracted schema
- Event is NOT emitted on failure

### 7.6 Test Framework Flexibility
CDD does not mandate a specific test framework — it is configured per project. Coding standards may specify the test framework (pytest, Jest, PHPUnit, Go testing, etc.) and CDD will use it. The test *coverage requirements* above are non-negotiable regardless of framework.

---

## 8. Naming Conventions

### 8.1 Module Names
**lowercase-hyphenated** (e.g., `user-management`)

### 8.2 Database Identifiers
- Table names: **snake_case** (e.g., `user_profiles`)
- Column names: **snake_case** (e.g., `created_at`)

### 8.3 API Route Paths
**kebab-case plurals** by default (e.g., `/billing-invoices`). Configurable in system invariants.

### 8.4 In-Code Naming
CDD defers to the project's language conventions for in-code naming:
- Python: `snake_case` functions, `PascalCase` classes
- JavaScript/TypeScript: `camelCase` functions, `PascalCase` classes
- Go: `PascalCase` exports, `camelCase` private
- PHP/Laravel: `camelCase` methods, `PascalCase` classes
- etc.

The contract will use the project's convention. Coding standards must be consistent with whatever convention the contract uses. CDD's coherence verification will flag inconsistent naming within a module as a failure.

### 8.5 Constants & Environment Variables
Follow framework conventions (typically `SCREAMING_SNAKE_CASE`).

---

## 9. Code Structure Within a Module

### 9.1 Layer Order
Modules are built in a defined layer order:
1. **Service layer** — business logic
2. **Data access layer** — queries, ORM models, repositories
3. **API routes/endpoints** — HTTP handlers
4. **Event handling** — emission and consumption

Coding standards must support (or at minimum not prohibit) this layered structure. Standards that mandate a flat structure or a conflicting layer order must adapt.

### 9.2 Service Layer Contains Business Logic
Business logic lives in the service layer, not in route handlers or data access code. Route handlers should delegate to services. Coding standards that encourage "fat controllers" or business logic in models are incompatible.

### 9.3 No Cross-Module Internal Imports
Code in module A must not import internal (non-exported) files from module B. All cross-module access goes through declared interfaces. Coding standards must not encourage or require cross-module internal imports.

---

## 10. System Invariants

System invariants are project-wide rules that every module must follow. They are defined once and enforced everywhere. Coding standards must be compatible with all declared invariants.

### 10.1 Multi-Tenancy (if applicable)
The system invariant declares how tenant isolation is enforced (e.g., row-level via `tenant_id`, schema-per-tenant, database-per-tenant). Every data query in every module must respect this strategy. Standards must not allow queries that bypass tenant scoping.

### 10.2 Response Format
See [Section 4.1](#41-standard-response-envelope). The invariant-declared format overrides any framework default.

### 10.3 Validation Strategy
System invariants declare where validation happens (framework-level, service-level, or both). All modules must follow the same strategy. Standards that validate in a different layer are incompatible.

### 10.4 Pagination (if applicable)
Standard request parameters (e.g., `?page=&per_page=`) and response structure for paginated endpoints. All modules must use the same pagination format.

The default CDD pagination envelope nests pagination metadata inside a `meta` object:
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 0,
    "per_page": 0,
    "last_page": 0
  }
}
```
Coding standards that define a flat pagination structure (e.g., `total`, `current_page` at the top level alongside `data`) must adapt to the system invariants' declared structure, or the system invariants must be configured to match the coding standard's structure during the contract phase.

### 10.5 Design Guidelines (DG Rules)
The project's requirements may include numbered Design Guidelines (`DG-1`, `DG-2`, etc.) that become enforceable invariants. These are project-specific rules — examples might include "all service methods must be stateless" or "no raw SQL outside the data access layer." Coding standards must not conflict with any declared DG rules.

---

## 11. Verification Compatibility

CDD verifies code against contracts across six dimensions. Coding standards must produce code that can pass all six.

### 11.1 Inputs Verification
Every middleware value, URL parameter, module function, and shared service declared in `requires` must actually be accessed in code with correct types. Standards must not optimize away or defer declared dependency usage.

### 11.2 Outputs Verification
Every function in `provides` must exist with the correct signature and return type. Standards must not alter function signatures through decorators, wrappers, or transformations that change the visible signature.

### 11.3 Dependency Calls Verification
Every cross-module function call must use correct parameter types and handle return values correctly. Standards must not abstract away direct calls in ways that obscure the dependency relationship.

### 11.4 Events Verification
Event emission must be traceable in code — the event name and payload must be visible. Standards must not hide event emission behind generic abstractions that obscure which events are emitted.

### 11.5 Data Access Verification
Write operations must be traceable to specific tables. Read operations must reference declared tables/columns. Standards that use dynamic table resolution or meta-programming that obscures data access will fail verification.

### 11.6 Coherence Verification
Code must be internally consistent:
- Naming must be consistent (no mixed conventions within a module)
- Error format must match system invariants
- Response envelope must match system invariants
- Auth patterns must match system invariants
- HTTP status codes must match conventions

**Coherence has no warning level** — inconsistency is a failure.

---

## 12. What Coding Standards Must NOT Do

These are hard incompatibilities. If a coding standard does any of the following, it must be modified:

1. **Must not allow writes to non-owned tables** — Even through convenience methods, mass-assignment, or ORM magic
2. **Must not mandate a response format** that conflicts with the project's system invariants
3. **Must not require cross-module internal imports** — Only public interfaces
4. **Must not prohibit framework-native data access patterns** (eager loading, joins, relationships) for declared tables
5. **Must not impose a different auth middleware pattern** than what system invariants declare
6. **Must not strip empty arrays** from data structures or contracts
7. **Must not allow circular module dependencies** even if the language technically permits it
8. **Must not encourage "fat controllers"** — business logic belongs in the service layer
9. **Must not use inconsistent naming** within a module (mixed camelCase and snake_case, etc.)
10. **Must not return generic error messages** without field-level detail for validation failures
11. **Must not emit events with undeclared payloads** or undeclared event names
12. **Must not bypass tenant scoping** in any data query (if multi-tenancy is declared)

---

## 13. What Coding Standards Are Free to Define

CDD does not opine on these — coding standards may set them as they wish:

1. **Indentation style** (tabs vs spaces, indent width)
2. **Line length limits**
3. **Import ordering**
4. **String quoting** (single vs double)
5. **Trailing commas**
6. **Bracket placement** (same-line vs next-line)
7. **In-code comment style** (CDD does not require code comments)
8. **Logging patterns** (as long as they don't expose sensitive data)
9. **Internal file naming within a module** (as long as module-level name is hyphenated)
10. **Design patterns** (repository pattern, service pattern, etc.) — as long as business logic stays in the service layer
11. **Framework-specific conventions** (middleware registration, provider patterns, etc.) — as long as they don't conflict with CDD invariants
12. **Linting rules** (semicolons, unused variable warnings, etc.)
13. **Type strictness** (strict mode, type hints, generics) — CDD welcomes strict typing but doesn't mandate it beyond what contracts declare
14. **Dependency injection approach** (constructor injection, container, service locator) — as long as dependencies remain explicit and traceable

---

## 14. Compatibility Checklist

Use this checklist to quickly evaluate a coding standards file:

| # | Requirement | Compatible? |
|---|-------------|-------------|
| 1 | Modules have clear, enforced boundaries (no cross-module internal imports) | |
| 2 | Data writes restricted to owned tables only | |
| 3 | Framework-native read patterns (eager loading, joins) allowed for declared tables | |
| 4 | Consistent response envelope across all modules | |
| 5 | REST-standard HTTP status codes (not all-200) | |
| 6 | Validation errors include field-level detail | |
| 7 | Business logic in service layer (not controllers/models) | |
| 8 | Auth enforced via middleware consistently | |
| 9 | Event names and payloads match declarations | |
| 10 | No circular module dependencies | |
| 11 | Naming consistency enforced within modules | |
| 12 | Audit columns present on all tables | |
| 13 | Tenant scoping on all queries (if multi-tenant) | |
| 14 | Tests cover happy path, validation, and edge cases per contract | |
| 15 | API routes follow system invariants' naming convention (default: kebab-case plurals) | |
| 16 | Database identifiers use snake_case | |
| 17 | Module names use lowercase-hyphenated format | |
| 18 | No technical jargon in user-facing error messages | |
| 19 | Dependencies are explicit and traceable in code | |
| 20 | System invariants override framework defaults where they conflict | |

---

*This document was derived from the CDD command suite (v3). When CDD commands are updated, this document should be reviewed for consistency.*
