# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2026-02-15

### Added
- `/cdd:add-module` command — interactive scoping for post-build module additions
  - Conversational discovery (like a mini brief + plan + modularize)
  - Decomposes user requests into one or more modules
  - Generates functional requirements continuing from existing FR numbering
  - Creates addition file in `.cdd/additions/[slug].md` as scoping bridge
  - Appends to REQUIREMENTS.md and MODULES.md (additive only)
  - Updates state.yaml with new modules, build order, and addition tracking
  - Detects and resumes incomplete additions
- `/cdd:add-contract` command — contract generation for added modules
  - Generates one locked module contract per session
  - Loads addition file and dependency contracts (bounded context)
  - Creates/updates data contracts and events registry (additive only)
  - Cross-reference verification (interfaces, data, events, cycles, budgets)
  - Approve/cancel flow with full impact summary
  - Change-logged in CHANGE-LOG.md
  - Tracks per-module contract generation status in state.yaml
- `module_additions` array in state.yaml template for tracking additions
- Module additions section in `/cdd:status` dashboard
- Command count increased from 18 to 20

## [2.4.0] - 2026-02-15

### Added
- `/cdd:fix-request` command — lightweight triage that parses issues into per-module YAML fix files
  - Accepts markdown tables, numbered lists, bullet lists, or plain text
  - Groups issues by module, orders by severity, resolves module names
  - Handles cross-module and system-level issues
  - Filters out issues for incomplete modules (deferred)
  - Generates a run sheet with `/clear` between each step
- Command count increased from 17 to 18

### Changed
- `/cdd:fix` redesigned from monolithic batch processor to per-module fix file processor
  - Now takes a fix file name as argument (from `/cdd:fix-request` output)
  - Processes ONE module per session instead of all modules at once
  - No inline verify/test — those run as separate sessions afterward
  - Writes completed fix files to `.cdd/fixes/completed/` and deletes pending
  - Resets `verified`/`tested` flags to force re-verify and re-test pipeline
  - Sets `phase: build_cycle` if currently `complete` to unlock verify/test gates
  - Peak context per session: ~30-60k tokens (was ~150k+)
- `/cdd:test` Step 8d completion check now requires ALL modules to have both `status: complete` AND `tested: true` (prevents premature phase completion after multi-module fix)
- `/cdd:audit` remediation recommendations now reference `/cdd:fix-request` workflow
- `/cdd:status` detects post-fix state (`complete` but `verified: false`) and pending fix files
- `/cdd:help` updated with fix-request command and fix description

## [2.3.0] - 2026-02-15

### Added
- `/cdd:fix` command — batch issue processor for audit/review findings
  - Parses issues from markdown tables, numbered lists, or bullet lists
  - Delivers verdicts: CONFIRMED, FALSE_POSITIVE, CONTRACT_ISSUE, DEFERRED
  - Applies targeted fixes with inline verify+test per module
  - Writes timestamped reports to `.cdd/fixes/` for historical reference
  - Respects contract boundaries (no signature changes, no cross-module edits)
  - Up to 2 retry cycles for test regressions caused by fixes
- Command count increased from 16 to 17

## [2.2.0] - 2026-02-15

### Removed
- `/cdd:complete` command — module completion is now handled automatically by `/cdd:test` when all tests pass

### Changed
- `/cdd:test` now marks the module complete, identifies newly unblocked modules, shows progress, and recommends the next module to build
- Build cycle reduced from 4 steps (build → verify → test → complete) to 3 steps (build → verify → test)
- Command count reduced from 17 to 16

## [2.1.0] - 2026-02-15

### Added
- Public column visibility (`public: true`) in data contract schema
- Public table template with `public_table` flag and `writers` list for multi-writer support
- Column-level access filtering in build workflow (owned=full, standard reads=declared columns only, public tables=full)
- DATA ACCESS and DATA SCHEMA display sections in build step 5
- Column visibility spot-checking in verify and audit workflows
- Public column/table impact rules in contract-change workflow (public→private = HEAVY, additive = LIGHT)
- Completeness check 7f (Public Column Consistency)

### Changed
- Updated data ownership philosophy and key rules in README to reflect public columns, public tables, and multi-writer model
- Build steps 7/8/11 write rules now include public table targets
- Verify step 7 reads now check column-level access for non-owned standard tables

## [2.0.0] - 2026-02-15

Initial public release.

### Added
- 17 slash commands for contract-driven development workflow
- Hook system: session-start, update-check, statusline, scope-guard, on-stop
- Shared libraries: state management, notifications, transcript parsing
- Zero-dependency installer (`bin/install.js`) targeting `~/.claude/`
- Automatic update checking against npm registry
- Statusline integration with ANSI escape codes (Windows-compatible)

[2.5.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.5.0
[2.4.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.4.0
[2.3.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.3.0
[2.2.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.2.0
[2.1.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.1.0
[2.0.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.0.0
