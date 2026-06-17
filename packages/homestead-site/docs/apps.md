---
title: Built-in apps
description: The apps Homestead ships with — todos, groceries, recipes, gift cards, and more.
---

# Built-in apps

Every feature in Homestead is a self-contained app, and every app is opt-in.
`homestead init` starts you with a sensible set; the full list lives in your
`homestead.config.ts`, and adding or removing an app is a one-line change.

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

A few core apps — **Settings**, **Users**, and the **Superuser** console — are
always installed; they're part of the platform rather than the catalog.

## Agents get all of it, too

Every app above publishes its schema and operations through Homestead's
AEP-compliant API, so anything you can do, an agent can do on your behalf —
add a grocery item, log a recipe, redeem a perk.

## Want your own app?

The built-ins are just apps sitting next to yours. Drop a folder with an
`app.homestead.ts` under `apps/` (or run `homestead init-app <name>`) and it's
picked up automatically — see the [Quick Start](./guides/quick-start).
