# CDD Init Workflow

This document contains the full initialization procedure for `cdd:init`. Follow every step in order.

## Step 1: Check for Existing Installation

Check if a `.cdd/` directory already exists in the current project root.

- If `.cdd/` exists AND contains a `config.yaml`:
  - Read the existing `config.yaml` to get the project name
  - Warn the user: "CDD is already initialized for project '[name]'. Re-initializing will overwrite configuration and state files."
  - Ask the user to confirm before proceeding
  - If they decline, stop and suggest `cdd:status` instead
- If `.cdd/` does not exist, proceed to Step 2

## Step 2: Gather Project Information

Use `AskUserQuestion` to collect the following information. Ask all questions in a single prompt where possible to minimize back-and-forth:

**Required:**
- **Project name** — What is this project called?
- **Primary language** — e.g., php, python, typescript, go, ruby, java, csharp
- **Framework** — e.g., laravel, django, express, fastapi, rails, spring, nextjs, none
- **Database** — e.g., postgresql, mysql, sqlite, mongodb, none

**With defaults (ask but offer defaults):**
- **Source code path** — Where does source code live? (default: `src/`)
- **Tests path** — Where do tests live? (default: `tests/`)
- **Migrations path** — Where do migrations live? (default: `migrations/`)

## Step 2a: Database Connection Details (conditional)

If the user chose a **server-based database** (anything other than `sqlite`, `none`, or blank), ask for connection details using `AskUserQuestion`.

Before asking, display this brief notice:
```
Credentials are stored in plain text in .cdd/config.yaml — treat it like your .env file.
```

Ask for the following with smart defaults based on the chosen database:

| Field | MySQL/MariaDB default | PostgreSQL default | MongoDB default |
|-------|----------------------|-------------------|-----------------|
| Host | `localhost` | `localhost` | `localhost` |
| Port | `3306` | `5432` | `27017` |
| Database name | (project name, snake_cased) | (project name, snake_cased) | (project name, snake_cased) |
| Username | `root` | `postgres` | (blank) |
| Password | (blank) | (blank) | (blank) |

Present these as a single `AskUserQuestion` with prefilled defaults the user can accept or override. Use text fields, not dropdowns — developers know what they need here.

If the user chose `sqlite` or `none`, skip this step entirely (no `database_connection` section will be written to config.yaml).

## Step 3: Create Directory Structure

Create the following directory tree in the project root:

```
.cdd/
├── config.yaml          (from template, filled with user answers)
├── state.yaml           (from template)
├── sessions/            (empty directory)
├── contracts/
│   ├── modules/         (empty directory)
│   ├── data/            (empty directory)
│   └── CHANGE-LOG.md    (from template)
```

## Step 4: Write config.yaml

Read the config template from `~/.claude/cdd/templates/config.yaml`.

Replace all placeholder values with the user's answers from Step 2:

- `{{PROJECT_NAME}}` → user's project name
- `{{CREATED_AT}}` → current ISO 8601 timestamp
- `{{PRIMARY_LANGUAGE}}` → user's language choice
- `{{FRAMEWORK}}` → user's framework choice
- `{{DATABASE}}` → user's database choice
- `{{SOURCE_PATH}}` → user's source path (or default)
- `{{TESTS_PATH}}` → user's tests path (or default)
- `{{MIGRATIONS_PATH}}` → user's migrations path (or default)

**Database connection (conditional):** If the user provided connection details in Step 2a, uncomment and populate the `database_connection` section:
- `{{DB_HOST}}` → host (e.g., `localhost`)
- `{{DB_PORT}}` → port number (e.g., `3306`)
- `{{DB_NAME}}` → database name
- `{{DB_USERNAME}}` → username
- `{{DB_PASSWORD}}` → password

If the database is `sqlite` or `none`, leave the `database_connection` section commented out (as it appears in the template).

The `foundations` section stays as an empty array `[]` — foundations are determined during `cdd:modularize` based on requirements analysis.

Write the completed config.yaml to `.cdd/config.yaml`.

## Step 5: Write state.yaml

Read the state template from `~/.claude/cdd/templates/state.yaml`.

Write it as-is to `.cdd/state.yaml` — the initial state requires no substitution.

## Step 6: Write CHANGE-LOG.md

Read the change-log template from `~/.claude/cdd/templates/change-log.md`.

Write it to `.cdd/contracts/CHANGE-LOG.md`.

## Step 7: Display Success Output

Display the following formatted output, substituting actual values:

```
═══════════════════════════════════════════════════════════════
CDD INITIALIZED
═══════════════════════════════════════════════════════════════

Project: [project name]
Stack: [language] / [framework] / [database]
[If database_connection present: "DB: [username]@[host]:[port]/[database_name]"]
Context Window: 200k tokens (40% max usage = 80k per session)

Directory created: .cdd/
  config.yaml ......... project configuration
  state.yaml .......... progress tracking
  sessions/ ........... session handoff files
  contracts/ .......... interface contracts
  contracts/CHANGE-LOG.md

───────────────────────────────────────────────────────────────
✅ CDD:INIT COMPLETE

👉 Recommended: Run /clear then start your next step:
   /cdd:brief

   /clear resets your context window to zero. The .cdd/ state
   files carry everything forward — nothing is lost.

   Or if you already have a project brief, place it at:
   .cdd/contracts/BRIEF.md
───────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════
```
