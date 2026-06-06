<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';

const { frontmatter } = useData();

const steps = [
  {
    n: '01',
    title: 'Install',
    text: 'One command pulls a verified release binary for your machine. No source checkout, no language toolchain, no afternoon lost to setup.',
  },
  {
    n: '02',
    title: 'Run',
    text: 'homestead start boots the web app, the REST backend, the schema sync, and a SQLite database together — one process, one port, on hardware you already own.',
  },
  {
    n: '03',
    title: 'Extend',
    text: 'Add modules as your needs get specific. Each one carries its own routes, data, settings, and workers, so the system stays legible as it grows.',
  },
];

const modules = [
  'Todos',
  'Groceries',
  'Recipes',
  'People',
  'Events',
  'Gift cards',
  'Credit-card perks',
  'HSA receipts',
];
</script>

<template>
  <DefaultTheme.Layout v-if="frontmatter.layout !== 'landing'" />
  <main v-else class="hs">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Homestead home">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </a>
      <nav aria-label="Primary">
        <a href="#how">How it works</a>
        <a href="#agents">For agents</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <p class="eyebrow">Personal software, self-hosted</p>
      <h1>Build and deploy apps for&nbsp;you, your family, and your&nbsp;agents.</h1>
      <p class="lede">
        Homestead is a single binary that runs the small, personal apps you
        actually want — and gives every one of them a clean, agent-readable
        backend. No platform team required.
      </p>
      <div class="cta">
        <a class="button" href="#install">Install Homestead</a>
        <a class="link" href="https://github.com/rambleraptor/homestead">Read the source &rarr;</a>
      </div>
    </section>

    <section class="manifesto">
      <p>
        You have a small app idea. A grocery list the whole house can edit. A
        record of who gets which gift. A vault for the receipts you'll need at
        tax time. The kind of software that should take an afternoon.
      </p>
      <p>
        But an afternoon turns into a stack: authentication, a database,
        schemas, a deploy target, backups you swear you'll set up. The idea goes
        cold long before it ships.
      </p>
      <p class="emph">
        Homestead hands you the whole stack in one binary, so you can build the
        thing and move on with your life.
      </p>
    </section>

    <section class="how" id="how" aria-label="How Homestead works">
      <p class="section-label">How it works</p>
      <ol>
        <li v-for="step in steps" :key="step.n">
          <span class="num">{{ step.n }}</span>
          <div>
            <h2>{{ step.title }}</h2>
            <p>{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="agents" id="agents">
      <p class="section-label muted">For your agents</p>
      <h2>
        Every module exposes its data as resources — not screens to scrape.
      </h2>
      <p>
        Under each Homestead app is an AEP-compliant REST API. Your family taps
        through the interface; your agents read and write the same records
        directly, with schemas they can discover on boot. One backend serves
        both, which means anything a person can do, an agent can automate —
        cleanly, and without a brittle pile of UI selectors in between.
      </p>
    </section>

    <section class="modules">
      <p class="section-label">Start with useful modules</p>
      <ul>
        <li v-for="m in modules" :key="m">{{ m }}</li>
        <li class="own">…and your own</li>
      </ul>
    </section>

    <section class="install" id="install">
      <p class="section-label muted">Install</p>
      <h2>Build the small app before the mood passes.</h2>
      <div class="commands">
        <pre><code><span class="prompt">$</span> curl -fsSL https://homestead.sh/install | bash</code></pre>
        <pre><code><span class="prompt">$</span> homestead init my-home
<span class="prompt">$</span> cd my-home
<span class="prompt">$</span> homestead start</code></pre>
      </div>
      <a class="button on-dark" href="https://github.com/rambleraptor/homestead">View on GitHub</a>
    </section>

    <footer class="footer">
      <div class="brand">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </div>
      <p>Build and deploy apps for you, your family, and your agents.</p>
      <nav aria-label="Footer">
        <a href="#how">How it works</a>
        <a href="#agents">For agents</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
