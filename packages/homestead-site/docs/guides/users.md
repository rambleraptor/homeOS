# Creating Users

Homestead is multi-user: each member of your household gets their own
account. This page covers claiming a fresh instance and adding everyone
else.

## Table of Contents

- [Claiming a New Instance](#claiming-a-new-instance)
- [Adding Users](#adding-users)
- [Editing and Removing Users](#editing-and-removing-users)
- [Recovering a Lost Password](#recovering-a-lost-password)

---

## Claiming a New Instance

A brand-new instance starts **unclaimed** — there are no accounts yet. The
first time you open it, the login screen asks you to create the admin
account instead of signing in:

1. Open the app in your browser.
2. Enter an email and a password (at least 8 characters) for the admin
   (superuser) account.
3. Submit. You're now signed in as the superuser.

This is a one-time step. Once claimed, the instance shows the normal login
screen, and only a superuser can create more accounts.

---

## Adding Users

User management lives in the **Users** app, visible to superusers under
**Settings → Users**.

1. Go to **Settings → Users**.
2. Click **Add User**.
3. Fill in the form:

   | Field            | Notes                                                       |
   | ---------------- | ----------------------------------------------------------- |
   | **Email**        | Required. Used to sign in.                                   |
   | **Display Name** | Optional. Shown around the app.                             |
   | **Type**         | **Regular** or **Superuser**. Superusers manage users, settings, and access. |
   | **Tags**         | Optional labels for grouping users — see [Access & Tags](./access). |
   | **Password**     | Required. Must be at least 8 characters.                    |

4. Save. The account is ready to use immediately.

There's no email invite flow — you set each user's password when you create
the account and share it with them. They can use it to sign in right away.

> **Superuser vs. regular.** Superusers can manage accounts, edit
> household settings, and control which apps each person can reach. Regular
> users just use the apps they have access to. Keep the superuser role to
> the people who actually administer the household.

---

## Editing and Removing Users

From the same **Users** screen:

- **Edit** a user to change their email, display name, type, or tags. Leave
  the password field blank to keep the existing password; type a new one to
  reset it.
- **Delete** a user to remove the account. You can't delete your own
  account.

---

## Recovering a Lost Password

If a superuser is locked out, reset the password from the command line on
the server:

```bash
homestead admin reset-password
```

This sets a new superuser password without needing access to the UI.
