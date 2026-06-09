<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';

const { frontmatter } = useData();
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
        <a href="#features">Platform</a>
        <a href="#deploy">Deploy</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <p class="pill"><span class="dot"></span> Self-hosted &middot; one binary</p>
      <h1>Build and deploy apps for&nbsp;you, your family, and your&nbsp;agents.</h1>
      <p class="lede">
        Homestead is the platform under your personal apps — authentication, a
        database, an agent-readable API, and a one-command deploy, all in a
        single binary you run on hardware you own.
      </p>
      <div class="cta">
        <a class="button" href="/guides/installation">Install Homestead</a>
        <a class="link" href="/guides/">Read the docs &rarr;</a>
      </div>
    </section>

    <section class="features" id="features" aria-label="The platform">
      <div class="features-intro">
        <p class="section-label">What the platform handles</p>
        <h2>The boring, necessary parts — already done.</h2>
        <p class="sub">
          Every small app needs the same foundation. Homestead ships it, so you
          write the part that's actually yours and move on with your life.
        </p>
      </div>

      <div class="cards">
        <article class="card">
          <h3>Authentication, built in</h3>
          <p>
            Users, sessions, and a superuser exist from the first boot. No auth
            service to wire up, no passwords for you to store or get wrong.
          </p>
          <div class="mock">
            <div class="auth-row">
              <span class="avatar"></span>
              <div class="auth-id">
                <b>you@home</b>
                <small>superuser</small>
              </div>
              <span class="badge-on">signed in</span>
            </div>
            <div class="auth-row dim">
              <span class="avatar"></span>
              <div class="auth-id">
                <b>family</b>
                <small>2 members</small>
              </div>
              <span class="badge">invited</span>
            </div>
          </div>
        </article>

        <article class="card">
          <h3>Ship an app in an afternoon</h3>
          <p>
            Each feature is a self-contained module — routes, data, settings,
            and workers in one folder. Scaffold it, add one line of config, done.
          </p>
          <div class="mock">
            <pre><code><span class="tok-dir">groceries/</span>
  components/
  hooks/
  resources.ts
  <span class="tok-file">module.config.ts</span></code></pre>
          </div>
        </article>

        <article class="card">
          <h3>Skills your agents can call</h3>
          <p>
            Each module's actions are exposed as typed operations — real skills
            an agent invokes directly, not screens it has to scrape.
          </p>
          <div class="mock">
            <div class="skill-row"><span class="tick">&#10003;</span> add_grocery_item</div>
            <div class="skill-row"><span class="tick">&#10003;</span> log_recipe_cooked</div>
            <div class="skill-row"><span class="tick">&#10003;</span> redeem_card_perk</div>
          </div>
        </article>

        <article class="card">
          <h3>One backend, two audiences</h3>
          <p>
            Under every app is an AEP-compliant REST API with schemas agents
            discover on boot. Anything a person can do, an agent can automate.
          </p>
          <div class="mock">
            <pre><code><span class="tok-verb">GET</span>  /api/aep/recipes
<span class="tok-verb">POST</span> /api/aep/gift-cards/:id/transactions</code></pre>
          </div>
        </article>

        <article class="card">
          <h3>Your data stays home</h3>
          <p>
            Everything runs as one binary on hardware you own, backed by a local
            SQLite file. Nothing lives on someone else's server.
          </p>
          <div class="mock">
            <pre><code><span class="tok-lock">&#9679;</span> ~/.homestead/data/<span class="tok-file">homestead.db</span>
  <span class="tok-dim">files/ &middot; credentials.json</span></code></pre>
          </div>
        </article>

        <article class="card">
          <h3>The database manages itself</h3>
          <p>
            Declare resources in TypeScript; the schema syncs on boot — creating,
            patching, and ordering tables for you. No migrations to hand-write.
          </p>
          <div class="mock">
            <pre><code>resources: [<span class="tok-file">giftCard</span>, <span class="tok-file">transaction</span>]
<span class="tok-dim">&rarr; synced 2 definitions</span></code></pre>
          </div>
        </article>
      </div>
    </section>

    <section class="deploy" id="deploy">
      <p class="section-label muted">One-command deploy</p>
      <h2>Install, init, start.</h2>
      <p class="deploy-sub">
        One command pulls a verified binary. Another boots the web app, the REST
        backend, the schema sync, and the database together — one process, one
        port, on a machine you already own.
      </p>
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
        <a href="#features">Platform</a>
        <a href="#deploy">Deploy</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
