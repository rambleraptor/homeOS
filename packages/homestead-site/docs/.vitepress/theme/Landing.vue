<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import Apps from './Apps.vue';

const { frontmatter } = useData();
</script>

<template>
  <Apps v-if="frontmatter.layout === 'showcase'" />
  <DefaultTheme.Layout v-else-if="frontmatter.layout !== 'landing'" />
  <main v-else class="hs">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Homestead home">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </a>
      <nav aria-label="Primary">
        <a href="#install">Install</a>
        <a href="/apps">Apps</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <h1>Build and deploy apps for you, your family, and your agents.</h1>
      <p class="lede">
        Building a personal app is too difficult. You need app reviews,
        sideloading, and you still need to run a backend. Homestead lets you
        build personal apps and share them with only your family easily.
      </p>
      <div class="audience">
        <p>
          <strong>You.</strong> All your app needs to get started is a data
          model. Add a React frontend, notifications, or offline support later.
        </p>
        <p>
          <strong>Your family.</strong> Homestead handles authentication and
          authorization. You can have family members log in through OAuth and
          make sure that Uncle Mike doesn't have access to your date night app.
        </p>
        <p>
          <strong>Your agents.</strong> Your data is exposed through a chatbot
          and an agent-friendly CLI. Point your existing agents at it — they get
          scoped access to your data, and nothing more.
        </p>
      </div>
      <div class="cta">
        <a class="button" href="#install">Install Homestead</a>
        <a class="link" href="/guides/">Read the docs &rarr;</a>
      </div>
    </section>

    <section class="deploy" id="install">
      <div class="deploy-inner">
        <p class="section-label muted">One-command deploy</p>
        <h2>Install, init, start.</h2>
        <p class="deploy-sub">
          One command installs the CLI from npm. The next runs the whole thing —
          frontend, backend, and database in a single process — on a machine you
          already own.
        </p>
        <div class="commands">
          <pre><code><span class="prompt">$</span> npm install -g @rambleraptor/homestead-cli</code></pre>
          <pre><code><span class="prompt">$</span> homestead init my-home
<span class="prompt">$</span> cd my-home
<span class="prompt">$</span> homestead start</code></pre>
        </div>
        <a class="button on-dark" href="https://github.com/rambleraptor/homestead">View on GitHub</a>
      </div>
    </section>

    <footer class="footer">
      <div class="brand">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </div>
      <p>Personal apps you actually own.</p>
      <nav aria-label="Footer">
        <a href="#install">Install</a>
        <a href="/apps">Apps</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
