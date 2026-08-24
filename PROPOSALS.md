# App & Functionality Proposals

A survey of the 11 installed feature apps and the core platform, followed by
proposals for new functionality and new apps. Each proposal names the existing
platform pieces it would reuse, sketches the schema where one is needed, and
carries a rough size. Nothing here is implemented — this is a menu to pick
from.

## What the platform is good at today

The proposals lean on capabilities that already exist and are proven in
production apps:

- **Scheduled notifications with reconciliation** — an app's cron hands over
  its full reminder plan each run and `reconcileScheduled` diffs it against
  stored rows (events and home pickups both use this). `fanOut` addresses a
  plan to every household member.
- **AI document classification with post-classify hooks** — a classified
  document can mirror itself into another app's record (medical-receipt →
  hsa-receipt, recipe → recipe already do this), guarded by `linked_resource`
  for idempotency.
- **Email ingestion** — the documents cron pulls attachments from a Gmail
  mailbox every 5 minutes.
- **Custom methods** — AEP-136 verbs on a resource, sync or async (AEP-151
  operations), e.g. `grocery:process-image`, `document:split`.
- **Structured field metadata** — references with `onDelete` enforcement,
  discriminated-union object fields, `defaultFromFlag`, `ai.embed` file
  fields feeding semantic search.
- **Chat/MCP tools for free** — every resource automatically gets CRUD tools
  in the AI chat and the MCP server, so new resources are immediately usable
  conversationally.
- **Bulk import/export, dashboard widgets, per-app filters, template
  instantiation** (todos), **favorites** (built-in, currently under-surfaced).

---

## Part 1 — Extensions to existing apps

### 1.1 Home: asset inventory + maintenance schedule ⭐ recommended first

The home app's own code comments name this as the planned follow-up, and the
groundwork is unusually complete: `HomeDocuments` already surfaces
appliance manuals, warranties, and insurance policies from the documents app.
What's missing is the thing those documents describe.

**New resources (home app):**

```ts
// asset: a thing in the house worth tracking
fields: {
  name: { type: 'string', required: true },          // "Furnace", "Dishwasher"
  category: { type: 'string', enum: ['appliance', 'hvac', 'plumbing',
    'electrical', 'roof-exterior', 'yard', 'electronics', 'other'] },
  make: { type: 'string' }, model: { type: 'string' },
  serial_number: { type: 'string' },
  purchase_date: { type: 'string' },
  warranty_expires: { type: 'string' },
  location: { type: 'string' },                      // "Basement", "Kitchen"
  documents: { type: 'array',
    items: { type: 'string', reference: { resource: 'document', onDelete: 'set-null' } } },
  notes: { type: 'string' },
}

// maintenance-task: recurring upkeep bound to an asset (or the house itself)
fields: {
  name: { type: 'string', required: true },          // "Replace furnace filter"
  asset: { type: 'string', reference: { resource: 'asset', onDelete: 'cascade' } },
  interval_months: { type: 'number', required: true },
  last_done: { type: 'string' },
  lead_days: { type: 'number' },                     // notify this many days ahead
  notes: { type: 'string' },
}

// maintenance-log: parented under maintenance-task — one completion
fields: { date: {...required}, cost: { type: 'number' }, notes: {...} }
```

**Wiring:** extend the existing `home-pickup-reminders` cron (or add a
sibling) to `reconcileScheduled` upcoming maintenance into notifications; a
"Due maintenance" dashboard widget next to "Next pickup"; a post-classify
hook so a classified `warranty` or `appliance-manual` document offers to
attach itself to an asset (same pattern as medical-receipt → hsa-receipt).
Warranty-expiry reminders fall out of the same cron.

**Size:** medium. All patterns exist; this is mostly assembly.

### 1.2 Recipes ↔ Groceries: meal planning

`useAddIngredientsToGroceryList` already pushes one recipe's ingredients into
groceries; a meal plan is the missing layer above it.

**New resource (recipes app):** `meal-plan-entry` — `date*`, `slot` enum
`breakfast|lunch|dinner|other`, `recipe` → recipe (set-null), `title` (for
non-recipe entries like "leftovers" or "takeout"), `notes`.

**UI:** a week view on the recipes app (or its own route `/recipes/plan`),
"Tonight's dinner" dashboard widget (order it near the groceries widget), and
a one-click **"shop this week"** action that runs the existing
add-to-groceries hook over every planned recipe, deduping by ingredient name.
The recipe `log` child can gain a "logged from plan" affordance so cooking
history stays effortless.

