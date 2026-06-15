# Access & Tags

By default every signed-in user can reach every app. When you want some
apps limited to certain people — kids' chores hidden from guests, finances
visible only to the adults — you group users with **tags** and grant
access by tag. A tag is effectively a user list: label the people who
belong, then point an app at that label.

Access is enforced on the server, not just hidden in the UI, so tagging is
a real authorization boundary — not a cosmetic one.

## Table of Contents

- [The Idea](#the-idea)
- [Step 1: Tag Your Users](#step-1-tag-your-users)
- [Step 2: Restrict an App by Tag](#step-2-restrict-an-app-by-tag)
- [Visibility Modes](#visibility-modes)
- [Notes](#notes)

---

## The Idea

Two pieces work together:

- **Tags** are labels you put on user accounts — `adults`, `kids`,
  `guests`, whatever fits your household. A user can have several.
- **App access** decides who can reach each app. Set an app to the
  **tagged** mode and list which tags are allowed. A user gets in if they
  have **any** of those tags.

So a tag is your reusable "user list," and each app picks which lists it
trusts.

---

## Step 1: Tag Your Users

Tags are assigned per user in the **Users** app (**Settings → Users**, see
[Creating Users](./users)):

1. Edit a user.
2. In the **Tags** field, type a tag name and press Enter. Add as many as
   you like.
3. Save.

Use consistent names — `adults` on every adult's account, `kids` on every
child's. Those names are what you'll reference when restricting apps.

---

## Step 2: Restrict an App by Tag

App access is controlled in **Flag Management**, a superuser screen at
**Settings → Flag Management**.

1. Go to **Settings → Flag Management**.
2. Find the app you want to limit.
3. Set its **enabled** option to **tagged**.
4. In the **enabled tags** field that appears, list the tags allowed to use
   it (e.g. `adults`).
5. The change applies immediately.

Now only users carrying one of those tags can open the app — or reach its
data through the API. Everyone else won't see it in their navigation, and
the server will refuse their requests.

---

## Visibility Modes

The **enabled** setting on each app supports four modes:

| Mode           | Who can access the app                                              |
| -------------- | ------------------------------------------------------------------ |
| **all**        | Every signed-in user (the default).                                |
| **superusers** | Superusers only — handy for hiding work in progress.               |
| **none**       | Nobody, including superusers.                                      |
| **tagged**     | Only users whose tags match the app's **enabled tags** list.       |

---

## Notes

- **Any-of matching.** In **tagged** mode a user needs just one matching
  tag, not all of them.
- **Superusers don't bypass tagged mode.** If an app is restricted to
  `adults` and a superuser should reach it, give that superuser the
  `adults` tag too.
- **Enforced on the server.** Tag checks run on every request, so access
  control holds even for the API and AI tools — not only the web UI.
- **Tagging is for grouping, not secrets.** Tags decide which apps a person
  can open; they aren't per-record permissions. Within an app a user reaches
  has access to, they see that app's shared household data.
