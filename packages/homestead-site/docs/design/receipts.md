# Receipts — Design

**Status:** Shipped (see §0) · **Audience:** contributors

> This is a design and decision record, not a guide. It answers one question:
> what it takes to turn the HSA Receipts app into a **Receipts** app that also
> holds charitable donation receipts and can tell you what you gave in a year —
> while keeping the HSA UI, its data, and its capture path exactly as they are.

---

## 0. What shipped

All six steps of §7 landed, as designed, in six commits. The three open
questions in §9 were answered yes: `status` stayed, `tax_year` is stored but
optional, and Medical is the default tab.

| Piece | Where |
|---|---|
| The app, renamed | `packages/homestead-apps/receipts/`, id `receipts`, `/hsa` redirects |
| Two tabs | `receipts/components/ReceiptsHome.tsx` (`/receipts?tab=charitable`) |
| The shared kernel | `receipts/shared/` — KPI card, stat tiles, breakdown bars, thumb, empty state, vault shell |
| `charitable-receipt` | `receipts/charitable/resources.ts` |
| The year math | `receipts/charitable/stats.ts`, tested in `receipts/__tests__/charitableStats.test.ts` |
| The charitable tab | `receipts/charitable/components/` |
| Mirroring from Documents | `documents/doc-types/post-classify/charitable-donation-receipt.server.ts` |
| e2e | `receipts/e2e/charitable-crud.spec.ts` (12 specs) beside the 10 medical ones |

**Three details worth knowing that the design below doesn't state:**

1. **The shell owns the add affordance, not the tabs.** `ReceiptsHome` holds one
   "the reader asked to add something" flag and hands it down; what that means,
   and the form it opens, is the tab's business. It keeps the header button and
   the phone FAB in one place without the shell knowing either form.
2. **`useCharitableStats` resolves the default year itself** when the caller
   passes none, reporting what it landed on as `stats.year`. The chicken-and-egg
   (you can't pick a sensible year until you've loaded the receipts that say
   which years exist) belongs in the hook, not in the component.
3. **The by-organization chart is year-scoped but not filter-scoped**, so it
   keeps naming a charity whose donation the status filter has hidden. That's
   deliberate — it answers "who did I give to this year", not "what's in this
   list" — and it's why the e2e assertions scope to `charitable-vault`.

---

## 1. The ask, and the shape of the answer

Two kinds of paper end up in the same drawer for the same reason: you paid for
something out of pocket and the tax code will eventually care. Today one of them
has an app. The other — the charity acknowledgment letter — is already
*classified* by the Documents app (`charitable-donation-receipt` has shipped as a
doc type since the tax-form batch) and then goes nowhere: nothing reads it back,
nothing totals it, and at filing time you are back to searching your inbox.

So the work is not "build a donations app". It is:

1. Rename `hsa` → `receipts` and give it two tabs.
2. Add one resource for charitable receipts.
3. Hang a `post_classify` hook on the doc type that already exists, so the
   Documents pipeline mirrors a donation the way it already mirrors a medical
   receipt.
4. Add the one view the HSA app has no analogue for: **contributions by year**.

Everything else is generalizing four components that are already prop-driven in
all but name.

### Decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| One resource with a `kind` column, or two? | **Two** — `hsa-receipt` (unchanged) + new `charitable-receipt` | Their required fields conflict and their lifecycles differ; see §2.1 |
| Rename the `hsa-receipts` collection? | **No** | aepbase can't rename; a rename means copying every row *and every file blob* and re-pointing grants, for a name no user ever sees. See §2.2 |
| Rename the app id `hsa` → `receipts`? | **Yes** | Nothing durable keys on it — §5 |
| Two pages or two tabs? | **Tabs**, `?tab=charitable`, mirroring `EventsHome` | Same precedent, same nav slot, one KPI region |
| Where does a donation come from? | Documents first, hand-entry second | Same as HSA today; the doc type already extracts every field we store |

---

## 2. Schema

### 2.1 Why two resources, not a `kind` discriminator

The tempting move is one `receipt` collection with `kind: 'Medical' | 'Charitable'`.
It doesn't survive contact with the two schemas:

- `hsa-receipt.category` is **required** with a medical enum (`Medical`/`Dental`/
  `Vision`/`Rx`). A donation can't satisfy it, so unifying means dropping the
  `required` — loosening a constraint that is currently doing real work on ~every
  existing row.
- `status` is required and its values are the *reimbursement* lifecycle
  (`Stored`/`Reimbursed`). A donation is never reimbursed. Sharing the column
  means one enum holding two unrelated state machines.
