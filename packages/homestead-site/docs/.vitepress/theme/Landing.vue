<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';

const { frontmatter } = useData();

const workflow = [
  {
    number: '1',
    title: 'Installs',
    text: 'The installer downloads a verified release binary for your machine. No source checkout, no local toolchain, no ritual.',
  },
  {
    number: '2',
    title: 'Starts',
    text: 'One command boots the React app, AEP backend, Bun sidecar, schema sync, SQLite data, and same-origin web server.',
  },
  {
    number: '3',
    title: 'Grows',
    text: 'Add modules as your needs get specific. Routes, widgets, resources, workers, and settings move together.',
  },
];

const modules = ['Todos', 'Groceries', 'People', 'Recipes', 'Gift cards', 'Credit perks'];
const surfaces = ['Home server', 'Mini PC', 'Private VPS', 'Tailscale'];
</script>

<template>
  <DefaultTheme.Layout v-if="frontmatter.layout !== 'landing'" />
  <main v-else class="hs-site">
    <section class="hero" aria-labelledby="hero-title">
      <header class="nav">
        <a class="brand" href="/" aria-label="Homestead home">
          <img src="/homestead-icon.png" alt="" />
          <span>Homestead</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#modules">Modules</a>
          <a href="#install">Install</a>
        </nav>
      </header>

      <div class="hero-inner">
        <div class="mark-stack" aria-hidden="true">
          <img src="/homestead-icon.png" alt="" />
          <span></span>
        </div>
        <p class="eyebrow">Personal infrastructure for agent-native apps</p>
        <h1 id="hero-title">Run your own apps without becoming the platform team.</h1>
        <a class="button primary" href="#install">Install Homestead</a>
      </div>
    </section>

    <section class="story">
      <p>
        You have a small app idea. A grocery workflow. A private CRM. A receipt vault.
        A dashboard only you would ever need.
      </p>
      <p>
        Three services later, the idea is buried under auth, schemas, workers,
        deployment, and a database you promised to back up.
      </p>
      <p class="punch">Homestead keeps the stack alive before the idea goes cold.</p>
    </section>

    <section class="workflow" id="how" aria-label="How Homestead works">
      <article v-for="step in workflow" :key="step.number">
        <span>{{ step.number }}</span>
        <h2>{{ step.title }}</h2>
        <p>{{ step.text }}</p>
      </article>
    </section>

    <section class="product-views" aria-label="Homestead previews">
      <div class="app-window app-main">
        <div class="window-top">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="app-shell">
          <aside>
            <strong>Homestead</strong>
            <small v-for="module in modules.slice(0, 5)" :key="module">{{ module }}</small>
          </aside>
          <div class="dashboard">
            <div>
              <p>Today</p>
              <h3>Personal apps, running locally</h3>
            </div>
            <div class="tiles">
              <span>Tasks</span>
              <span>Receipts</span>
              <span>Perks</span>
              <span>Recipes</span>
            </div>
          </div>
        </div>
      </div>

      <div class="app-window terminal-card">
        <div class="window-top">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <code>
          <strong>$</strong> homestead start<br />
          <em>[homestead] ready</em><br />
          [homestead] app http://localhost:3000<br />
          [homestead] aepbase http://127.0.0.1:8090
        </code>
      </div>

      <div class="app-window agent-card">
        <p>Agent surface</p>
        <h3>Explicit resources instead of hidden UI state.</h3>
        <ul>
          <li>AEP-compliant REST API</li>
          <li>Module schemas on boot</li>
          <li>Scaffoldable routes and widgets</li>
        </ul>
      </div>
    </section>

    <section class="surface-band">
      <div>
        <h2>Works where you already run things</h2>
        <p>No managed platform required. Put the binary on your own machine and expose one port.</p>
      </div>
      <div class="surface-grid" aria-label="Deployment targets">
        <span v-for="surface in surfaces" :key="surface">{{ surface }}</span>
      </div>
    </section>

    <section class="memory-section">
      <div class="memory-copy">
        <p class="eyebrow">Remembers the shape</p>
        <h2>Your backend stays legible to humans and agents.</h2>
      </div>
      <p>
        Homestead modules declare their routes, widgets, settings, workers, and
        resources. That means the system can be inspected, extended, and operated
        without guessing what lives behind a button.
      </p>
    </section>

    <section class="module-strip" id="modules">
      <h2>Start with useful modules</h2>
      <div>
        <span v-for="module in modules" :key="module">{{ module }}</span>
        <span>your module</span>
      </div>
    </section>

    <section class="install" id="install">
      <h2>Build the small app before the mood passes.</h2>
      <div class="install-card">
        <code>curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash</code>
        <code>homestead init my-home<br />cd my-home<br />homestead start</code>
      </div>
      <a class="button primary" href="https://github.com/rambleraptor/homestead">View on GitHub</a>
    </section>

    <footer class="footer">
      <p>Run your own apps without becoming the platform team.</p>
      <nav aria-label="Footer navigation">
        <a href="#how">How it works</a>
        <a href="#modules">Modules</a>
        <a href="#install">Install</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