**Size:** medium. One flat resource, mostly UI.

### 1.3 Documents: expiration tracking + "expiring soon"

Many already-supported doc types expire — insurance policies, warranties,
prescriptions, health-insurance cards — and several metadata variants likely
carry a date already. Two additions:

1. Standardize an `expires_on` key across the metadata variants that have a
   natural expiry (the classifier prompt already extracts per-type metadata,
   so this is a variant-schema change, not new AI work).
2. A small cron that queries documents with `expires_on` within N days and
   `reconcileScheduled`s renewal reminders, plus an **"Expiring soon"**
   dashboard widget.

Also worth adding while in there: **ID doc types** (passport, driver's
license, vehicle registration, TSA/Global Entry card) — high-value expiring
documents households actually scan, and they'd make proposal 2.1 (vehicles)
richer.

**Size:** small–medium.

### 1.4 Todos: due dates + recurrence

Todos currently have no notion of time at all — `pending|do_later|completed|
cancelled` and nothing else. Two conservative additions that keep the app's
simplicity:

- `due_date` (optional, date) + sort/nag affordances: overdue section, an
  entry in the daily digest (proposal 3.1), optional day-of scheduled
  notification.
- `recur_months`/`recur_days` (optional) — completing a recurring todo
  re-creates it with the next due date (a chores-lite that avoids a whole new
  app; assignment can wait, since todos are already household-shared while
  `personal-todo` covers the private case).

**Size:** small. Field additions are additive schema changes, and the chat
tools pick them up automatically.

### 1.5 Games: move bridge to real resources

Bridge is the only app persisting to `localStorage` (`bridge:hands`), so
hands don't sync across devices, aren't shared with the household, and are
lost on a cleared browser. Give it the same shape as minigolf/pictionary:
a `bridge-hand` resource (board number, players → person[], contract,
result, notes), a one-time client-side importer that offers to upload
existing local hands, and stats hooks to join the pictionary-style
leaderboard pattern.

**Size:** small.

### 1.6 Events: calendar (ICS) feed

Events, garbage pickups, meal plans, and maintenance due-dates all live
outside the household's real calendars. A read-only ICS feed — a custom
method or route like `GET /api/calendar.ics?token=…` authenticated by a
personal access token (already built) — lets Google/Apple Calendar subscribe.
Start with events + pickups; each app contributes entries through a small
registry the same way apps contribute dashboard widgets.

**Size:** medium (the auth-by-token-in-URL design needs care; scope a
dedicated read-only token).

### 1.7 Receipts: tax-year package

At tax time the charitable tab, the HSA vault, and the tax-form documents all
matter at once. An async custom method `charitable-receipt:export-tax-year`
(AEP-151 operation, like `document:split`) that bundles, for a given year:
the charitable receipts CSV + scans, HSA receipts kept for reimbursement,
and documents whose metadata `doc_type` is a tax form for that year — into a
single downloadable zip. Pairs naturally with the existing audit-vault views.

**Size:** medium.

---

## Part 2 — New apps

### 2.1 Vehicles ⭐ strongest new-app candidate

Cars are the largest household asset class with no home in the current set,
and every platform piece it needs is proven elsewhere:

- `vehicle` — name*, make/model/year, vin, license_plate, drivers
  (string[] → person), registration_expires, insurance_policy → document
  (set-null), archived.
- `service-record` (parented under vehicle) — date*, odometer, kind enum
  `oil-change|tires|brakes|inspection|repair|recall|other`, cost, shop,
  notes, receipt_file (file).
- Registration/insurance/inspection renewal reminders via
  `reconcileScheduled`; a post-classify hook so a scanned registration or
  auto-insurance-policy document (doc type exists) lands on the right
  vehicle; a "Due soon" widget.

Section: **Home** (or Money). Size: medium — it's the home-assets pattern
applied to a domain with clearer recurring paperwork.

### 2.2 Subscriptions & recurring bills

The Money section tracks cards and gift cards but not the recurring outflow
itself. `subscription` — name*, amount*, cadence enum
`monthly|quarterly|annual`, next_renewal*, payment_method → credit-card
(set-null, optional), category, url, status enum `active|canceled|trial`,
notes. Features: annual-cost rollup widget ("you spend $X/yr across N
subscriptions"), renewal reminders with a `lead_days` per row (a trial
ending is the killer use case), and a "canceled" graveyard for
re-subscribe decisions. Linking to `credit-card` closes a loop with the
perks app (which card pays for what).