- `merchant` vs `organization`, `service_date` vs `donation_date`, `patient` vs
  `donor`: same shape, different words, and the words are the whole point on a
  screen someone reads at tax time.
- Collection-scoped access grants key on the **singular** (`hsa-receipt`), not
  the app id. Two collections means someone can be given medical receipts
  without donations, or the reverse, with zero extra machinery.

Against that, the only thing one collection buys is one list query — and the two
tabs never render a combined list anyway.

### 2.2 What stays exactly as it is

`hsa-receipt` / `hsa-receipts` keeps its singular, plural, every field, and every
row. aepbase has no rename: a new name is a new definition, so "renaming" means
creating `receipts`, copying every record, **re-uploading every receipt file
blob**, re-pointing every `linked_resource` on documents, re-pointing
collection-scoped grants, and then authorizing a destructive drop of the old
column set. That is a data-migration release, and it buys a string that appears
in URLs under `/api/aep` and nowhere in the product.

The UI simply stops saying "HSA" where it means "medical". The collection keeps
the name; the tab is called **Medical**.

### 2.3 New: `charitable-receipt`

Lives in the receipts app's `charitable/resources.ts`, aggregated into the app's
`resources: [...]` alongside `hsaResources`. Created on the next boot by the
schema sync — no migration, no backfill.

| Field | Type | Req | Notes |
|---|---|---|---|
| `organization` | string | ✔ | The charity. The `merchant` analogue. |
| `organization_ein` | string | | Printed on most acknowledgments. Distinguishes two chapters that share a name, and is what you'd check against the IRS exempt-org list. |
| `donation_date` | date-time | ✔ | Sorts the vault. The `service_date` analogue. |
| `tax_year` | number | | The year the deduction is claimed against. Optional: falls back to `year(donation_date)`. Stored because a mailed check and its acknowledgment can straddle a year boundary and the letter states which year it counts for. |
| `gift_type` | enum `Cash` \| `Goods` \| `Other` | ✔ (default `Cash`) | `Other` is the honest bucket for stock, mileage, and crypto in v1 — see §8. |
| `amount` | number (`exclusiveMinimum: 0`) | | What you're claiming. **Optional on purpose**: a charity describes donated goods but never values them, so a mirrored goods receipt lands unvalued and the UI asks you for a number (§4.3). |
| `value_received` | number | | Value of goods/services received back, when the acknowledgment states one. Deductible = `amount − (value_received ?? 0)`. |
| `description_of_property` | string | | Non-cash gifts: "3 bags of clothing". |
| `goods_or_services` | string | | The acknowledgment's required wording, verbatim. Kept because a gift of $250+ isn't deductible without it. |
| `donor` | string | | Free text as printed. Mirror of `patient`. |
| `person` | ref → `person`, `onDelete: 'set-null'` | | Canonical link, resolved by `matchPersonByName`. Exact mirror of HSA's `patient`/`person` pair, so the person filter works identically. |
| `status` | enum `Unclaimed` \| `Claimed` (default `Unclaimed`) | ✔ | "Claimed" = included on a return you've filed. Mirrors `Stored`/`Reimbursed` so the vault's mark-as button, the status badge, and the filter are the same component. |
| `receipt_file` | file | | Optional, exactly as on `hsa-receipt`. |
| `source_document` | string | | `documents/{id}`, when mirrored. Stands in for a missing `receipt_file`. |
| `notes` | string | | |
| `created_by` | ref → `user` | | |

Two derived values, computed in the stats hook and never stored — they'd only
drift:

- **Deductible** = `amount − (value_received ?? 0)`, floored at 0.
- **Substantiated** = has a `receipt_file` **or** a `source_document`. A gift of
  $250 or more without one gets a quiet warning badge, not an error.

---

## 3. Capture: the Documents pipeline, already built

`documents/doc-types/charitable-donation-receipt.ts` already exists and already
extracts `organization_name`, `organization_ein`, `donor_name`, `donation_date`,
`donation_amount`, `description_of_property`, `goods_or_services`, and
`tax_year`. Every one of them maps onto a field above. Nothing about the doc type
changes except one line:

```ts
post_classify: () => import('./post-classify/charitable-donation-receipt.server'),
```

The handler is a near-copy of `post-classify/medical-receipt.server.ts` and
follows its rules exactly: server-only module, creates the record through
`serverClient(auth.token)`, links back via `source_document` rather than
duplicating the file, resolves `donor_name` to a `person` best-effort (never
blocking creation), and returns `linked_resource` so a re-classify can't create a
duplicate.

Two mapping decisions worth stating:

