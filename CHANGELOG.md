# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.2.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.2.0
[2.1.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.1.0
[2.0.0]: https://github.com/GallionConsulting/contract-driven-dev/releases/tag/v2.0.0
