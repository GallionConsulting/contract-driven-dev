# /cdd:brief — Discussion Cheat Sheet

Quick reference for getting the most out of your brief session. Read this before you start.

---

## Before You Begin

Spend 10 minutes thinking about these before running `/cdd:brief`:

- [ ] Who actually uses this? (Not "users" — be specific: "freelancers", "HR managers", "API consumers")
- [ ] What's the ONE core workflow? (The thing that, if it doesn't work, the product is pointless)
- [ ] What are you NOT building? (This matters as much as what you are building)
- [ ] What external services are non-negotiable? (Stripe, SendGrid, S3, etc.)
- [ ] Any future plans that might affect today's architecture?
- [ ] What should the UI look like? (Name a library, a reference app, or both — not just "clean and modern")

---

## The Golden Rules

### DO: Be specific about user journeys

```
BAD:  "Users can manage their projects."
GOOD: "A project manager creates a project, adds team members by email,
       sets a deadline, and tracks progress through a kanban board.
       Team members get an email invitation and can see only their
       assigned tasks."
```

Why: Vague features become vague requirements become modules that are the wrong size.

### DO: Use the Out of Scope section aggressively

```
BAD:  [not mentioning recurring invoices at all]
GOOD: "Recurring invoices — Phase 2. One-off invoices only for v1."
```

Why: If you don't say it's out, Claude may reasonably assume it's in. An invoicing app "obviously" has recurring invoices. A project tool "obviously" has time tracking. State your boundaries.

### DO: Label future plans with phases

```
BAD:  "We might want Slack integration someday."
GOOD: "Slack integration — Phase 2. Mobile app — not planned.
       QuickBooks sync — Phase 3."
```

Why: Phase labels help Claude distinguish "coming soon, design for it" from "vague wish, ignore it."

### DO: Ask about architectural consequences

```
GOOD: "I want multi-currency in Phase 2. Does that affect how we
       store amounts now?"
GOOD: "We'll add team members later. Should auth be role-aware
       from the start?"
GOOD: "Phase 2 has webhook integrations. Do we need an event
       system now?"
```

Why: Some decisions are cheap now and expensive later. Claude can identify these if you tell it what's coming.

### DO: Answer "describe the flow" questions

When Claude asks "what triggers this, what happens, what's the outcome?" — answer it with steps:

```
BAD:  "The system sends reminders."
GOOD: "When an invoice is 3 days past due, send a reminder email.
       Then again at 7 days and 14 days. The business owner should
       see that reminders were sent but doesn't configure the schedule."
```

### DO: Name specific tools and services

```
BAD:  "Some kind of email service."
GOOD: "Resend for transactional email. It's a hard requirement."
```

```
BAD:  "Cloud hosting."
GOOD: "Railway for hosting, Cloudflare R2 for file storage."
```

### DO: Define UI patterns with names, behaviors, and consistency rules

The three things that make UI specs enforceable: **name a library**, **define a behavior**, **demand cross-page consistency**.

```
BAD:  "I want it to look professional and modern."
GOOD: "Use Shadcn/ui for components. Use TanStack Table for data grids.
       Every list view should have click-to-sort columns, a search box
       above the table, and pagination at 25 rows per page. Same pattern
       on every list screen."
```

```
BAD:  "Nice status indicators."
GOOD: "Color-coded status badges: gray for draft, blue for sent,
       green for paid, red for overdue. Same badge component
       everywhere a status appears — tables, detail pages, dashboard."
```

```
BAD:  "Standard layout."
GOOD: "Fixed header with logo and user menu. Left sidebar with nav links
       to Dashboard, Invoices, Clients, Settings. Every page uses that
       same shell — no page defines its own header or nav."
```

Why: Without concrete UI specs, each module gets built in isolation and ends up with a different visual language. The invoice list uses cards, the client list uses a plain table, and the dashboard uses a third layout. Naming a component library and demanding "same pattern everywhere" prevents this — it becomes a shared component in the contracts.

**Tip:** Naming a reference app ("like Stripe's dashboard") is good *in addition to* specifics, not as a replacement for them. "Like Stripe's dashboard" plus "Shadcn/ui, click-to-sort grids, colored status badges" gives Claude both the vibe and the spec.

### DO: Give measurable success criteria

```
BAD:  "The app should be fast and easy to use."
GOOD: "I can create and send an invoice in under 60 seconds.
       A client can pay without creating an account.
       The dashboard loads in under 2 seconds."
```

---

