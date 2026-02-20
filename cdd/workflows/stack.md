# CDD Stack Installation Workflow
<!-- workflow-version: 1.0 -->

This document contains the full stack installation procedure for `cdd:stack`. Follow every step in order.

## Step 1: Check Pre-conditions

Read `.cdd/state.yaml`. Verify:
- `planning.contract.status` is `complete`
- `planning.contract.locked` is `true`
- `foundations.stack.status` is `pending` (not already complete)

If pre-conditions fail, explain why and suggest the correct next command. Stop.

## Step 2: Load Context

Read these files (and ONLY these files):
- `.cdd/config.yaml` — for stack info (language, framework, database, paths)
- `.cdd/state.yaml` — for current progress
- `.cdd/contracts/DEPENDENCIES-DRAFT.yaml` — for the dependency list extracted during contract generation
- `.cdd/contracts/system-invariants.yaml` — for authentication type and design guidelines that reference frontend technologies

If `DEPENDENCIES-DRAFT.yaml` does not exist, proceed to Step 2b (Emergency Scan). Otherwise skip to Step 3.

## Step 2b: Emergency Scan (only if DEPENDENCIES-DRAFT.yaml is missing)

This handles projects where contracts were generated before `cdd:stack` existed. Perform a lightweight scan:

1. Read `.cdd/config.yaml` for the framework, language, and database
2. Read `.cdd/contracts/system-invariants.yaml` — scan `design_guidelines` for technology references (CSS frameworks, JS libraries, etc.)
3. Read ALL files in `.cdd/contracts/modules/*.yaml` — scan ONLY `view_elements.behavior` and `client_behavior` sections for technology references (e.g., "Alpine.js", "React", "drag-and-drop", "real-time", "WebSocket")
4. Compile findings into the same format as DEPENDENCIES-DRAFT.yaml and write it to `.cdd/contracts/DEPENDENCIES-DRAFT.yaml`

This scan must stay lightweight — only extract explicit technology names, not infer requirements.

## Step 3: Check System Requirements

Before installing anything, verify the development environment has the required tools:

1. **Language runtime:** Check the language specified in `config.yaml`:
   - PHP: `php --version` (check minimum version for the framework)
   - Node.js: `node --version`
   - Python: `python --version` or `python3 --version`
   - Ruby: `ruby --version`
   - Go: `go version`

2. **Package managers:** Check the package managers needed:
   - PHP: `composer --version`
   - Node.js: `npm --version` (or yarn/pnpm if specified)
   - Python: `pip --version` or `pip3 --version`
   - Ruby: `gem --version` and `bundler --version`

3. **Database client tools (if applicable):** Only check if the framework installer needs them. Most frameworks don't require the DB client at install time.

**If any required tool is missing:** Report clearly what's missing and how to install it. Stop — do NOT attempt to install system-level tools.

Display:
```
System requirements:
  ✅ [tool] [version]
  ✅ [tool] [version]
  ❌ [tool] — not found (required for [reason])
```

## Step 4: Resolve Versions and Check Compatibility

Using the dependency draft and `config.yaml` stack info:

1. **Determine framework version:** Use web search to find the current stable version of the framework specified in `config.yaml`. Check what minimum language version it requires.

2. **Determine dependency versions:** For each dependency listed in the draft:
   - Use web search to find the current stable version
   - Check compatibility with the framework version
   - Check compatibility with other dependencies in the list

3. **Check for known conflicts:** Look for common incompatibilities:
   - CSS framework version vs build tool version (e.g., Tailwind v4 requires Vite plugin, not PostCSS)
   - Frontend library version vs framework version
   - Language version vs framework requirements

4. **If incompatibilities are found — STOP and prescribe:**

   Display each incompatibility clearly and provide the EXACT `cdd:contract-change` command and changes needed:

   ```
   ═══════════════════════════════════════════════════════════════
   ⚠️  DEPENDENCY INCOMPATIBILITY DETECTED
   ═══════════════════════════════════════════════════════════════

   Issue 1: [Library X] v[N] is incompatible with [Framework Y] v[M]
     Referenced by: [contract file and section where it was referenced]
     Reason: [specific reason — e.g., "Library X dropped support for Y in v3.0"]

     Resolution options:
       a) Use [Library X] v[older] instead (compatible with [Framework Y] v[M])
       b) Use [Alternative Library Z] which provides the same functionality

     Required contract change:
       Run: /cdd:contract-change
       Module: [module-name]
       Section: [section path — e.g., "view_elements.behavior" or "system-invariants.design_guidelines"]
       Current: "[current text referencing the incompatible library]"
       Change to: "[replacement text with compatible library/version]"

   ───────────────────────────────────────────────────────────────
   Fix incompatibilities with /cdd:contract-change, then re-run
   /cdd:stack to continue.
   ═══════════════════════════════════════════════════════════════
   ```

   Do NOT install anything if incompatibilities are found. Stop.