Note: perk *reminders* were deliberately removed from credit-cards
(`credit-cards-drop-perk-reminders`), so renewal reminders here should be
opt-in per subscription rather than on-by-default.

**Size:** small–medium — one flat resource plus widgets.

### 2.3 Medications & health per person

The document types are already medical-heavy (prescriptions, immunization
records, EOBs, lab results) and receipts track HSA spend — but nothing
answers "what does this person take, and when does it need refilling?"

- `medication` — name*, person* → person, dosage, schedule (free text),
  refills_remaining, next_refill_date, pharmacy, prescriber, status enum
  `active|paused|stopped`, prescription → document (set-null).
- Refill reminders via `reconcileScheduled`; the People detail page (which
  already aggregates documents and events per person) gains a health tab;
  a post-classify hook links a classified `prescription` document to a
  medication.

Because health data is sensitive, declare the resource `access: { model:
'private' }` (as documents already do) so records are owner-only until
explicitly shared — the grant system and `ShareButton` handle the rest.

**Size:** medium.

### 2.4 Trips & packing

A light app that mostly *composes* existing ones: `trip` — name*,
start_date*, end_date*, destination, travelers (string[] → person), notes,
status enum `idea|planned|booked|done`. The packing list is **not** a new
list implementation: instantiate a todos `list-template` into a project per
trip (the `useInstantiateTemplate` machinery exists), and link travel
documents (passports/IDs from 1.3, confirmations ingested by email) via a
`documents` reference array. A countdown widget reuses the events
countdown pattern.

**Size:** small–medium, high leverage from reuse.

### 2.5 Gifts (People companion)

Events already track birthdays/anniversaries per person; the perennial
companion question is "what did we get them last year, and what ideas do we
have?" `gift` — person* → person, occasion (free text or event → event),
year, idea (bool — idea vs. given), description*, cost, status enum
`idea|purchased|wrapped|given`, url. Surfaces on the Person detail page next
to their events; the events day-of reminder could mention open gift ideas.
Private-by-default matters here too (surprises!): `access: { model:
'private' }`.

**Size:** small.

---

## Part 3 — Platform-level functionality

### 3.1 Morning digest notification

Six apps now produce time-relevant facts (pickups tonight, events today,
due todos, tonight's dinner, expiring documents, upcoming perks) but each
notifies separately or not at all. A core cron that assembles **one**
per-user morning push — apps contribute a `digestContributor` the same way
they contribute dashboard widgets — with a user setting for delivery hour
and per-section toggles. This is the single change that makes the reminder
investment feel coherent rather than chatty.

**Size:** medium; pure composition of existing data hooks.

### 3.2 Surface favorites

The `favorite` builtin (polymorphic per-user stars) exists but is barely
surfaced. A "Pinned" dashboard widget rendering starred records with
app-appropriate cards, plus star affordances in each app's list views,
would make it real. **Size:** small.

### 3.3 An operator UI for actions/runs

The `action`/`run` builtin pair (user-defined server-script automations with
per-run I/O and status) has no visible home. A superuser page listing
actions, showing run history (the operations page pattern), and a "run now"
button would unlock the runtime that's already modeled. **Size:** medium,
superuser-only.

---

## Suggested order

| # | Proposal | Size | Why this order |
|---|----------|------|----------------|
| 1 | 1.1 Home assets + maintenance | M | Already the app's stated roadmap; pure assembly of proven patterns |
| 2 | 2.1 Vehicles | M | Same pattern, clearest recurring-paperwork payoff |
| 3 | 1.4 Todo due dates + recurrence | S | Small, unlocks 3.1 |
| 4 | 3.1 Morning digest | M | Multiplies the value of every reminder-producing app |
| 5 | 1.2 Meal planning | M | Closes the recipes→groceries loop |
| 6 | 2.2 Subscriptions | S–M | Money section gap, one flat resource |
| 7 | 1.3 Document expiry + ID doc types | S–M | Feeds vehicles, trips, and the digest |
| 8 | 1.5 Bridge persistence | S | Data-loss fix more than a feature |

The rest (2.3–2.5, 1.6, 1.7, 3.2, 3.3) are solid but independent — pick by
appetite.
