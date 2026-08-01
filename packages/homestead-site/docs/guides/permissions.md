# Permissions

[Access & Tags](./access) decides which **apps** a person can open. Permissions
go a level deeper: they decide who can see and change individual **records** —
so you can share one recipe with a housemate, keep a person's medical notes to
themselves, or let only the adults edit the finances.

Permissions are **off by default**. A fresh household works exactly as before:
everyone signed in shares all the data inside every app they can open. You turn
permissions on when you actually want to limit something — and even then,
nothing changes until you write your first rule.

## This page covers

- [The three building blocks](#the-three-building-blocks)
- [Turn permissions on](#turn-permissions-on)
- [Share one record with one person](#share-one-record-with-one-person)
- [Give a group access](#give-a-group-access)
- [Block someone](#block-someone)
- [What to expect](#what-to-expect)
- [Reference notes](#reference-notes)

---

## The three building blocks

- **Grant** — one rule: *who* can do *what* to *which* data. "Bob can read
  gift-card #42." Everything below is built from grants.
- **Group** — a named set of people, like `Parents` or `Guests`. Grant access
  to a group and it applies to everyone in it.
- **Role** — a named bundle of abilities you hand to a group, like `member`
  (read and write everything) or `guest` (nothing until you share it). Three
  roles come built in: `admin`, `member`, and `guest`.

A rule grants one of three abilities, each including the ones before it:

| Ability    | Lets you…                                    |
| ---------- | -------------------------------------------- |
| **read**   | view a record                                |
| **write**  | create, edit, and delete                     |
| **manage** | everything, **plus** share it with others    |

---

## How permissions apply

Permissions are **always on** — there is no switch to turn them off. Despite
that, a brand-new household behaves exactly as if there were no permissions at
all: every instance is seeded with a built-in **"everyone can read and write
everything"** rule (the *open-household* grant).

So out of the box, **nothing appears restricted**. You make things private by
narrowing or removing that open rule, one step at a time — blocked reads then
return nothing, and blocked writes are refused. Superuser accounts always
bypass every rule (break-glass), so you can never lock yourself out.

> Until the baseline is seeded (the first moments of a fresh instance, or a
> fully-wiped database) the engine deliberately **fails open** rather than
> locking everyone out.

---

## Share one record with one person

Rules live in the `access-grant` collection. You manage them from the command
line with `homestead resources` (a management UI is on the way).

To let Bob read gift-card `gc_42`:

```bash
homestead resources access-grant create \
    --subject_type user --subject_id bob \
    --target_scope record --resource_type gift-card --resource_id gc_42 \
    --capability read
```

Bob can now open that one gift card — and only that one. To stop sharing,
delete the rule:

```bash
homestead resources access-grant list          # find the rule's id
homestead resources access-grant delete <id>
```

You can share a record you **own** or **manage** even without being an admin —
that's how sharing your own things works.

---

## Give a group access

Groups save you from repeating yourself. Make a group, add people, then grant
the group access once.

```bash
# 1. Make the group
homestead resources group create --name Parents --id parents

# 2. Add people (optionally handing them a role while they're in it)
homestead resources group-membership create --group parents \
    --user alice --role member
homestead resources group-membership create --group parents --user bob

# 3. Grant the group access — here, read + write to all recipes
homestead resources access-grant create \
    --subject_type group --subject_id parents \
    --target_scope collection --resource_type recipe \
    --capability write
```

Use `--target_scope app` with `--target_app <app>` to cover a whole app at
once, or `--target_scope all` for everything.

---

## Block someone

A **deny** rule removes access, and **a deny always wins** — it beats every
grant, including someone's ownership of their own record. This is how you carve
one exception out of an otherwise-open household.

To keep a teen out of the finances app while everyone else keeps it:

```bash
homestead resources access-grant create \
    --subject_type user --subject_id teen \
    --target_scope app --target_app credit-cards \
    --capability read --effect deny
```

---

## What to expect

A few rules of thumb make the whole system predictable:

- **Owners keep their own.** Whoever creates a record can always read, edit, and
  share it — unless a deny rule names them.
- **Superusers see everything.** The main account is never locked out, so you
  always have a way back in. (Regular admins — people with the `admin` *role* —
  can be blocked by a deny.)
- **A deny always wins.** If any rule denies access, access is denied, no matter
  how many grants say otherwise.
- **Everything is shared until you say otherwise.** The starting rule opens the
  whole household; you tighten from there.
- **Rules apply everywhere.** Enforcement is on the server, so it covers the
  API, the AI assistant, and the CLI — not only the web UI.

---

## Reference notes

- **Roles ride on groups.** In this version you give someone a role by adding
  them to a group with that role, not by assigning it to them directly.
- **The rules themselves are visible to the household.** Anyone signed in can
  read the grants, groups, and roles (only superusers and a record's owner can
  *change* them). This is intentional — it keeps the household transparent about
  who can do what, and the apps need it to show you the right screens. One
  consequence: a deny rule is discoverable, so "who is blocked from the finances
  app" isn't a secret. Permissions control *access to your data*, not *knowledge
  of the rules* — if you need someone's very existence in a rule kept private,
  this isn't the tool for that.
- **Changes are near-instant.** New rules take effect within a few seconds
  (there's a short cache), no restart needed.
- **Owner-only apps.** A developer can mark a whole resource *owner-private* in
  its definition (`access: { model: 'owner' }`), so its records default to the
  creator only even under the open household rule — good for personal notes or
  one person's receipts. See [Defining Resources](./resources).
- **Filters.** A rule can target records by a condition instead of a fixed id —
  for example "recipes you created" (`created_by == subject.id`). Same
  expression language as list filters.
- **Permissions vs. tags.** [Tags](./access) decide which apps a person can
  open; permissions decide who can see and change the records inside them. Use
  tags for whole apps, permissions for specific data.
```