5. **If all compatible:** Display the resolved dependency manifest:
   ```
   Resolved dependencies:
     Framework: [name] v[version]
     Backend packages: [count]
     Frontend packages: [count]
     Dev packages: [count]
     All compatibility checks: PASSED
   ```

## Step 5: Git Checkpoint

Create a safety checkpoint before installing anything:

```bash
node ~/.claude/cdd/hooks/lib/checkpoint.js stack
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
  To undo this stack installation: git reset --hard [hash]
───────────────────────────────────────────────────────────────
```

## Step 6: Install Framework

Install the project framework using the standard installer for the stack:

- **Laravel:** `composer create-project laravel/laravel . --prefer-dist` (if directory is empty except `.cdd/`) or verify Laravel is already present
- **Next.js:** `npx create-next-app@latest . --[options based on config]`
- **Django:** `pip install django && django-admin startproject [name] .`
- **Rails:** `rails new . --[options based on config]`
- **Express:** `npm init -y && npm install express`
- **Other frameworks:** Use the framework's standard project creation command

**Important considerations:**
- If the project directory already has a framework installed (e.g., `composer.json` or `package.json` with the framework listed), verify the version is compatible and skip reinstallation. Display: "Framework already installed: [name] v[version]"
- If the directory has files beyond `.cdd/` and `.git/`, ask the user before overwriting: "Directory is not empty. The framework installer may overwrite existing files. Continue?"
- Preserve the `.cdd/` directory — framework installers must not delete it
- Preserve the `.git/` directory if present

After installation, verify:
```bash
# Laravel
php artisan --version

# Next.js
npx next --version

# Django
python -c "import django; print(django.get_version())"

# Rails
rails --version
```

Display:
```
Framework installed: [name] v[version] ✅
```

If installation fails, report the error clearly and stop. Do NOT continue to dependency installation.

## Step 7: Install Dependencies

Install packages in the correct order:

### 7a: Backend Packages
Install backend/server-side packages from the resolved manifest:

```bash
# PHP/Laravel
composer require [package1] [package2]

# Python/Django
pip install [package1] [package2]

# Node.js/Express
npm install [package1] [package2]

# Ruby/Rails
# Add to Gemfile and run bundle install
```

### 7b: Frontend Packages (Runtime)
Install frontend runtime packages:

```bash
npm install [package1] [package2]
```

### 7c: Frontend Packages (Dev)
Install frontend development packages separately:

```bash
npm install -D [package1] [package2]
```

For each package installed, display:
```
  ✅ [package-name] v[installed-version]
```

If any package fails to install, report the error and stop. Do NOT continue with a partial installation.

## Step 8: Configure Build Pipeline

Set up the build tooling based on what was installed:

### 8a: CSS Framework Configuration
If a CSS framework was installed (Tailwind, Bootstrap, etc.):
- **Tailwind v4 + Vite:** Add `@tailwindcss/vite` plugin to `vite.config.*`, add `@import "tailwindcss"` to the main CSS file
- **Tailwind v3 + PostCSS:** Create `tailwind.config.js` and `postcss.config.js`, add directives to CSS
- **Bootstrap:** Import in the JS/CSS entry point
- **Other:** Follow the framework's standard configuration

### 8b: JavaScript Library Setup
If frontend JS libraries were installed (Alpine.js, React, Vue, etc.):
- Import and initialize in the JS entry point
- **Alpine.js:** Import, assign to `window.Alpine`, call `Alpine.start()`
- **React/Vue:** Should already be configured by the framework installer
- **Other libraries:** Follow their standard initialization

