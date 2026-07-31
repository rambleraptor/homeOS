# Homestead Permissions — Design

**Status:** Draft for review · **Scope:** Design only (no implementation)

This document proposes a permissions system for Homestead that lets specific
people have specific access to specific resources. It combines three
mechanisms the household requested — **roles**, **groups (lists of users with
roles)**, and **per-resource ACLs** — enforced authoritatively in the engine,
at both collection and record (row) granularity.

---

## 1. Goals and non-goals

### Goals

- **Roles.** Named bundles of capability that can be assigned to users
  (superseding today's binary `superuser`/`regular`).
- **Groups.** Named lists of users, where a membership can itself carry a role
  ("the *Parents* group has `manage` on the finances apps").
- **Per-resource ACLs.** Explicit grants of a capability to a user, group, or
  role — on a whole collection (`all gift-cards`) or a single record
  (`gift-card #42`).
- **Engine-enforced.** The API is the real boundary. A crafted request cannot
  bypass the rules; the SPA only mirrors them for UX.
- **Backward compatible.** A default install keeps today's behavior: one
  household, every member reads and writes everything. Nobody gets locked out
  on upgrade.
- **Opt-in strictness.** Apps that want privacy (personal notes, a single
  person's HSA receipts) can opt a resource into an owner-only or ACL model
  without forcing that overhead on every collection.

### Non-goals (this iteration)

- **Field-level permissions** (hide a column from some users). Out of scope;
  the model leaves room for it later.
- **Multi-household / tenancy.** One instance is still one household. Groups
  partition *within* a household; they are not tenants.
- **Realtime propagation.** Grants take effect within the existing access-cache
  TTL, same as app flags today.
- **Replacing account-tags wholesale.** Tag-based app visibility keeps working;
  §9 describes how it relates to (and can later fold into) groups.

---

## 2. Where we're starting from

Everything below is what exists today — the seams the design plugs into.

| Mechanism | File | What it does |
|---|---|---|
| `AccessCheck` hook (injected) | `engine/engine.ts` (called ~L201); impl `engine/access.ts` `makeAccessCheck`/`decide` | Coarse **per-app / per-collection** gate run after auth, before routing. Looks only at `segments[0]`. Values: `none`/`all`/`superusers`/`tagged`. |
| `TokenValidator` (injected) | `engine/engine.ts` (~L192) | Resolves a bearer token to `caller: User \| null`. |
| `checkUserScope` | `engine/crud.ts:77`, called `engine/router.ts:123` | The **only** row-level check today. Compares the `user_id` *from the URL path* against `caller.id`. Superusers bypass. Only fires for `user`-parented resources. |
| `checkSuperuserWrite` | `engine/crud.ts:93`, called on mutating branches | Per-resource `superuser_write` flag → superuser-only writes. |
| Per-handler user checks | `engine/users.ts` | self-or-superuser rules on `/users`; only a superuser may change a user's `type`. |

Key facts that constrain the design:

- **No owner column exists.** `store.ts` is policy-free: it scopes queries by
  `path` and by parent FK columns (`<parent>_id`) only — never by `caller`.
  `created_by` is present on nearly every resource but is **app-set** (written
  as the path `users/{id}`), **optional**, and **purely informational** — never
  enforced. (`operations/resources.ts`: "`created_by` records the initiator for
  display only.")
- **Roles are binary.** `UserType = 'superuser' | 'regular'` is the entire role
  model (`auth/types.ts:7`). "Admin" colloquially means the bootstrapped
  superuser.
- **No household/group/sharing entity** exists. Every top-level collection
  (todos, groceries, gift-cards, people, …) is **implicitly shared across every
  authenticated user** — any of them can read and write every row. Only
  `user`-parented resources (preferences, notifications, account-tags) are
  owner-scoped, and that scoping is path-derived, not row-derived.
- **`decide()` (server, authoritative) and `resolveVisibility()` (client,
  UX-only) are paired** and must stay in sync. The design keeps that discipline.
- **CLAUDE.md already lists** "Per-collection access rules (row-level security
  beyond user parenting)" under *Not yet modeled* — this is the sanctioned gap
  to fill.

---

## 3. Core model

### 3.1 Principals

A request's `caller` expands to a **principal set** used for matching grants:

```
principals(caller) = {
  user:<caller.id>,
  group:<g> for each group the caller belongs to,
  role:<r> for each role the caller holds (via direct assignment or group),
  everyone,                       // any authenticated user
  owner        // pseudo-principal, only when caller owns the record in question
}
```

Superusers are a hard override: they resolve to full control everywhere and
skip evaluation (preserving today's behavior).

### 3.2 Capabilities

A small, totally-ordered ladder. Higher implies lower.

| Capability | Rank | Implies | Meaning |
|---|---|---|---|
| `none` | 0 | — | explicitly no access |
| `read` | 1 | — | GET / LIST / `:download` |
| `write` | 2 | read | create / update / **delete** (POST / PATCH / PUT / DELETE) |
| `manage` | 3 | write, read | full control **+ may grant/revoke others' access** to the target |

**Decided (§11 #2): `delete` is folded into `write`.** A single mutate
capability keeps the ladder to four rungs and the mental model simple — if you
can edit a record you can remove it. (A separate "edit but not delete" tier can
be added later as its own rank if a real need appears; nothing here forecloses
it.)

### 3.3 Grants

A **grant** ties a principal to a capability over a target. The target sits at
one of **four scope levels**, from broadest to narrowest:

```
grant := {
  subject:   { type: user|group|role|everyone, id? },   // id omitted for `everyone`
  capability: read | write | manage,          // write covers create/update/delete
  effect:     allow | deny,                              // deny optional; see §4
  target: {
    scope:          all | app | collection | record,
    app?:           <app id>,           // when scope = 'app'      e.g. 'credit-cards'
    resource_type?: <collection singular>,  // when scope = 'collection' | 'record'
    resource_id?:   <record id>         // when scope = 'record'
  }
}
```

| Scope | Target | Example |
|---|---|---|
| `all` | the whole household | `member` → `write` on `*` |
| `app` | every collection an app owns | `read` on the `groceries` app |
| `collection` | one resource type | `read` on all `recipe`s |
| `record` | one row | share `todo #42` with Bob, read-only |

The `app` level matters because households think in apps, not collections:
"share the groceries app" is one grant, not one per (`grocery`, `store`)
collection. The engine expands an app-scoped grant to the app's collections via
the same `collectionToApp` map the app-access gate already uses.

### 3.4 Roles

A **role** is a named, reusable bundle of collection-level grants:

```
role := {
  id, name, description,
  grants: [ { resource_type, resource_id?, capability } ]   // effect implied allow
}
```

Roles are **data** (a superuser-managed resource), not hardcoded config, so the
household can add "Teen" or "Guest" without a code change. Three roles ship
built-in and are seeded on migration (§8). With the four scope levels from
§3.3, each collapses to a single grant:

- **`admin`** — `manage` on `*` (scope `all`). The former `superuser`. (The
  engine still recognizes `caller.type === 'superuser'` as the ultimate
  override; the `admin` role is the assignable, data-driven equivalent for
  everyone else.)
- **`member`** — `write` on `*` (scope `all`; write covers delete). This is what every
  existing `regular` user becomes, so **upgrade is behavior-preserving**.
- **`guest`** — no `*` grant; `read` at the `app` scope on whichever apps are
  shared with them (default: none until an admin grants one).

### 3.5 Groups

A **group** is a named list of users; a membership can carry a role, satisfying
"lists of users with roles":

```
group           := { id, name, description }
group-membership := { group_id (parent), user, role? }   // role optional
```

A user in a group inherits: (a) `group:<id>` as a principal (so a grant to the
group applies), and (b) any `role` named on their membership (so
`group:<Parents>` membership with `role:manage-finances` grants those role
capabilities). Groups do **not** nest in v1 (flagged as a possible extension).

### 3.6 Filter-scoped grants (attribute-based)

Enumerating record ids doesn't scale for rules like "everyone can see the
recipes they wrote" or "the kids can read events tagged `family`." For these, a
`collection`-scope grant may carry a **filter** — an expression in **the same
subset the List endpoint already accepts** — that dynamically selects the
records the grant covers:

```
grant := { subject, capability, effect,
           target: { scope: collection, resource_type: <x>, filter: <expr> } }
```

Semantics: the subject gets `capability` on records of `resource_type` **where
`filter` matches**. A `collection`-scope grant with **no** filter still means
*all* records (the current broad case); a filter narrows it to a dynamic subset.
This is the ABAC middle ground between `collection` scope (everything) and
`record` scope (one enumerated id), and it's what answers the household's "show
which resources someone is allowed access to" — the allowed set is *computed*,
not listed.

**Reusing Homestead's filter engine.** The engine's `compileFilter` (today only
List uses it, `engine/filter.ts`) parses that subset — comparisons
(`== != < <= > >=`) on schema fields, combined with `&& || ()` — and **compiles
to a parameterized SQL `WHERE` fragment**. That output is exactly what
enforcement needs, so filter-grants reuse it verbatim. Fields are validated
against the target collection's schema at grant-write time (unknown field →
reject, same 400 contract List gives).

> Note on "CEL": the historical Go server accepted full CEL, but this engine
> implements only the practical subset above (see the `engine/filter.ts` header).
> Filter-grants inherit that subset — not full CEL. §11 #7 tracks the grammar
> extensions (`in`, `contains`, standard-field comparisons) worth adding, driven
> by real access rules rather than speculatively.

**The `subject.*` binding — the one extension needed.** List filters only
reference *record* fields. Access rules also need to reference the *caller*, so
we add a reserved `subject` namespace whose members bind to the caller at
evaluation time (as SQL parameters, never interpolated):

| Operand | Binds to |
|---|---|
| `subject.id` | `caller.id` |
| `subject.email` | `caller.email` |
| `subject.display_name` | `caller.display_name` |

So `owner == subject.id` compiles to `owner = ?` with the caller's id bound —
"records you own." `created_by == subject.id && status != 'archived'` — "your
non-archived records." Group/role membership tests (`team in subject.groups`)
need an `in` operator the subset lacks; that's §11 #7, not v1.

### 3.6.1 One filter compiler, shared by List and permissions

**Decision: extend the existing minimal subset in place — never fork it.** The
whole point of reusing List's grammar is that there is exactly **one**
`compileFilter` (`engine/filter.ts`); List and permission grants are two callers
of it, so any future operator (`in`, `contains`, standard-field comparisons)
added for one **immediately benefits the other**, and the two can never drift
into subtly different dialects.

To keep it a single code path while adding the caller binding safely,
`compileFilter` gains **one optional argument** — a subject context — rather than
a parallel function:

```ts
// today:   compileFilter(filter, schema)
// becomes: compileFilter(filter, schema, opts?: { subject?: SubjectBindings })
```

- **List** calls it exactly as today (no `subject`). With no subject context, a
  `subject.*` operand is an **unknown field → the same 400** List already
  returns — so List's surface is unchanged and can't be widened by accident.
- **Permission grants** pass `{ subject }`, enabling the `subject.<attr>`
  allowlist to resolve to bound parameters.

That's the only permission-specific seam. Everything structural — the tokenizer,
operator table, parser, parameterization, SQL shape, field validation, the
encrypted-field guard — stays shared and untouched. New grammar (§11 #7) is a
change to that shared core, so it lands once and lifts both callers. The
`subject.*` allowlist lives beside the compiler (not inside each caller) so it,
too, has a single definition.

---

## 4. Resolution algorithm

Given `(caller, verb, resource_type, resource_id?)`:

1. **Superuser break-glass.** `caller.type === 'superuser'` ⇒ allow,
   unconditionally — the one rung above deny (§4.2). This is the account *type*,
   not the `admin` *role* (which is ordinary data and stays beatable by a deny).
2. **App gate first.** The existing `AccessCheck` app-visibility gate runs
   unchanged (none/all/superusers/tagged). If it denies, stop — no point
   evaluating record rules for an app the caller can't open. (Ordering: app
   gate → permission resolver.)
3. **Collect applicable grants.** From all grants whose `subject` is in
   `principals(caller)` and whose target matches the request at **any of the
   four scope levels**, gather:
   - `all`-scope grants,
   - `app`-scope grants for the app that owns `resource_type`,
   - `collection`-scope grants for this `resource_type` — a grant with a
     **filter** counts only if its compiled predicate matches the row (for
     single-record ops) or contributes its predicate to the query (for LIST,
     §4.1),
   - `record`-scope grants for this `resource_id` (if any),
   - role-derived grants (expanded from the caller's roles, at whatever scope
     the role declares),
   - the implicit **owner ⇒ `manage`** grant if `caller` owns the record,
   - the implicit **`everyone`** grants.
4. **Reduce.** Map the required `verb` to a capability (`GET`→`read`,
   `POST`/`PATCH`/`PUT`/`DELETE`→`write`, sharing→`manage`).
   - `allowRank` = max rank among matching **allow** grants.
   - `denyRank`  = max rank among matching **deny** grants.
   - **Decision:** allow iff `requiredRank ≤ allowRank` **and**
     `requiredRank > denyRank` (an explicit deny at ≥ the required rank wins).
5. **Default deny** if nothing matched.

**Precedence, stated plainly — deny always wins:**

```
superuser account (break-glass, §4.2)
  > any deny  (at ANY scope: all / app / collection / record)
    > owner / allow / role / everyone  (highest capability wins among these)
      > default-deny
```

**Deny is absolute.** A deny that applies to the caller at the required
capability blocks the request, full stop — no allow, owner grant, role, or more
specific grant can override it. **Scope specificity does not override effect:** a
broad `all`- or `app`-scope `deny read` beats a narrow `record`-scope
`allow read`. There is exactly one thing above a deny — the superuser
break-glass in §4.2 — and it exists only so an install can't be permanently
locked out. This keeps the model trivially predictable ("a deny is a deny") and
makes the "everyone-except-Bob" case (§9.1) expressible: a blanket `member` `*`
allow plus a `deny` for one user cleanly blocks that user while everyone else
keeps access.

> **Decided (§11 #1): deny ships in v1, at all four scopes.** Earlier drafts
> considered limiting deny to `app`/`collection` scope or shipping allow-only;
> both are dropped. Deny is a first-class effect at `all`, `app`, `collection`,
> and `record` scope, and always wins. Note that because `owner ⇒ manage` is an
> *allow*, an owner also loses to a deny — owning a record does not exempt you
> from a deny that targets you.

### 4.1 The LIST problem (the hard part)

Single-record ops are easy — resolve, then allow/deny. **LIST** is where record
ACLs get expensive, because today `store.listResources` returns every row in
scope and we must not fetch-then-filter (it breaks pagination and counts).

The resolver computes a **visibility predicate** — an **allow half** ORed
together, then a **deny half** ANDed as `NOT (…)`. Because deny always wins
(§4), the deny half is applied in *both* branches below.

1. **Allow half.**
   - If the caller has a **broad `read`** at `all`/`app`/`collection` scope that
     survives its own denies → start from **all rows** (`WHERE 1=1`; today's
     behavior, the common member case).
   - Otherwise → the union the caller *can* see:
     ```sql
     ( owner = :caller                                    -- rows you own
       OR id IN (:record_ids_granted_to_caller)           -- enumerated record grants
       OR (<compiled allow filter-grant #1>)              -- e.g. created_by = :caller
       OR (<compiled allow filter-grant #2>) )            -- e.g. status = 'shared'
     ```
     The record-id set is one indexed lookup of `record`-scope allow grants whose
     subject ∈ `principals(caller)`; each **filter-grant** (§3.6) contributes its
     `compileFilter` `(sql, params)` as one more OR clause, `subject.*` bound to
     the caller.
2. **Deny half (always applied).** Any deny that targets the caller subtracts —
   including record-scope denies, so they're removed even on the broad-read fast
   path:
   ```sql
   AND id NOT IN (:record_ids_denied_to_caller)   -- enumerated record denies
   AND NOT (<compiled deny filter-grant>)          -- e.g. NOT (sensitive = 1)
   ```
   (A surviving `all`/`app`/`collection`-scope *allow* already accounts for
   same-or-broader denies in step 1 — if such a deny existed the caller wouldn't
   have the broad read — so the deny half here is about the *narrower* denies
   that carve holes in an otherwise-broad allow.)

This is the payoff of reusing List's filter engine: the whole predicate stays in
SQL and **fully paginated** — no per-row evaluation, no fetch-then-filter. It
drops straight into `listResources`, which already accumulates `whereClauses[]`
+ `args[]` (`engine/store.ts`) and folds a `compileFilter` result in exactly
this way for the user-supplied List `filter`. A caller's own List `filter` and
the permission predicate simply AND together — a user can only ever narrow
within what they're allowed to see.

This requires two additive things the store doesn't have today: the **stored
`owner` column** (§5) and an optional **`visibility` argument** on
`listResources` that appends these clauses.

**Single-record ops (GET/PATCH/DELETE) with a filter-grant** run the same
predicate as a guard — `SELECT 1 FROM <table> WHERE id = ? AND (<filter>)` —
so single-record and LIST semantics are identical by construction (no risk of a
row being listable but not gettable, or vice-versa).

### 4.2 The superuser break-glass (the one thing above a deny)

Because deny always wins, we need a guarantee that an install can never be
permanently locked out — e.g. an admin fat-fingers a `deny * manage` on
`everyone`. The backstop is deliberately **outside the grant system**:

- The **superuser *account type*** (`caller.type === 'superuser'`, the
  bootstrapped account and any account a superuser promotes) short-circuits
  resolution at step 1 and is **never** subject to grants, denies, roles, or the
  app gate's record rules. It is the break-glass.
- The **`admin` *role*** (§3.4) is ordinary data — a bundle of `manage` allows —
  and therefore **is** beatable by a deny, like any allow. Handing someone the
  `admin` role is not the same as making their account a superuser.

So the precedence ladder has exactly one rung above deny, and it's an
account-level property that can only be set by an existing superuser (or the
first-boot bootstrap), not something any grant can revoke. This mirrors how the
app gate's `none` already blocks regular users while the engine keeps a
superuser path open for recovery (`homestead admin reset-password`).

> **Decided (§11 #1a).** The superuser account type has **full access to
> everything** — no grant, deny, or app-gate `none` can block it. This is the
> single, deliberate exception to "deny always wins," and it guarantees a
> recovery path. The `admin` *role* is unaffected by this and stays beatable by
> a deny.

---

## 5. Engine changes

### 5.1 A stored, engine-managed `owner`

Introduce an engine-owned owner column on every record — **stamped by the
engine from `caller` at create time**, not by the app. This is the
authoritative version of today's advisory `created_by`.

- Column: `_owner TEXT` on each resource table (created in
  `engine/db.ts createResourceTable`, indexed like the parent FKs).
- Stamped in `crud.ts handleCreate` from `caller.id` (superusers may set it
  explicitly, e.g. creating on someone's behalf).
- `created_by` is kept for display/history and **backfilled into `_owner`** on
  migration (it already holds `users/{id}`; normalize to the id). Apps can stop
  hand-setting `created_by` once `_owner` exists, but it stays valid.

### 5.2 New module: `engine/permissions.ts`

Mirrors the existing `engine/access.ts` structure:

- A pure **`resolve(caller, verb, type, recordRow?)` → decision** function
  (the §4 algorithm), unit-testable in isolation — the analog of `decide()`.
- A **`PermissionStore`** that loads roles, groups, memberships, and grants
  from SQLite behind a short TTL cache (reuse the `AccessStore` 5s-TTL pattern;
  same cache-invalidation posture as app flags).
- A **`visibilityPredicate(caller, type)`** used by LIST (§4.1).

### 5.3 Wiring into the request pipeline

The pipeline order becomes: **auth → app-access gate → permission resolver →
route**. The app-access gate keeps its role as the fast, hard outer wall
(§9.1); the only change to it is broadening its audience to accept
group/role/tag allowlists.

- **Replace `checkUserScope`** with a general
  `checkRecordAccess(match, caller, verb)` in `crud.ts`, called from the same
  single site in `router.ts` (~L123). User-parent scoping becomes a *special
  case* of ownership, so existing behavior is subsumed, not removed.
- **CREATE:** check the caller's collection-level `write` for the type; stamp
  `_owner`.
- **GET / PATCH / PUT / DELETE / `:download`:** load the row's `_owner` (already
  fetched for the op), resolve, allow/deny. `:download` maps to `read` (it's
  currently unauthorized — this closes that gap).
- **LIST:** pass `visibilityPredicate(...)` into `store.listResources` as a new
  optional `visibility` argument that appends the WHERE clause.
- **`checkSuperuserWrite`** stays as a fast path (it's a strict subset:
  `superuser_write` ≡ "only the `admin` role may write"). We keep it to avoid
  churning the access-control resources' own protection.

### 5.4 Bootstrapping the access-control resources themselves

The resources that *store* permissions must not be gated *by* those same
permissions in a way that can brick an install:

- `role`, `group`, `group-membership`, and **collection-level** `access-grant`
  records are **`superuser_write`** (admin-managed) and readable by
  authenticated users (so the client can compute `can(...)`).
- **Record-level** `access-grant` records are special: a caller may create or
  revoke one **iff they have `manage` on the target record** (owner, or granted
  `manage`). This is the "share" action and is enforced in `permissions.ts`,
  not by the blanket `superuser_write` flag.
- The resolver **fails open to today's behavior** if the permission tables are
  empty/absent (fresh boot before migration), and enforcement is behind a
  single kill-switch env var (mirroring `E2E_DISABLE_APP_ACCESS`) so e2e and
  staged rollout can disable it.

---

## 6. Data model (new resources)

Modeled as ordinary aepbase resources so they inherit CRUD, schema-sync, and a
management UI for free. Declared in a new core module (e.g.
`packages/homestead-core/permissions/resources.ts`), aggregated by
`getAllResourceDefs()` like every other schema.

```ts
// role — data-driven, stored in the DB (decision §11 #3). superuser_write;
// readable by authenticated users. Grants use the same target shape as
// access-grant (typically scope 'all' | 'app' | 'collection').
{
  singular: 'role', plural: 'roles', superuser_write: true,
  fields: {
    name:        { type: 'string', required: true },
    description: { type: 'string' },
    grants:      { type: 'array', items: { type: 'object', properties: {
      target_scope:  { type: 'string', enum: ['all','app','collection'] },
      target_app:    { type: 'string' },   // when target_scope = 'app'
      resource_type: { type: 'string' },   // when target_scope = 'collection'
      filter:        { type: 'string' },   // §3.6, only with 'collection'
      capability:    { type: 'string', enum: ['read','write','manage'] },
    } } },
  },
}

// group — superuser_write; a named list of users
{ singular: 'group', plural: 'groups', superuser_write: true,
  fields: { name: { type: 'string', required: true }, description: { type: 'string' } } }

// group-membership — child of group; ties a user (and optional role) in
{ singular: 'group-membership', plural: 'group-memberships',
  parents: ['group'], superuser_write: true,
  fields: {
    user: { type: 'string', reference: { resource: 'user' }, required: true },
    role: { type: 'string', reference: { resource: 'role' } },   // optional
  } }

// access-grant — the ACL entry. Targets one of four scope levels (§3.3).
// Writes are gated by the engine (manage-on-target), NOT plain superuser_write.
{ singular: 'access-grant', plural: 'access-grants',
  fields: {
    subject_type:  { type: 'string', enum: ['user','group','role','everyone'], required: true },
    subject_id:    { type: 'string' },                    // omitted for 'everyone'
    target_scope:  { type: 'string', enum: ['all','app','collection','record'], required: true },
    target_app:    { type: 'string' },                    // app id, when target_scope = 'app'
    resource_type: { type: 'string' },                    // collection singular, when 'collection' | 'record'
    resource_id:   { type: 'string' },                    // record id, when 'record'
    filter:        { type: 'string' },                    // §3.6, only with target_scope = 'collection'
    capability:    { type: 'string', enum: ['read','write','manage'], required: true },
    effect:        { type: 'string', enum: ['allow','deny'] },   // default 'allow'; see §11 #1
  } }
```

Notes:

- These are **read-mostly** and small (household scale), so the TTL-cached
  `PermissionStore` reads them cheaply.
- `access-grant` is deliberately a flat central table (not an inline `acl`
  field on every record) so we can answer "everything shared with Bob" and
  "who can see gift-card #42" with one indexed query, and so we don't have to
  mutate every app's schema. The trade-off (one extra lookup per record op) is
  absorbed by the TTL cache and the LIST predicate.
- Referential cleanup uses the existing `onDelete` machinery: e.g. deleting a
  `group` `cascade`s its memberships; deleting a `user` should `set-null` /
  clean their grants. (Grants targeting a deleted **record** are harmless
  dangling rows; a periodic sweep or a resource-delete hook can prune them —
  called out as a v2 nicety.)
- A `filter` (§3.6) is **compiled and validated when the grant is written**
  (against the target collection's schema, via `compileFilter`), so a broken
  expression is rejected at grant-create time — never discovered at enforcement
  time. Because grants are read-mostly and cached, the compiled `(sql, params)`
  can be memoized in the `PermissionStore` per (grant, caller).

### 6.1 Introspection: "what can this person access?"

Filter-grants make the household's original ask — *show which resources someone
is allowed access to* — directly computable. For a target user, the resolver
gathers their principals' grants per collection and evaluates each grant's
predicate as an ordinary scoped LIST. Two natural surfaces:

- **Per person:** "everything Bob can read" = union of Bob's allow predicates
  (minus denies) run across the affected collections.
- **Per record:** "who can see gift-card #42" = the set of subjects whose grants
  (enumerated, filter, role, owner) resolve to `read` on that row.

Both are just the §4 resolver run in the other direction; no new storage. A thin
`:accessible` custom method (or an admin-only report page) can expose it.

---

## 7. Per-resource access model (opt-in strictness)

Not every collection wants record ACLs. Extend `ResourceDefinition`
(`resources/types.ts`) with an optional declaration:

```ts
access?: {
  model: 'household' | 'owner' | 'acl';   // default 'household'
  // 'household' — every `member`+ reads/writes (today's behavior). No owner privacy.
  // 'owner'     — private to `_owner`; visible to others only via an explicit grant.
  // 'acl'       — full §4 resolution: owner + roles + groups + grants.
}
```

- **`household`** is the default, so **every existing resource keeps working
  unchanged** and the migration is a no-op for them.
- **`owner`** suits personal data (e.g. a single person's private notes, HSA
  receipts) — the row is invisible to other members unless shared.
- **`acl`** is the full model for resources that need real sharing.

The schema translator emits this as an `x-homestead-access` marker on the wire
(same pattern as `x-aepbase-reference`), and `schema-sync` validates it at
boot. This keeps the authoring layer declarative — apps never write enforcement
code.

---

## 8. Migration & backward compatibility

The upgrade must be invisible to a running household.

1. **Seed built-in roles** (`admin`, `member`, `guest`) on first boot after
   upgrade (idempotent, like schema-sync).
2. **Assign roles from existing `type`:** every `regular` user → `member`;
   every `superuser` → `admin` (superuser override still applies regardless).
3. **Backfill `_owner`** from `created_by` where present (`users/{id}` → id).
   Rows with no `created_by` get a null owner (visible to all members under the
   default `household` model, so nothing disappears).
4. **All resources default to `access.model: 'household'`** ⇒ members continue
   to read/write everything. No collection becomes stricter until an app opts
   in or an admin adds a grant.
5. **Enforcement kill-switch** (env var) lets operators roll out in shadow mode
   and lets e2e run with the current model until specs are updated.

Net effect: on upgrade, `member`s see exactly what they saw before; admins keep
full control; nothing is hidden until someone deliberately tightens a resource.

---

## 9. Blocking an app, app visibility & account-tags

### 9.1 How to block an entire app

There are **two complementary controls**, and they answer different questions.
The division of labor: the **app gate** decides *visibility* (is the app on, and
for which broad audience) as a fast, hard outer wall; the **resolver** decides
*capability* (read vs. write vs. manage) and expresses *subtractions* (block one
person from an otherwise-open app).

**The app gate (visibility, allowlist).** The existing `AccessCheck` runs first
and short-circuits, so nothing downstream can re-open an app it closes. Setting
the app's `enabled` visibility:

| Goal | Setting | Needs `deny`? |
|---|---|---|
| Off for everyone (even admins) | `none` | no |
| Admins only | `superusers` | no |
| Only a specific set of people | group / role / tag audience (below) | no |
| Open to the household | `all` (default) | no |
| Everyone **except** specific people | app-scope `deny` grant, or a narrower role | **yes** (or role modeling) |

**Extending the gate's audience to groups & roles.** Today the gate's only
person-differentiating audience is `tagged` (a free-form account tag). We extend
`AppVisibility` so the audience can be a **group** or **role**, not just a tag —
the gate's `decide()` already intersects the caller's principals against an
allowed set, so this is a natural generalization:

```
enabled: none | all | superusers | audience
audience := { groups?: [<id>...], roles?: [<id>...], tags?: [<name>...] }
```

This makes "only these people can see this app" a first-class allowlist without
touching the resolver. `tagged` becomes the special case `audience.tags`.

**The one case the gate can't express: "everyone except Bob."** An allowlist
can't subtract. Because `member` carries a blanket `*` allow (backward compat),
blocking one person from one otherwise-open app requires either:

- an **`app`-scope `deny` grant** for that user (deny wins in resolution, §4) — the
  clean, targeted option **if we adopt deny semantics**; or
- **not giving that person `member`** — model them with a narrower role (e.g.
  `guest`) whose `app`-scope allow grants simply omit the blocked app.

This is exactly why the "everyone-except" case is the deciding factor for open
decision #1 (§11) — allow-only cannot subtract from a blanket grant.

### 9.2 Account-tags convergence

`account-tag` (superuser-write child of `user`) currently exists **only** to feed
`enabled='tagged'`. Once the gate accepts groups (§9.1), tags and groups are the
same idea ("a named set of users"), so:

- Short term: keep tags working; `audience.tags` is a supported audience.
- Medium term: **groups become the primary grouping primitive**; a tag is just a
  single-purpose group. New setups use groups; existing tag-based gates keep
  running untouched.
- We avoid painting into a corner by having the gate speak the same
  group/role/tag vocabulary as the resolver from day one.

---

## 10. Client (SPA) mirror

The server is authoritative; the client mirrors for UX (same discipline as
`decide()` ↔ `resolveVisibility()` today).

- **Hydrate on login.** Alongside the existing tag/preferences hydration in
  `AuthContext`, fetch the caller's roles, group memberships, and the grants
  addressed to their principals. (Record-level grant *ids* can be lazy-loaded
  per collection to keep the login payload small.)
- **`can(verb, resourceType, recordId?)` helper** in the auth layer — the first
  centralized capability check (there is none today; checks are ad-hoc
  `user.type === 'superuser'`). Backed by a TS port of the §4 resolver.
- **New route gate `permission`.** Add to the `GateName` union and
  `gateComponents` map (`apps/router/gates.tsx`) so an `AppRoute` can declare
  `gates: ['permission:...']`. Extends, doesn't replace, `enabled`/`superuser`.
- **Nav & list filtering.** The sidebar predicate
  (`useAppEnabledPredicate`) extends to also hide apps the caller can't use;
  list hooks call `can('read', …)` so the UI shows only permitted rows (the
  server already enforces it, this just avoids empty-state flashes).
- **Sharing UI.** A "Share" affordance on records whose resource is `owner`/`acl`
  and where `can('manage', …)` — creates/revokes record-level `access-grant`s.
- **Admin UI.** Extend the existing superuser Users area with Roles and Groups
  management (both are just CRUD over the new resources).

---

## 11. Open decisions (need your call)

1. **Deny semantics. — DECIDED.** Deny ships in v1, at **all four scopes**
   (`all`/`app`/`collection`/`record`), and **always wins**: a deny that targets
   the caller at the required capability blocks the request, over any allow,
   owner grant, role, or more-specific grant. Precedence and the SQL treatment
   are in §4 / §4.1. This is what makes the "everyone-except" case (§9.1)
   expressible under a blanket `member` role.
   - **1a. Break-glass exception (§4.2) — DECIDED.** The superuser *account
     type* has full access to everything: no grant, deny, or app-gate `none`
     blocks it, so a misconfigured `deny * manage everyone` can't permanently
     brick the install. This is the single, deliberate exception to "deny always
     wins." The `admin` *role* is ordinary data and remains beatable by a deny.
2. **Delete capability — DECIDED: folded into `write`.** One mutate capability
   (create/update/delete); the ladder is `none < read < write < manage`. See
   §3.2.
3. **Roles as data — DECIDED: stored in the DB.** `role` is a data-driven,
   superuser-managed resource (§6), not `homestead.config.ts` config. The three
   built-ins (`admin`/`member`/`guest`) are seeded rows, editable in the admin
   UI, and the household can add its own.
4. **Default `guest` scope.** Nothing until granted (safe) vs. read-only on a
   curated set of apps? *Recommendation: nothing until granted.*
5. **Group nesting.** Flat groups v1 (proposed) — confirm we don't need nested
   groups soon.
6. **`owner` reassignment / co-owners.** Single `_owner` v1; multiple owners
   expressed as `manage` grants. Confirm that's sufficient.
7. **Filter grammar scope (§3.6).** **Decided:** extend the existing minimal
   subset in place — no separate CEL library. Every grammar addition lands in
   the one shared `compileFilter`, so List and permissions grow together and can
   never diverge (§3.6.1). v1 ships with just the `subject.*` binding; further
   operators are added only when a real rule needs them. Likely order when they
   come: (a) **`in` / list membership** — for group/role tests like
   `team in subject.groups` and `status in ['a','b']`; (b) **standard-field
   comparisons** (`create_time`, `id`) — for rules like "records created after
   X"; (c) **`contains` / string ops** for array and substring fields. Each is a
   drop-in to the shared compiler that also improves List for everyone.

---

## 12. Suggested build order (once the design is approved)

Each step is independently shippable behind the kill-switch.

1. **Engine `_owner` column** + stamp on create + backfill migration. No
   behavior change (nothing reads it yet).
2. **`engine/permissions.ts`** resolver + `PermissionStore` + unit tests
   against the §4 truth table. Not yet wired.
3. **New resources** (`role`, `group`, `group-membership`, `access-grant`) +
   schema-sync + seed built-in roles + role assignment migration.
4. **Wire enforcement**: `checkRecordAccess` replaces `checkUserScope`; CREATE
   stamps owner; LIST visibility predicate. Behind the kill-switch, default
   `household` everywhere ⇒ green e2e.
5. **Filter-scoped grants (§3.6)**: give `compileFilter` its optional
   `subject` context (§3.6.1) — a backward-compatible signature change with List
   untouched — compile+validate a grant's `filter` at write time, and feed its
   predicate into the §4.1 visibility clauses and single-record guards. Unlocks
   "records you own / created / are assigned" without enumerating ids. Any later
   grammar operator (§11 #7) is a change to this one shared compiler.
6. **`access.model` authoring field** + translator marker; opt one real
   resource (e.g. a private notes/HSA case) into `owner` as the first proof.
7. **Client**: `can()` helper, hydration, `permission` gate, nav/list filter.
8. **Admin + sharing UI**: Roles/Groups management, per-record Share, and an
   "accessible resources" report (§6.1).

---

## 13. Summary

The design layers three requested mechanisms on the engine's existing seams:

- **Roles** replace the binary `superuser`/`regular` with data-driven,
  assignable capability bundles (`admin`/`member`/`guest` seeded).
- **Groups** are lists of users, memberships optionally carrying a role.
- **Per-resource ACLs** (`access-grant`) grant a capability to a user, group,
  role, or everyone — at `all`, `app`, `collection`, or `record` scope.
- **Filter-scoped grants** express the allowed set as a **filter** in the same
  subset List already accepts (plus a `subject.*` binding for caller
  attributes), compiled to SQL — so "which resources someone can access" is
  computed dynamically, not enumerated.

Enforcement is authoritative in the engine via a new `permissions.ts` resolver
wired at the existing `crud.ts`/`router.ts` chokepoint, backed by a stored
`_owner` column and a SQL visibility predicate for LIST that reuses the engine's
`compileFilter`. A default install behaves exactly as it does today; strictness
is opt-in per resource, and the whole system sits behind a kill-switch for safe
rollout.

---

## 14. Interface reference (consolidated)

The authoritative type shapes, gathered in one place. These are the **logical**
TypeScript interfaces (the mental model + what the client/engine pass around);
the stored resources flatten them to snake_case wire fields per §6.

```ts
// ────────────────────────── Primitives ──────────────────────────

/** write covers create/update/delete; manage adds granting others' access. */
type Capability = 'read' | 'write' | 'manage';        // ordered: read < write < manage
type Effect     = 'allow' | 'deny';                   // default 'allow'; deny always wins (§4)
type Scope      = 'all' | 'app' | 'collection' | 'record';

// ────────────────────────── Principals ──────────────────────────

type SubjectType = 'user' | 'group' | 'role' | 'everyone';

/** The principal a grant is addressed to. */
interface Subject {
  type: SubjectType;
  id?: string;              // required except when type === 'everyone'
}

// ─────────────────────── Grant target & grant ───────────────────────

/** Where a grant applies. Narrowest set field wins the shape. */
interface GrantTarget {
  scope: Scope;
  app?: string;             // app id            — when scope === 'app'
  resource_type?: string;   // collection singular — when scope === 'collection' | 'record'
  resource_id?: string;     // record id         — when scope === 'record'
  filter?: string;          // §3.6 attribute expr — only when scope === 'collection'
}

/** The ACL entry. Stored as the `access-grant` resource. */
interface AccessGrant {
  id: string;
  subject: Subject;
  capability: Capability;
  effect: Effect;           // default 'allow'
  target: GrantTarget;
}

// ────────────────────────── Roles & groups ──────────────────────────

/** A role confers a bundle of allow-grants. Stored as the `role` resource (in DB, §11 #3). */
interface Role {
  id: string;
  name: string;
  description?: string;
  grants: RoleGrant[];      // allow-only; typically scope 'all' | 'app' | 'collection'
}
interface RoleGrant {
  target: GrantTarget;      // record scope unusual but permitted
  capability: Capability;
}

/** Stored as the `group` resource. */
interface Group { id: string; name: string; description?: string; }

/** Stored as the `group-membership` resource (child of group; group_id in URL path). */
interface GroupMembership {
  id: string;
  user: string;             // reference → user
  role?: string;            // reference → role (optional; "this member acts as <role> in this group")
}

// ─────────────────── Filter subject binding (§3.6.1) ───────────────────

/** Caller attributes exposed to a grant filter as `subject.*` operands. */
interface SubjectBindings {
  id: string;
  email: string;
  display_name?: string;
}

// ─────────────── Per-resource opt-in model (authoring, §7) ───────────────

/** Added to ResourceDefinition (resources/types.ts). */
interface ResourceAccess {
  model: 'household' | 'owner' | 'acl';   // default 'household'
}
// ResourceDefinition gains:  access?: ResourceAccess

// ─────────────── App gate audience (extended, §9.1) ───────────────

type AppVisibility = 'none' | 'all' | 'superusers' | AppAudience;
interface AppAudience {          // allowlist — any match grants app visibility
  groups?: string[];
  roles?: string[];
  tags?: string[];               // 'tagged' today becomes AppAudience.tags
}

// ────────────────────── Engine resolver (server) ──────────────────────

type Verb = 'read' | 'write' | 'manage';
interface Decision { allow: boolean; reason?: string; }

/** Superuser account short-circuits to allow (break-glass, §4.2). */
function resolve(
  caller: User, verb: Verb, resourceType: string, record?: StoredRow,
): Decision;

/** LIST: null ⇒ no restriction (broad-read fast path); else a WHERE fragment. */
function visibilityPredicate(
  caller: User, resourceType: string,
): CompiledFilter | null;         // { sql, params } — folded into store.listResources

/** The ONE shared filter compiler, extended with an optional subject context (§3.6.1). */
function compileFilter(
  filter: string, schema: Schema, opts?: { subject?: SubjectBindings },
): CompiledFilter;                // List calls it with no opts, unchanged

// ────────────────────────── Client mirror (§10) ──────────────────────────

/** Centralized capability check; TS port of resolve(). */
function can(verb: Verb, resourceType: string, recordId?: string): boolean;
```

Notes:
- **Wire vs. logical.** aepbase stores flat snake_case fields, so `Subject`
  becomes `subject_type`/`subject_id` and `GrantTarget` becomes
  `target_scope`/`target_app`/`resource_type`/`resource_id`/`filter` on the
  `access-grant` resource (§6). The nested interfaces above are how code models
  them; a thin (de)serializer bridges the two.
- **`User` and `StoredRow`** are existing engine types (`engine/types.ts`); the
  resolver reads `caller.id`/`caller.type`/`caller.email` and the row's `_owner`.
- **`CompiledFilter`** (`{ sql: string; params: (string|number)[] }`) is the
  existing `engine/filter.ts` type — reused verbatim.

---

## 15. Grants as a first-class AEP resource

`role`, `group`, `group-membership`, and `access-grant` are ordinary resource
definitions (§6), so they ride the **entire AEP resource machinery** with no
bespoke API, client, or CLI. This is the main reason to model them as resources
rather than a side table.

### 15.1 What comes for free

Declaring the `access-grant` definition and letting the boot-time schema sync
apply it yields, with zero extra code:

- **Standard AEP REST**, same as every other collection, under the `/api/aep`
  prefix:

  | Method | Verb | Notes |
  |---|---|---|
  | `GET /api/aep/access-grants` | List | supports `?filter=…`, `?order_by=…`, pagination |
  | `GET /api/aep/access-grants/{id}` | Get | |
  | `POST /api/aep/access-grants` | Create | |
  | `PATCH /api/aep/access-grants/{id}` | Update | |
  | `DELETE /api/aep/access-grants/{id}` | Delete | |

- **List filtering via the same `compileFilter`** (§3.6.1) — so querying the ACL
  is itself expressible: `filter=subject_id == 'users/alice' && capability == 'manage'`.
  The introspection in §6.1 is largely just List with a filter.
- **OpenAPI**: the generator (`engine/openapi.ts`) emits paths + schemas for
  `access-grants` automatically; it also lands in the frozen wire-contract test.
- **CLI** (`homestead resources`) — a fully dynamic client that reads the
  server's live definitions and synthesizes verbs. Nothing to add:

  ```bash
  homestead resources                              # index — lists access-grant among resources
  homestead resources access-grant                 # help: fields + supported verbs
  homestead resources access-grant list --filter "resource_type == 'recipe'"
  homestead resources access-grant create \
      --subject_type user --subject_id users/alice \
      --target_scope collection --resource_type recipe --capability read
  homestead resources access-grant get <id>
  homestead resources access-grant delete <id>
  ```

  The CLI authenticates as the **logged-in profile** and sends that bearer token
  (`homestead login`), so every call is subject to the same engine enforcement
  as the SPA — a regular user can only create grants they're actually allowed to
  (§15.3). No admin backdoor.
- **Chat tools**: the tool builder generates `read_*` / `create_*` tools from the
  definition, and `reference` annotations tell the model that `subject_id` points
  at a `user` and `resource_id` at the target resource.
- **`onDelete` cleanup, e2e seed helpers, resource-reference validation** — all
  the usual resource benefits, unchanged.

### 15.2 Custom methods for the meta-operations

Two operations don't fit plain CRUD; both are declared as AEP-136
`customMethods` on the `access-grant` resource, which makes them **first-class
CLI verbs and gateway routes for free** (`POST /api/aep/access-grants:<verb>`):

```ts
customMethods: {
  // "Can subject X do Y on Z?" → returns a Decision. Read-only, sync.
  check: { target: 'collection', load: () => import('./methods/check') },
  // §6.1 introspection: "what can user X access?" → per-collection allowed sets.
  accessible: { target: 'collection', load: () => import('./methods/accessible') },
}
```

```bash
homestead resources access-grant check --@data ./q.json
# q.json: { "subject": {"type":"user","id":"users/alice"}, "verb":"write", "resource_type":"recipe", "resource_id":"..." }
```

Each handler receives the authenticated caller (`ctx.auth.user`) and calls the
same `resolve()` the engine uses, so the answer can never drift from
enforcement. `accessible` is admin/self-only (a caller can always ask about
themselves; asking about *another* user requires `manage`).

### 15.3 The self-referential wrinkle (and how it's contained)

`access-grant` is the one resource whose *own* access can't use a stock model:

- **Not `household`** — that would let anyone rewrite anyone's access
  (privilege escalation).
- **Not plain `superuser_write`** — that would stop a normal member from sharing
  a record they own.

So `access-grant` (and `role`/`group`/`group-membership`) use a **built-in,
non-configurable access model** enforced directly in `permissions.ts`, not the
generic flags:

- **Read a grant:** superuser · the grant's **subject** (you may see grants about
  you) · anyone with **`manage` on the grant's target**.
- **Write a grant (create/update/delete):** superuser · anyone with **`manage`
  on the grant's target** — bounded by two anti-escalation rules:
  1. **You cannot grant a capability higher than you hold** on that target
     (can't hand out `manage` unless you have `manage`).
  2. **No grants-on-grants:** a grant whose `target` is the `access-grant`,
     `role`, `group`, or `group-membership` collection is rejected. This closes
     the meta-loop — access to the ACL machinery itself is governed only by the
     built-in rule above and the superuser break-glass (§4.2), never by
     user-authored grants, so there's no infinite regress and no way to grant
     yourself grant-editing power.
- **`role` / `group` / `group-membership` writes** stay **`superuser_write`**
  (household-structure changes are an admin act); their reads are open to
  authenticated users so the client can compute `can()`.

Net: grants get the full AEP surface (REST, CLI, OpenAPI, chat, custom methods)
for free, while the single sensitive part — who may edit the ACL — is a small,
fixed rule in the resolver rather than anything a user can reconfigure.
