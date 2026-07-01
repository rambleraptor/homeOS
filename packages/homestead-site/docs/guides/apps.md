# Example Apps

Everything here already ships in the repo — real apps built to run a
household, not demos of a framework. Install the ones you want as-is, change
whatever doesn't fit, or copy one as the starting point for an app of your own.
`homestead init` sets you up with a default set; the `apps` array in
`homestead.config.ts` decides what's installed.

## Tasks

- [**Todos**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/todos) — a shared daily todo list that tracks how much you got through.

## Food

- [**Groceries**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/groceries) — a grocery list that sorts itself into categories as you add items.
- [**Recipes**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/recipes) — household recipes with proper ingredient lists, plus a log of what you cooked.

## Money

- [**Gift Cards**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/gift-cards) — every gift card the household owns, with its current balance.
- [**Credit Cards**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/credit-cards) — each card's perks in one place, so the rewards don't go to waste.
- [**HSA Receipts**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/hsa) — unreimbursed medical receipts, kept ready for a tax-free HSA withdrawal.

## Relationships

- [**People**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/people) — contact details and the dates worth remembering for people in your life.
- [**Events**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/events) — the recurring dates — birthdays, anniversaries — that come around each year.
- [**Games**](https://github.com/rambleraptor/homestead/tree/main/packages/homestead-apps/games) — score-keeping for the games you play, from mini golf to Pictionary to bridge.

---

Because every app exposes its data through Homestead's API, your agents can use
them too: adding a grocery item or logging a recipe the same way you would.