### 8c: CSRF Integration (if applicable)
If the project uses session-based authentication AND has AJAX/fetch endpoints (detected from module contracts' `client_behavior` sections in the dependency draft):
- Configure CSRF token handling appropriate to the framework:
  - **Laravel + Axios:** Axios auto-reads XSRF-TOKEN cookie (built-in)
  - **Laravel + fetch:** Add meta tag to layout, document the fetch pattern
  - **Django:** Configure CSRF middleware, add token to AJAX headers
  - **Rails:** Configure forgery protection, add meta tag
- Document the CSRF pattern in `DEPENDENCIES.yaml` so build sessions know how to make authenticated AJAX calls

### 8d: Entry Point Wiring
Ensure the main JS and CSS entry points import everything that was installed:
- All frontend libraries are imported and initialized
- CSS framework is loaded
- Build tool can find and process all entry points

## Step 9: Verify Build

Run the project's build command to verify everything compiles:

```bash
# Vite-based (Laravel, modern Node.js)
npm run build

# Webpack-based
npm run build

# Django (collectstatic)
python manage.py collectstatic --noinput

# Rails (asset precompile)
rails assets:precompile
```

If the build fails:
1. Read the error output carefully
2. Attempt ONE fix if the error is clearly a configuration issue (wrong import path, missing plugin registration, etc.)
3. Re-run the build
4. If it fails again, report the error clearly and stop. Do NOT update state.

If the build succeeds:
```
Build verification: PASSED ✅
  Build command: [command]
  Output: [summary — e.g., "2 assets compiled, 0 errors"]
```

## Step 10: Write DEPENDENCIES.yaml (Locked Manifest)

Write the final, locked dependency manifest to `.cdd/contracts/DEPENDENCIES.yaml`:

```yaml
# Stack Dependencies
# Generated by cdd:stack — DO NOT modify manually
# Changes require re-running cdd:stack after cdd:contract-change

version: "1.0"
locked: true
installed_at: "[ISO 8601 timestamp]"

framework:
  name: "[framework name]"
  version: "[installed version]"
  install_method: "[command used]"

system_requirements:
  - name: "[runtime]"
    version: "[minimum version]"
  - name: "[package manager]"
    version: "[minimum version]"

backend_packages:
  - name: "[package]"
    version: "[installed version]"
    reason: "[why this package is needed]"
    referenced_by:
      - "[contract file: section]"

frontend_packages:
  - name: "[package]"
    version: "[installed version]"
    reason: "[why this package is needed]"
    referenced_by:
      - "[contract file: section]"
    setup_notes: |
      [How this package is initialized — import statement, config, etc.]

frontend_dev_packages:
  - name: "[package]"
    version: "[installed version]"
    reason: "[why this package is needed]"

build_pipeline:
  bundler: "[vite|webpack|esbuild|none]"
  build_command: "[npm run build|etc.]"
  entry_points:
    js: "[path to main JS entry]"
    css: "[path to main CSS entry]"

csrf_integration:
  required: [true|false]
  method: "[description of CSRF handling approach]"
  notes: |
    [How build sessions should handle CSRF in AJAX calls]

compatibility_verified:
  - check: "[what was checked]"
    result: "[compatible|compatible with notes]"
```

This manifest serves as documentation for foundation and build sessions — they can reference it to understand what's installed and how it's configured.

## Step 11: State Update

Read `.cdd/state.yaml` and update:

```yaml
foundations:
  stack:
    status: complete
    completed_at: "[ISO 8601 timestamp]"
    framework: "[name]"
    framework_version: "[version]"
    packages_installed: [total count]
    build_verified: true
```

## Step 12: Session Footer

Display:

```
═══════════════════════════════════════════════════════════════
✅ CDD:STACK COMPLETE — TECHNOLOGY STACK INSTALLED

Framework: [name] v[version]
Backend packages: [count]
Frontend packages: [count]
Dev packages: [count]
Build verification: PASSED

Installed and configured:
  [list each major component — e.g., "Alpine.js v3.14 — drag-and-drop, async UI"]
  [e.g., "Tailwind CSS v4.0 — utility-first styling via Vite plugin"]
  [e.g., "CSRF integration — meta tag + fetch header pattern"]

Locked manifest: .cdd/contracts/DEPENDENCIES.yaml

───────────────────────────────────────────────────────────────
👉 Recommended next step:
   1. Run /clear to reset your context window
   2. Then run /cdd:foundation db to begin building the
      database foundation layer

   The stack is installed and verified. Foundation sessions
   can now focus entirely on their infrastructure tasks
   without needing to install anything.
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```