- `gift_type` is inferred, not extracted: `donation_amount` present → `Cash`;
  `description_of_property` present with no amount → `Goods`; neither → `Other`.
  The doc type deliberately splits cash from goods at extraction time, so this
  needs no model call.
- `goods_or_services` is copied verbatim into its own field, not folded into
  `notes` (the medical hook folds `items`/`payment_method`/`tax` into notes
  because HSA has no column for them — here we do).

`linkedResource.ts` gains its entry so a document says what it became:

```ts
'charitable-receipts': { label: 'charitable receipt', href: () => '/receipts?tab=charitable' },
```

and the existing `hsa-receipts` entry's href moves from `/hsa` to `/receipts`.

---

## 4. UI

### 4.1 The shell

`/receipts` renders `ReceiptsHome`: a `PageHeader`, a two-item tablist, and the
selected tab's body. The tab lives in the URL (`?tab=charitable`), unrecognized
values fall back to the default — copied verbatim from `EventsHome`, including
`role="tablist"` / `aria-selected` and the `data-testid` shape.

Default tab is **Medical**, so today's `/hsa` regulars land on the page they
already know.

### 4.2 What gets generalized

Four of the six HSA components are already prop-driven; they just have HSA nouns
in their prop names. The vault is the only real piece of work.

| Today | Becomes | Change |
|---|---|---|
| `HSAKPICard` | `shared/ReceiptKPICard` | Props become `{ badge, label, value, caption, footnote, icon, accent }`. Same navy gradient, same fluid headline. |
| `HSAStatTiles` | `shared/StatTiles` | Takes `Tile[]` instead of `HSAStats`; the medical tab passes the three tiles it builds today. |
| `HSACategoryBreakdown` | `shared/BreakdownBars` | Takes `{ key, label, icon?, style, total, count }[]`. Medical passes categories with `categoryConfig` styles; charitable passes organizations with a palette cycled by index (no fixed taxonomy to colour). |
| `HSAReceiptThumb` | `shared/ReceiptThumb` | Takes `{ plural, id, fileField, fileName, sourceDocument, alt }` instead of an `HSAReceipt`. Same image / PDF-icon / source-document / placeholder ladder. |
| `HSAEmptyState` | `shared/ReceiptEmptyState` | Copy and the two how-to cards come in as props. |
| `HSAAuditVault` | `shared/ReceiptVault<T>` + a per-tab column set | The shell (header, filter slot, empty state, desktop table, mobile card list, total footer) is generic over `Column<T>[]` + a `mobileCard` render prop. Both tabs keep the desktop-table / mobile-card split and the deliberately-different accessible names per viewport. |
| `HSAQuickCaptureForm`, `HSAReceiptEditForm` | `medical/…` unchanged | `SchemaForm` over the resource def already does the work; only imports move. |
| `categoryConfig.ts`, `hooks/*` | `medical/…` unchanged | Only `queryKeys.app('hsa')` → `'receipts'`. |

Charitable's forms are new `SchemaForm`s over the new def — same widgets
(`currency`, `PersonReferenceField`, the 10MB image/PDF `fileField`), same
hidden-field treatment for `status` and `source_document`.

If the vault generalization looks like more indirection than it's worth when the
code is in front of us, the fallback is a copied `CharitableVault` — the tradeoff
is one duplicated table against one type parameter, and it can be decided in
review.

### 4.3 The charitable tab

The tab is a year-scoped view, because "what did I give this year" is the only
question anyone asks it.

**Year selector** in the tab header, populated from the years present in the
data, defaulting to the current year, held in the URL (`?tab=charitable&year=2025`)
so the answer is linkable.

**Hero KPI** — the same navy card, saying:

> **Deductible** · Charitable contributions · **$4,180.00** · across 11 receipts in 2025

with a footnote about the $250 acknowledgment rule. Where the medical hero
answers "how much can I withdraw", this one answers "what do I put on Schedule A".

**Stat tiles** (three, as today):

- *Cash gifts* — total and count.
- *Non-cash gifts* — total valued, count, and "N unvalued" when a mirrored goods
  receipt is waiting on a number.
- *Needs attention* — count of receipts ≥ $250 with no acknowledgment on file,
  plus the unvalued ones. Zero is a good state and reads as one.

**By organization** — `BreakdownBars` over the year's receipts, top 6 plus
"Other".

**By year** — the piece with no HSA analogue: a compact table of every year with
data (`Year | Receipts | Cash | Non-cash | Total`), row-click selecting that
year. Three years of history in one glance, and it's what makes the tab answer
the question without a report builder.

**The vault** — `Date | Organization | Type | Amount | Status | actions`, filters
for status and person, "Mark claimed" where the medical tab has "Mark
reimbursed", same edit/delete, same footer total for the current filter.

