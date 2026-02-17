# How to Talk to /cdd:brief — An Annotated Example

This document walks through a realistic `/cdd:brief` session for a SaaS project. The user has some technical knowledge but isn't an expert. Annotations in `[brackets]` explain **why** things are said the way they are and call out best practices.

The project: **InvoiceFlow** — a small-business invoicing SaaS.

---

## The Session

### 3a: The Problem & Vision

**Claude:** What problem does this project solve? Who has this problem today, and how do they deal with it?

**User:** Small business owners and freelancers spend too much time creating invoices manually — usually in Word or Excel — emailing them as PDFs, then tracking who's paid in a separate spreadsheet. It's messy and things fall through the cracks. Late payments are a huge problem because there's no automated follow-up.

> `[GOOD: Specific about who, what the current workaround is, and what breaks. This gives Claude concrete pain points to anchor requirements against.]`

**Claude:** What does success look like? Paint me the picture of a user having a great experience with the finished product.

**User:** A freelancer logs in, creates an invoice in under a minute by picking a client and adding line items, hits send, and the client gets a professional email with a payment link. When the client pays, the freelancer gets notified. If they don't pay, the system sends a polite reminder automatically. The freelancer has a dashboard showing what's outstanding, what's overdue, and total revenue this month.

> `[GOOD: Walks through an actual user journey from start to finish. This is much better than "it makes invoicing easier" — Claude would push back on vague answers like that.]`

---

### 3b: Users

**Claude:** Who are the distinct user types? What does each one need to accomplish?

**User:** Two types. The **business owner** who creates and manages invoices. And the **client** who receives invoices and pays them. Clients don't have accounts — they just get a link in an email. Oh, and I guess there's an **admin** for me to manage the platform, but that's really just me poking at the database for now.

> `[GOOD: Identified three user types and was honest that admin is minimal. This prevents Claude from generating a full admin module with role management, user CRUD, audit logs, etc.]`
>
> `[NOTE: "Clients don't have accounts" is an important architectural decision stated early. This means no client auth, no client portal — just tokenized payment links. If you DO want a client portal later, mention it in Out of Scope as a future plan.]`

---

### 3c: Core Features

**Claude:** What are the must-have features for a first version?

**User:** For the first version:
1. Create, edit, and send invoices (with line items, tax, due date)
2. Client list management — save client details so I don't retype them
3. Email delivery of invoices with a payment link
4. Online payment via Stripe
5. Automatic payment reminders for overdue invoices
6. A dashboard showing outstanding, overdue, and paid totals

> `[GOOD: Numbered, clear, and scoped. Six features is a healthy MVP — large enough to be useful, small enough to actually build.]`

**Claude:** Can you describe the basic flow for payment reminders? What triggers it, what happens, what's the outcome?

**User:** When an invoice passes its due date and hasn't been paid, the system should send a reminder email. Maybe 3 days after, then 7 days after, then 14 days. The business owner should be able to see that reminders were sent but shouldn't have to configure the schedule for v1 — just use sensible defaults.

> `[GOOD: Gave specific timing, said "sensible defaults" for v1. This prevents over-engineering a reminder configuration UI. Claude can write one FR with hardcoded intervals rather than a whole settings module.]`
>
> `[BEST PRACTICE: When Claude asks "can you describe the flow?" — answer it! Vague features become vague requirements become modules that are too big or too small.]`

---

### 3d: Out of Scope

**Claude:** What are you explicitly NOT building? What might someone assume is included but isn't?

**User:** Not building for v1:
- **Recurring/subscription invoices** — Phase 2. I know clients will want this but I want to nail one-off invoices first.
- **Multi-currency support** — Phase 2. USD only for now.
- **Client portal** where clients can log in and see their invoice history — Phase 3 maybe.
- **Reporting/analytics** beyond the dashboard — Phase 2. I want a proper report builder eventually.
- **QuickBooks/Xero integration** — Phase 2. This is a big one people will ask about.
- **Mobile app** — not planned at all. Responsive web is fine.

