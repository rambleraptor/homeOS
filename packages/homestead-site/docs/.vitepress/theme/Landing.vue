<script setup lang="ts">
import { ref } from 'vue';
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import Architecture from './Architecture.vue';

const { frontmatter } = useData();

const VIDEO_ID = 'Ghdq19oQeNU';

// Click-to-play facade: the YouTube iframe (and its ~1MB of player JS) only
// loads once the visitor actually asks for the video.
const playing = ref(false);
const poster = ref(`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`);
const onPosterError = () => {
  poster.value = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;
};
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

      <div class="hero-video">
        <button
          v-if="!playing"
          type="button"
          class="video-facade"
          aria-label="Play the Homestead demo video"
          @click="playing = true"
        >
          <img :src="poster" alt="" loading="eager" @error="onPosterError" />
          <span class="play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </button>
        <iframe
          v-else
          :src="`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`"
          title="Homestead demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      <p class="lede">
        <strong>Homestead is an open-source, self-hosted platform for building
        and deploying personal apps for you, your family, and your AI
        agents.</strong> Building a personal app is normally too difficult:
        app reviews, sideloading, and a backend to run. Homestead lets you build
        personal apps and share them with only your family, easily.
      </p>

      <div class="get-started" id="install">
        <div class="commands">
          <pre><code><span class="prompt">$</span> npm install -g @rambleraptor/homestead-cli</code></pre>
          <pre><code><span class="prompt">$</span> homestead init &amp;&amp; homestead start</code></pre>
        </div>
        <div class="cta">
          <a class="button" href="https://github.com/rambleraptor/homestead">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            View on GitHub
          </a>
          <a class="button ghost" href="/guides/">Read the docs</a>
          <a class="link" href="/guides/quick-start">Build your first app &rarr;</a>
        </div>
      </div>
    </section>

    <section class="bento-section">
      <div class="bento">
        <a class="bento-box" href="/guides/users">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
              <circle cx="12" cy="15.5" r="1.4" />
            </svg>
          </span>
          <h3>Authentication</h3>
          <p>
            Email/password or OAuth. You can make sure certain people only access certain apps.
          </p>
        </a>

        <a class="bento-box" href="/guides/offline">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 4l20 16" />
              <path d="M5 12.5a9 9 0 0 1 4-2.3" />
              <path d="M1.5 8.8a14 14 0 0 1 5-3.2" />
              <path d="M13 6a14 14 0 0 1 9.5 2.8" />
              <path d="M15.5 12.7A9 9 0 0 0 12 10" />
              <path d="M8.6 16.2a4.5 4.5 0 0 1 6.8 0" />
              <circle cx="12" cy="19.8" r="0.8" fill="currentColor" />
            </svg>
          </span>
          <h3>Offline support</h3>
          <p>The basement, the car, the cabin. Your edits sync when you're back.</p>
        </a>

        <a class="bento-box" href="/guides/ai">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="4" width="19" height="16" rx="2" />
              <path d="M7 9.5l3 2.5-3 2.5" />
              <path d="M12.5 15h4.5" />
            </svg>
          </span>
          <h3>CLI</h3>
          <p>Your agents can use it too, and only see what you let them.</p>
        </a>

        <a class="bento-box" href="/guides/ai">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a8 8 0 0 1-8 8H4l1.8-3A8 8 0 1 1 21 12Z" />
              <path d="M12.5 8l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
            </svg>
          </span>
          <h3>AI</h3>
          <p>
            A chatbot wired into your data — only if you want one.
          </p>
        </a>

        <a class="bento-box" href="/guides/notifications">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
              <path d="M10.3 19a2 2 0 0 0 3.4 0" />
            </svg>
          </span>
          <h3>Push notifications</h3>
          <p>Nudge the whole house, or just yourself.</p>
        </a>

        <a class="bento-box" href="/guides/bulk-import">
          <span class="bento-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
              <path d="M14 3v5h5" />
              <path d="M12 17v-6" />
              <path d="M9.5 13.5 12 11l2.5 2.5" />
            </svg>
          </span>
          <h3>Bulk import</h3>
          <p>Upload CSV files with configuration only.</p>
        </a>
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