---

## 5. The rename, and its blast radius

Nothing durable keys on the app id: `hsa` declares no app flags, no user
settings, no dashboard widgets, and — because it owns a collection — its access
grants are collection-scoped on `hsa-receipt`, not app-scoped. So the id is free
to change.

| Touch | Change |
|---|---|
| `packages/homestead-apps/hsa/` | `git mv` → `receipts/`, split into `shared/`, `medical/`, `charitable/` |
| `app.config.ts` | `id: 'receipts'`, `name: 'Receipts'`, `basePath: '/receipts'`; icon, `section: 'Money'`, `navOrder: 4` unchanged |
| `homestead-apps/index.ts`, `homestead.config.ts` | `hsaApp` → `receiptsApp` |
| `queryKeys.app('hsa')` in the medical hooks | `'receipts'` — client cache only |
| `documents/linkedResource.ts` | `/hsa` → `/receipts`; add the charitable target |
| `packages/homestead-app/src/App.tsx` | one `<Route path="/hsa" element={<Navigate to="/receipts" replace />} />` so existing bookmarks survive |
| `tests/e2e/package.json` | `test:hsa` → `test:receipts` |
| Docs | `hsa/README.md` → `receipts/README.md`; the app list in `guides/apps.md`; the passing mentions in `guides/app-config.md` |

**Deliberately not renamed:** the `hsa-receipts` collection and `hsa-receipt`
singular (§2.2), the `medical-receipt` doc type id (it's a persisted
discriminator on every classified document), and the existing medical
`data-testid`s (`add-hsa-receipt-button`, `hsa-receipt-form-submit`,
`hsa-person-filter`, …) — churning them would rewrite passing e2e specs for
nothing. New charitable selectors use a `charitable-*` prefix.

---

## 6. What comes for free

- **Chat and MCP.** Tools are built from the union of `BUILTIN_RESOURCE_DEFS` and
  `getAllResourceDefs()`, so declaring `charitable-receipt` gets read/create/
  update/delete tools with no extra code — "what did we give to the food bank
  last year?" works the day the collection exists. The `reference` annotation on
  `person` is what lets the model resolve a donor id to a name.
- **Permissions.** A new collection joins the household role seeding on the next
  boot, and record-scope sharing (`ShareRecordDialog`) works with no per-app work.
- **Search.** Nothing extra: the search tool resolves references generically.

---

## 7. Build plan

Six steps, each one green through `make ci && make test` on its own, so the
rename can't hide behind the feature.

1. **Rename only.** `git mv`, id/basePath/config wiring, `/hsa` redirect, docs.
   No behavior change; the existing e2e suite is the proof.
2. **`charitable-receipt` resource** + types + hooks (`useCharitableReceipts`,
   `useCharitableStats`, create/update/delete, file-url). Collection appears on
   the next boot.
3. **Generalize the shared components.** Medical tab renders byte-identically;
   again, the existing specs are the proof.
4. **Charitable tab** — vault, forms, KPI, year selector, by-year table.
5. **Documents hook** — `post_classify` on the doc type, the server handler, the
   `linkedResource` entry, and its unit test alongside the medical hook's.
6. **e2e + docs** — `CharitablePage` Page Object, a charitable CRUD spec, seed
   helpers in the app's `e2e/helpers.ts`, README rewrite.

Steps 2 and 5 touch schema and the Documents pipeline; per the repo's rules
that's where `make test-e2e` earns its run.

---

## 8. Out of scope for v1

- **Stock, mileage, and crypto gifts** as first-class types. `gift_type: 'Other'`
  plus `notes` holds them honestly; a mileage rate table and a cost-basis field
  are a second design, not a field.
- **Carryover tracking** (the AGI limit that pushes an unused deduction into next
  year). It needs income, which Homestead doesn't hold.
- **A dashboard widget** ("given this year"). Cheap to add later — the app
  declares none today, and the stats hook it would need lands in step 2.
- **A combined all-receipts list** across both tabs. Nothing asks the two
  questions at once.
- **Non-US framing.** The substantiation rule and Schedule A vocabulary are
  US-specific and stated as such in the copy.

---

## 9. Questions, answered

1. **Does `status` (`Unclaimed`/`Claimed`) earn its place?** Yes. It costs a
   column, buys "which of these did I already file", and makes the charitable
   vault the same component as the medical one.
2. **`tax_year` stored, or always derived?** Stored but optional, deriving from
   `donation_date` when absent — which handles the December-check case without
   making anyone fill in a field that usually restates the date.
3. **Default tab.** Medical, protecting the landing `/hsa` regulars know.
