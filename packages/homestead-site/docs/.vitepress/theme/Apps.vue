<script setup lang="ts">
const repo = 'https://github.com/rambleraptor/homestead/tree/main/packages';

type App = {
  name: string;
  blurb: string;
  source: string;
};

type Group = {
  label: string;
  apps: App[];
};

const groups: Group[] = [
  {
    label: 'Tasks',
    apps: [
      {
        name: 'Todos',
        blurb: 'A shared daily todo list that tracks how much you got through.',
        source: `${repo}/homestead-apps/todos`,
      },
    ],
  },
  {
    label: 'Food',
    apps: [
      {
        name: 'Groceries',
        blurb: 'A grocery list that sorts itself into categories as you add items.',
        source: `${repo}/homestead-apps/groceries`,
      },
      {
        name: 'Recipes',
        blurb:
          'Household recipes with proper ingredient lists, plus a log of what you cooked.',
        source: `${repo}/homestead-apps/recipes`,
      },
    ],
  },
  {
    label: 'Money',
    apps: [
      {
        name: 'Gift Cards',
        blurb: 'Every gift card the household owns, with its current balance.',
        source: `${repo}/homestead-apps/gift-cards`,
      },
      {
        name: 'Credit Cards',
        blurb: "Each card's perks in one place, so the rewards don't go to waste.",
        source: `${repo}/homestead-apps/credit-cards`,
      },
      {
        name: 'HSA Receipts',
        blurb:
          'Unreimbursed medical receipts, kept ready for a tax-free HSA withdrawal.',
        source: `${repo}/homestead-apps/hsa`,
      },
    ],
  },
  {
    label: 'Relationships',
    apps: [
      {
        name: 'People',
        blurb: 'Contact details and the dates worth remembering for people in your life.',
        source: `${repo}/homestead-apps/people`,
      },
      {
        name: 'Events',
        blurb: 'The recurring dates — birthdays, anniversaries — that come around each year.',
        source: `${repo}/homestead-apps/events`,
      },
      {
        name: 'Games',
        blurb:
          'Score-keeping for the games you play, from mini golf to Pictionary to bridge.',
        source: `${repo}/homestead-apps/games`,
      },
    ],
  },
  {
    label: 'System',
    apps: [
      {
        name: 'Dashboard',
        blurb: "A single overview stitched together from the other apps' widgets.",
        source: `${repo}/homestead-core/dashboard`,
      },
      {
        name: 'Notifications',
        blurb: 'Everything your apps want to tell you, web push included.',
        source: `${repo}/homestead-core/notifications`,
      },
    ],
  },
];
</script>

<template>
  <main class="hs">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Homestead home">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </a>
      <nav aria-label="Primary">
        <a href="/#install">Install</a>
        <a href="/apps">Apps</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="apps-hero">
      <p class="section-label">Example apps</p>
      <h1>Apps we've already built.</h1>
      <p class="lede">
        Everything here already ships in the repo — real apps built to run a
        household, not demos of a framework. Install the ones you want as-is,
        change whatever doesn't fit, or copy one as the starting point for an app
        of your own. <code>homestead init</code> sets you up with a default set;
        the <code>apps</code> array in <code>homestead.config.ts</code> decides
        what's installed.
      </p>
    </section>

    <section
      v-for="group in groups"
      :key="group.label"
      class="apps-group"
    >
      <p class="section-label">{{ group.label }}</p>
      <div class="apps-grid">
        <a
          v-for="app in group.apps"
          :key="app.name"
          class="app-card"
          :href="app.source"
        >
          <h3>{{ app.name }}</h3>
          <p>{{ app.blurb }}</p>
          <span class="app-card-link">View source &rarr;</span>
        </a>
      </div>
    </section>

    <section class="apps-note">
      <p>
        <strong>Settings</strong>, <strong>Users</strong>, and
        <strong>Superuser</strong> come built in — you can't remove them. And
        because every app exposes its data through Homestead's API, your agents
        can use them too: adding a grocery item or logging a recipe the same way
        you would.
      </p>
      <div class="cta">
        <a class="button" href="/guides/quick-start">Build your own app</a>
        <a class="link" href="/guides/">Read the docs &rarr;</a>
      </div>
    </section>

    <footer class="footer">
      <div class="brand">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </div>
      <p>Personal apps you actually own.</p>
      <nav aria-label="Footer">
        <a href="/#install">Install</a>
        <a href="/apps">Apps</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
