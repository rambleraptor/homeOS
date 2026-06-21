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
        blurb: 'A daily todo list with progress tracking.',
        source: `${repo}/homestead-apps/todos`,
      },
    ],
  },
  {
    label: 'Food',
    apps: [
      {
        name: 'Groceries',
        blurb: 'Manage your grocery list with smart categorization.',
        source: `${repo}/homestead-apps/groceries`,
      },
      {
        name: 'Recipes',
        blurb:
          'Keep household recipes with structured ingredients, and log what you cooked.',
        source: `${repo}/homestead-apps/recipes`,
      },
    ],
  },
  {
    label: 'Money',
    apps: [
      {
        name: 'Gift Cards',
        blurb: 'Track household gift cards and their balances.',
        source: `${repo}/homestead-apps/gift-cards`,
      },
      {
        name: 'Credit Cards',
        blurb: 'Track credit card perks and maximize rewards.',
        source: `${repo}/homestead-apps/credit-cards`,
      },
      {
        name: 'HSA Receipts',
        blurb:
          'Track unreimbursed medical expenses for tax-free HSA withdrawals.',
        source: `${repo}/homestead-apps/hsa`,
      },
    ],
  },
  {
    label: 'Relationships',
    apps: [
      {
        name: 'People',
        blurb: 'Contact information and important dates for the people you know.',
        source: `${repo}/homestead-apps/people`,
      },
      {
        name: 'Events',
        blurb: 'Track yearly-recurring household events.',
        source: `${repo}/homestead-apps/events`,
      },
      {
        name: 'Games',
        blurb:
          'Scorekeeping for the games you play — mini golf, Pictionary, bridge.',
        source: `${repo}/homestead-apps/games`,
      },
    ],
  },
  {
    label: 'System',
    apps: [
      {
        name: 'Dashboard',
        blurb: 'An overview built from widgets the other apps contribute.',
        source: `${repo}/homestead-core/dashboard`,
      },
      {
        name: 'Notifications',
        blurb: 'View and manage your notifications, including web push.',
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
      <h1>Every feature is an app.</h1>
      <p class="lede">
        The apps below ship in the repo. Install the ones you want, edit them to
        fit your household, or use them as a starting point for your own.
        <code>homestead init</code> gives you a default set; add or remove an app
        by editing the <code>apps</code> array in
        <code>homestead.config.ts</code>.
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
        The <strong>Settings</strong>, <strong>Users</strong>, and
        <strong>Superuser</strong> apps are always installed. Every app also
        publishes its schema and operations through Homestead's AEP-compliant
        API, so anything you can do in an app, an agent can do too.
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