### DON'T: Ask for stubs or placeholders

```
BAD:  "Stub in Slack integration but make it inaccessible."
GOOD: "Slack integration is Phase 2. Put it in Out of Scope."
```

Why: CDD has no concept of dormant modules. Modules are built or they're not. Use `/cdd:add-module` when you're ready to actually build it.

### DON'T: Describe implementation details

```
BAD:  "Use a Redis-backed job queue with exponential backoff
       for the reminder system."
GOOD: "Overdue invoices should get automatic reminder emails
       at 3, 7, and 14 days."
```

Why: The brief captures WHAT and WHY, not HOW. Implementation decisions happen during contract and build phases.

### DON'T: Say "and also..." for every nice-to-have

```
BAD:  "And also it would be nice to have charts, and maybe
       export to CSV, and a dark mode, and maybe an API
       for third parties, and..."
GOOD: "The dashboard shows outstanding, overdue, and paid totals.
       Charts, CSV export, and public API are Phase 2."
```

Why: Every feature you add inflates the requirements document, which inflates the module count, which inflates the context budget. The brief interview actively pushes you to cut scope — work with it, not against it.

### DON'T: Be vague about who does what

```
BAD:  "Users can manage things."
GOOD: "Business owners create invoices. Clients view and pay them
       via emailed links — no account needed. Admin is just me
       querying the database directly for now."
```

Why: User types with different permissions or workflows become different modules or different permission scopes. Getting this wrong means rework during contracting.

### DON'T: Skip the "who creates it / who sees it" questions

```
BAD:  "There are invoices and payments in the system."
GOOD: "Business owners create invoices. Payments are created
       automatically when Stripe confirms payment via webhook.
       Clients see only their own invoices via a tokenized link."
```

Why: Ownership and visibility determine module boundaries, API permissions, and data access patterns. This is foundational.

---

## The Architectural Landmine Checklist

These are decisions that are **cheap to make now** and **expensive to change later**. Scan this list and bring up any that apply to your project:

| Future Plan | What to mention in the brief |
|-------------|------------------------------|
| **Multi-tenant** (teams, orgs, workspaces) | "Phase 2 adds teams. Should we have a tenant_id from day one?" |
| **Multi-currency** | "Store currency code on financial records even if v1 is single-currency" |
| **Team/role expansion** | "Auth should be role-aware even if v1 has one role" |
| **External integrations** (webhooks, Slack, calendar) | "Include event dispatch in shared services so future integrations can subscribe" |
| **Internationalization (i18n)** | "Keep user-facing strings in a structure that supports translation later" |
| **Audit trail** | "If compliance/audit is coming, log data mutations from day one" |
| **API for third parties** | "Design internal API routes as if they'll be public — consistent naming, proper status codes" |
| **File attachments** | "Abstract file storage behind a service interface, not direct S3 calls, so you can swap providers" |
| **Soft delete** | "If you'll ever need to recover deleted records, use soft delete from the start" |
| **Notification channels** (email now, Slack/SMS later) | "Route notifications through a dispatch service, not direct email calls from business logic" |

**The test:** Ask yourself — "If Phase 2 needs X, will it require changing the *data model* or *module interfaces* of Phase 1?" If yes, it's a landmine. If it's purely additive (new module, new UI, new integration), it's safe to defer.

---

## Quick Reference: What Goes Where

| What you're describing | Where it belongs in the brief |
|------------------------|-------------------------------|
| Current features to build | **Core Features** |
| Future features NOT being built | **Out of Scope** (with phase label) |
| Architectural decisions for future-proofing | **Data Model** or **Technical Constraints** |
| External services needed now | **Integration Points** (mark as "required") |
| External services needed later | **Out of Scope** + mention in **Integration Points** if it affects architecture |
| "It should feel like Stripe's dashboard" | **Design & User Experience** (vibe) |
| Component library, grid behaviors, layout shell, badge specs | **Design & User Experience** (concrete specs) |
| "It must run on Railway" | **Technical Constraints** |
| "Admin is just me for now" | **Users** (prevents over-engineering) |
| Performance targets | **Success Criteria** |

---

## The 30-Second Version

1. **Be specific** — journeys not features, names not "some service"
2. **Cut scope hard** — Phase 2 it, don't build it
3. **Flag landmines** — ask "does ignoring X now hurt us later?"
4. **Answer flow questions** — triggers, steps, outcomes
5. **Spec the UI** — name a library, define behaviors, demand consistency
6. **Measure success** — numbers, not feelings
