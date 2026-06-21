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

A brand-new instance has no accounts yet. The first time you open it, the
login screen asks you to create the admin (superuser) account instead of
signing in.

1. Open the app in your browser.
2. Enter an email.
3. Enter a password (at least 8 characters) and confirm it.
4. Click **Create Admin Account**. You're now signed in as the superuser.

This is a one-time step. After that, the instance shows the normal login
screen, and only a superuser can create more accounts.

---

## Adding Users

Only superusers can add users.

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

4. Click **Create User**. The account works immediately.

There's no email invite flow — you set each user's password when you create
the account and share it with them. They can use it to sign in right away.

Give the **Superuser** type only to people who administer the household.
Regular users can only open the apps they have access to.

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
the server. Run this in the project directory:

```bash
homestead admin reset-password
```

This generates a new password and prints it, along with the account email:

```
superuser password reset:
  Email:    admin@example.com
  Password: a1b2c3d4e5f6g7h8
```

Sign in with that email and password. To target a specific superuser when
there's more than one, pass its email:

```bash
homestead admin reset-password --email someone@example.com
```