> `[EXCELLENT: This is the most important answer in the entire brief. Notice the pattern:]`
>
> `[1. Each item is named clearly]`
> `[2. Each has a phase label (Phase 2, Phase 3, "not planned")]`
> `[3. "Recurring invoices" and "multi-currency" are called out specifically because someone WOULD assume an invoicing app has them]`
>
> `[This list directly prevents scope creep. Without it, Claude might reasonably generate FRs for recurring invoices because "of course an invoicing app needs that."]`

**However, I want to flag something important:**

**User:** Actually, about multi-currency — if we're storing amounts in the database, should I be worried about adding currency support later? Like, will it be a nightmare to retrofit?

> `[EXCELLENT INSTINCT: This is an architectural landmine check. The user isn't asking to BUILD multi-currency — they're asking whether ignoring it now will cause pain later.]`

**Claude:** Good catch. If every amount column is just a decimal with no currency indicator, adding multi-currency later means migrating every row and updating every calculation. I'd recommend we store a `currency` field on each invoice (defaulting to 'USD') even though v1 only supports USD. That way Phase 2 multi-currency is just UI and conversion logic, not a data migration.

**User:** Yes, do that. Store the currency code but only support USD in the UI for now.

> `[THIS IS THE PATTERN: The user didn't ask to build multi-currency. They asked Claude to make the data model aware of it. The cost is one extra column. The savings are avoiding a contract change + data migration later.]`
>
> `[More examples of architectural landmines to watch for:]`
> `[- Tenant isolation: If you EVER might go multi-tenant, mention it now. Retrofitting tenant_id onto every table is brutal.]`
> `[- Event system: If Phase 2 features will need to react to things happening in Phase 1 (e.g., "when invoice is paid, update QuickBooks"), mention that you want an event dispatch mechanism even if nothing consumes events yet.]`
> `[- Permissions model: If Phase 2 adds team members with different roles, your auth system needs to be role-aware from day one even if v1 only has one role.]`

---

### 3e: Data Model Intuition

**Claude:** What are the main 'things' in your system? How do they relate to each other?

**User:** The main things are:
- **Users** (business owners) — each has an account
- **Clients** — belong to a user. Name, email, address, that kind of thing
- **Invoices** — belong to a user, are sent to a client. Have a status (draft, sent, paid, overdue), due date, total
- **Line Items** — belong to an invoice. Description, quantity, unit price
- **Payments** — belong to an invoice. Amount, date, Stripe reference

**Claude:** Who creates each thing? Who can see it?

**User:** The business owner creates everything. Clients can only see their own invoices via the emailed link — they can't browse or search. Payments are created by the system when Stripe confirms payment.

> `[GOOD: Clear ownership. "Payments are created by the system" is important — it means payment creation is triggered by a webhook, not a user action. This affects the module design.]`

---

### 3f: Technical Constraints

**Claude:** I see from your config you're using Node.js with Express and PostgreSQL. Are there any other technical constraints?

**User:** I'm hosting on Railway. I want to use Resend for email because their API is simple. And I need it to work behind Cloudflare because that's where my domain is.

> `[GOOD: Named specific services. "Work behind Cloudflare" might affect webhook verification (Stripe webhooks need the raw body, and some proxies interfere). Claude can capture this as a technical constraint.]`

---

### 3g: Integration Points

**Claude:** Let's go through the external services. You mentioned Stripe and Resend. Any others?

**User:** Just those two for v1. Stripe for payments, Resend for email. Both are hard requirements — I don't want to fake either one. Oh, and I want to store invoice PDFs somewhere. I was thinking Cloudflare R2 since I'm already using Cloudflare.

> `[GOOD: "Both are hard requirements" is clear. Contrast with "could we stub it initially?" — the user is saying no stubs, real integrations.]`

