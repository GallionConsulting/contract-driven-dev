# CDD Build Views Sub-Workflow
<!-- workflow-version: 1.0 -->

This sub-workflow is called from `build.md` Step 9.5 when the module contract contains endpoints with `view_elements` or `client_behavior`. It is NOT loaded for API-only modules.

## Pre-condition

The calling build session has already completed Steps 7-9 (service layer, data access, routes). The module's backend is functional. This step adds the frontend rendering that makes the backend visible to users.

## Step 1: Identify View Endpoints

Scan the module contract's `provides.endpoints` for:
- Endpoints with `view_elements` — these return rendered views (templates)
- Endpoints with `client_behavior` — these return JSON consumed by frontend JavaScript

Build a checklist of all view work required:

```
VIEW BUILD CHECKLIST — [module-name]
───────────────────────────────────────────────────────────────
Templates to build:
  [ ] [path] — [endpoint description] ([N] view_elements)

Client behaviors to implement:
  [ ] [endpoint] — [N] triggers, [N] total effects

Cross-module elements:
  [ ] [element-id] → [target-module].[endpoint]
───────────────────────────────────────────────────────────────
```

## Step 2: Build Templates

For each endpoint that has `view_elements`:

1. **Create or update the view/template file** following framework conventions (Blade, EJS, Jinja, Handlebars, etc. — as specified in `config.yaml`).

2. **For every entry in `view_elements`, implement the element:**

   **Display elements** (have `data`, no `action`):
   - Render ALL fields listed in `data` — each field must appear in the template output
   - Use the model/variable names from the route controller (established in Step 9)
   - Follow framework conventions for displaying data (e.g., `{{ $card->title }}` in Blade)

   **Form elements** (have `action` and `fields`):
   - Create a form targeting the `action` endpoint (correct HTTP method and URL)
   - Include ALL inputs listed in `fields`
   - Apply framework conventions (CSRF tokens, method spoofing for PUT/PATCH/DELETE, etc.)
   - Include appropriate form validation attributes where the contract specifies validation rules

   **Cross-module elements** (have `cross_module`):
   - Use the correct route/URL for the other module's endpoint
   - The data for this element comes from the controller (which loads it via dependency calls)
   - The form submits to the other module's route — use the framework's route helper

   **Behavioral elements** (have `behavior`):
   - Implement the described client-side interaction (confirmation dialogs, toggles, dynamic show/hide, etc.)
   - Use the project's JavaScript approach (Alpine.js, vanilla JS, jQuery, etc. — from config.yaml or existing patterns)

3. **Apply framework conventions:**
   - Extend the correct layout template
   - Use partials/components where the framework encourages them
   - Include CSRF tokens on all forms
   - Apply method spoofing for non-GET/POST methods where required by the framework

## Step 3: Implement Client Behaviors

For each endpoint with `client_behavior`:

1. **Identify the page that makes the AJAX call** — this is a template built in Step 2 or an existing page from the module.

2. **For each trigger in `client_behavior`:**
   - Write a JavaScript handler that fires on the trigger condition
   - Implement ALL listed `effects` as DOM updates
   - Each effect is a specific, verifiable action (e.g., "update source column card count" means find the counter element and decrement it)

3. **Error handling:**
   - If a "failed response" trigger exists, implement the rollback/error UI
   - If no failure trigger is specified, implement sensible error indication (the system invariants' error format applies)

4. **Integration:**
   - Wire the JavaScript to the correct DOM elements
   - Ensure AJAX calls target the correct endpoints (matching the contract)
   - Use the project's JavaScript patterns consistently

## Step 4: View Self-Check

Before marking views complete, verify:

1. Every `view_elements` entry has a corresponding implementation in the template
2. Every `data` field is rendered in the output
3. Every form targets the correct `action` with all `fields` present
4. Every `cross_module` element uses the correct route for the dependency module
5. Every `client_behavior` effect has a JavaScript implementation
6. CSRF tokens are present on all forms
7. Framework conventions are followed (layouts, partials, method spoofing)

If any element is missing, implement it now. Do not defer.

## Step 5: Update State

After completing all views and client behaviors:

```yaml
modules:
  [module]:
    progress:
      views: complete
```

Display progress:
```
───────────────────────────────────────────────────────────────
VIEWS COMPLETE — [module-name]
───────────────────────────────────────────────────────────────
Templates built:
  ✅ [path] — [N] view_elements implemented
  ...

Client behaviors implemented:
  ✅ [endpoint] — [N] effects wired
  ...

Cross-module elements:
  ✅ [element-id] → [target-module]
  ...
───────────────────────────────────────────────────────────────
```

Return control to the main build workflow (Step 10: Events).
