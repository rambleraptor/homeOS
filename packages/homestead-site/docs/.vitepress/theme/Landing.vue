<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import Architecture from './Architecture.vue';

const { frontmatter } = useData();
</script>

<template>
  <Architecture v-if="frontmatter.layout === 'architecture'" />
  <DefaultTheme.Layout v-else-if="frontmatter.layout !== 'landing'" />
  <main v-else class="hs">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Homestead home">
        <img src="/homestead-icon.png" alt="" />
        <span>Homestead</span>
      </a>
      <nav aria-label="Primary">
        <a href="/">Home</a>
        <a href="/architecture">Architecture</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <h1>Build and deploy apps for you, your family, and your agents.</h1>
      <p class="lede">
        <strong>Homestead is an open-source, self-hosted platform for building
        and deploying personal apps for you, your family, and your AI
        agents.</strong> Building a personal app is normally too difficult:
        app reviews, sideloading, and a backend to run. Homestead lets you build
        personal apps and share them with only your family, easily.
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
          and an agent-friendly CLI. Point your existing agents at it. They get
          scoped access to your data, and nothing more.
        </p>
      </div>
      <div class="commands" id="install">
        <pre><code><span class="prompt">$</span> npm install -g @rambleraptor/homestead-cli</code></pre>
        <pre><code><span class="prompt">$</span> homestead init && homestead start</code></pre>
      </div>
      <div class="cta">
        <a class="button" href="https://github.com/rambleraptor/homestead">View on GitHub</a>
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
        <a href="#install">Install</a>
        <a href="/architecture">Architecture</a>
        <a href="/guides/apps">Example Apps</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