**User:** One more thing — for Phase 2 I'm planning QuickBooks integration and eventually Google Calendar sync for payment due dates. I don't need either now, but I want to make sure we don't paint ourselves into a corner.

> `[SMART: Mentioned future integrations without asking to build them. This lets Claude think about whether any Phase 1 decisions would block these later.]`

**Claude:** For QuickBooks, the main concern would be having clean, well-structured financial data — which you'll have anyway with proper invoices and payments. No special accommodation needed now.

For Google Calendar, that would need to know when invoices are created and when due dates are set. If we have an event system where the invoice module emits events like `invoice.created` and `invoice.sent`, a future Calendar integration can just subscribe to those events. I'd recommend we include a simple event dispatch in the shared services — even if nothing external consumes events in v1, your payment reminder system can use it internally, and it'll be ready for Calendar/QuickBooks listeners later.

**User:** Love it. Do the event system.

> `[THIS IS THE SECOND LANDMINE PATTERN: Future integration needs → event system now.]`
>
> `[The cost: one shared service (event dispatch) that the reminder system uses anyway.]`
> `[The savings: Phase 2 integrations subscribe to existing events instead of requiring contract changes to add hooks throughout the invoice module.]`
>
> `[Notice Claude didn't say "let's build a Google Calendar stub." It said "let's emit events that a future Calendar module could consume." The event system has value NOW (reminders use it) AND later (integrations subscribe to it). That's the key test: does the architectural accommodation have value in Phase 1, or is it pure speculation?]`

---

### 3h: Design & User Experience

**Claude:** What should the user experience feel like? Are there any UI conventions or visual patterns you want followed?

**User:** Clean and fast. Think "modern SaaS" — not enterprise-y. The target user is a freelancer who isn't very technical. They should never feel confused. I like how Stripe's own dashboard looks — clean typography, good use of whitespace, clear status badges.

> `[GOOD: Named a reference product (Stripe's dashboard). This gives Claude a searchable visual target and is far more useful than adjectives like "modern" or "clean" on their own.]`

**Claude:** That helps for the overall feel. Let me ask about some specifics — layout, components, and consistency. Does the app have a standard page layout you want every screen to share?

**User:** Yes. Fixed header across the top with the logo on the left, and the user's name and a logout button on the right. Left sidebar for navigation — links to Dashboard, Invoices, Clients, Settings. The main content area takes up the rest. Every page should use that same shell. I don't want pages that look like they belong to a different app.

> `[GOOD: Described the layout shell concretely — what's in the header, what's in the sidebar, what sections exist. "Every page should use that same shell" is a consistency rule that will become a shared layout module or component.]`

**Claude:** Got it — consistent app shell everywhere. What about lists and tables? You'll have an invoice list, a client list — should those follow a pattern?

**User:** Yeah, I want a standard data grid pattern. Column headers you can click to sort. A search box above the table to filter by typing. Pagination at the bottom — maybe 25 rows per page. I want that to be the same everywhere there's a list. Don't want the invoice list to work one way and the client list to work differently.

> `[EXCELLENT: Defined a reusable data grid pattern with specific behaviors — click-to-sort columns, search/filter bar, pagination with a row count. "The same everywhere" is the key phrase — this tells Claude to build one shared table component rather than ad-hoc tables per page.]`

**Claude:** Makes sense. Any preference on a component library, or should we build from scratch?

**User:** I've heard good things about Shadcn. Use that if it works with React. For the data grid specifically, I want something that handles sorting and filtering out of the box — I don't want us hand-coding table logic. Use TanStack Table or whatever Shadcn recommends.

> `[GOOD: Named a specific component library (Shadcn/ui) and a table library (TanStack Table). Even "or whatever Shadcn recommends" is useful — it tells Claude the user trusts library defaults and doesn't need bespoke solutions. This prevents the build phase from reinventing table sorting.]`

**Claude:** Last question on design — any specific style rules? Colors, spacing, that sort of thing?

