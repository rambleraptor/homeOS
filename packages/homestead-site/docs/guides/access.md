# Access & Tags

By default every signed-in user can reach every app. To limit an app to
certain people — kids' chores hidden from guests, finances for adults only —
group users with **tags**, then grant the app access by tag.

A **tag** is a label on a user account, like `adults`, `kids`, or `guests`.
A user can have several. To restrict an app, set it to **tagged** mode and
list the allowed tags. A user gets in if they have **any** of those tags.

Tag checks run on the server for every request, so they apply to the API
and AI tools too — not only the web UI.

## This page covers

- [Tag your users](#tag-your-users)
- [Restrict an app by tag](#restrict-an-app-by-tag)
- [Access modes](#access-modes)
- [Reference notes](#reference-notes)

---

## Tag your users

Tags are assigned per user in the **Users** app (**Settings → Users**, see
[Creating Users](./users)):

1. Edit a user.
2. In the **Tags** field, type a tag name and press Enter. Add as many as
   you like.
3. Save.

Use consistent names — `adults` on every adult's account, `kids` on every
child's. Those names are what you'll reference when restricting apps.

---

## Restrict an app by tag

Set app access in **Flag Management**, a superuser screen at **Settings →
Flag Management**.

1. Go to **Settings → Flag Management**.
2. Find the app you want to limit.
3. Set its **Enabled** option to **tagged**.
4. In the **Allowed tags** field that appears, list the tags allowed to use
   it (for example, `adults`).

The change applies immediately. Only users with one of those tags can open
the app or reach its data through the API. Everyone else won't see it in
their navigation, and the server returns a 403 for their requests.

---

## Access modes

The **Enabled** setting on each app has four modes:

| Mode           | Who can access the app                                       |
| -------------- | ------------------------------------------------------------ |
| **all**        | Every signed-in user (the default).                          |
| **superusers** | Superusers only.                                             |
| **none**       | Nobody, including superusers.                                |
| **tagged**     | Only users whose tags match the app's **Allowed tags** list. |

---

## Reference notes

- **Any-of matching.** In **tagged** mode a user needs one matching tag, not
  all of them.
- **Superusers don't bypass tagged mode.** To let a superuser reach an app
  restricted to `adults`, give that superuser the `adults` tag too.
- **Tags group apps, not records.** Tags decide which apps a person can open.
  They aren't per-record permissions: inside an app a user can reach, they
  see that app's shared household data.
