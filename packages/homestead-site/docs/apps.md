---
title: Example apps
description: A showcase of apps built on Homestead — todos, groceries, recipes, gift cards, and more — to use as-is or for inspiration.
---

# Example apps

Every feature in Homestead is a self-contained app. The apps below ship in the
repo — install the ones you want, edit them to fit your household, or use them
as a starting point for your own.

`homestead init` gives you a default set. Your installed apps are listed in
`homestead.config.ts`; add or remove an app by editing that array.

## Tasks

- **Todos** — daily todo list with progress tracking.

## Food

- **Groceries** — manage your grocery list with smart categorization.
- **Recipes** — manage household recipes with structured ingredients, and log
  what you cooked.

## Money

- **Gift Cards** — manage household gift cards and track their balances.
- **Credit Cards** — track credit card perks and maximize rewards.
- **HSA Receipts** — track unreimbursed medical expenses for tax-free HSA
  withdrawals.

## Relationships

- **People** — contact information and important dates for the people you know.
- **Events** — track yearly-recurring household events.
- **Games** — scorekeeping for games you play with the people in your life,
  including mini golf, Pictionary, and bridge.

## System

- **Dashboard** — an overview of your Homestead system, built from widgets the
  other apps contribute.
- **Notifications** — view and manage your notifications, including web push.

The **Settings**, **Users**, and **Superuser** apps are always installed. You
can't remove them.

## Let agents use your apps

Every app publishes its schema and operations through Homestead's
AEP-compliant API. Anything you can do in an app, an agent can do too — add a
grocery item, log a recipe, redeem a perk.

## Build your own app

Run `homestead init-app <name>` to scaffold a new app under `apps/`:

```bash
homestead init-app chores
```

Homestead discovers any folder with an `app.homestead.ts` under `apps/`
automatically. Restart `homestead start` to load the new app. See the
[Quick Start](./guides/quick-start) for a full walkthrough.