**User:** Stick with Shadcn's default theme for now — I don't want to waste time on custom colors. But I do want consistent status badges everywhere. Invoices have statuses like draft, sent, paid, overdue — those should be colored badges. Use gray for draft, blue for sent, green for paid, red/orange for overdue. Same badge style wherever a status appears — in the table, on the detail page, on the dashboard.

For the API on the payment page — RESTful, JSON, standard HTTP status codes. Nothing fancy.

> `[EXCELLENT: The status badge spec is exactly the kind of detail that prevents inconsistency. Without it, the invoice list might show a green dot, the detail page might show bold text, and the dashboard might show an icon — three different visual languages for the same concept. By specifying "same badge style wherever a status appears," the user ensures one shared component with a defined color mapping.]`
>
> `[PATTERN: The strongest UI answers in this section share three traits:]`
> `[1. They name a specific library or reference app (Shadcn, TanStack Table, "like Stripe's dashboard")]`
> `[2. They define a behavior ("click to sort," "25 rows per page," "same shell everywhere")]`
> `[3. They demand cross-page consistency ("same everywhere," "same badge style wherever")]`
>
> `[Compare this to saying "I want it to look professional." That tells Claude nothing it can enforce. "Shadcn defaults, click-to-sort grids with 25 rows, colored status badges per this mapping" is a concrete spec that flows into contracts and becomes verifiable during the build.]`

---

### 3i: Success Criteria

**Claude:** How will you know the project is done?

**User:**
1. I can create and send an invoice in under 60 seconds
2. A client can pay via the emailed link without creating an account
3. I get notified when payment is received
4. Overdue invoices automatically get reminder emails
5. The dashboard accurately shows outstanding, overdue, and paid totals
6. The whole thing works on mobile (responsive, not a separate app)

> `[GOOD: Concrete, testable, numbered. "Under 60 seconds" is measurable. "Without creating an account" is testable. These become acceptance criteria that feed directly into test generation later.]`

---

## Summary of Patterns Demonstrated

### What the user did well:

| Pattern | Example from session |
|---------|---------------------|
| Described real user journeys, not abstract features | "Creates invoice, hits send, client gets email with payment link..." |
| Was explicit about what's NOT included | Full Out of Scope list with phase labels |
| Asked about architectural consequences of future plans | "Will multi-currency be a nightmare to add later?" |
| Mentioned future integrations without asking to build them | "Planning QuickBooks and Google Calendar for Phase 2" |
| Named specific technical choices | Railway, Resend, Cloudflare R2, Stripe |
| Gave measurable success criteria | "Under 60 seconds", "without creating an account" |
| Was honest about minimal needs | "Admin is just me poking at the database" |
| Answered flow questions with specifics | "3 days, 7 days, 14 days" for reminders |
| Defined UI patterns with library names and behaviors | "Shadcn, TanStack Table, click-to-sort, 25 rows, same badge style everywhere" |
| Described a shared layout shell | "Fixed header, left sidebar, every page uses that same shell" |

### What would have gone wrong without these:

| If the user had said... | Claude would have... |
|------------------------|---------------------|
| "It makes invoicing easier" | Pushed back — too vague to write requirements |
| Nothing about multi-currency | Designed amount columns without currency codes — painful migration later |
| "I want recurring invoices too" | Added 10+ FRs, another module, blown the context budget for MVP |
| "Admin manages everything" | Created a full admin module with role management, user CRUD, etc. |
| "Some kind of notification system" | Not known whether to build email, SMS, push, in-app, or all four |
| Nothing about events | Built tightly-coupled reminder logic, no hook points for Phase 2 integrations |
| "I want it to look professional" | Each page gets ad-hoc styling — invoice list uses cards, client list uses a table, dashboard uses a third layout. No shared components. |
| Nothing about data grids | Built a simple `<table>` for invoices, no sorting/filtering — then needed a full rewrite when the client list needed the same features |
