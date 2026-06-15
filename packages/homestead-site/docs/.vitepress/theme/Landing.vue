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
        <a href="#agents">Agents</a>
        <a href="#features">Platform</a>
        <a href="#deploy">Deploy</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </header>

    <section class="hero">
      <p class="pill"><span class="dot"></span> Self-hosted &middot; one binary &middot; MIT</p>
      <h1>Personal software for&nbsp;you and your&nbsp;family.</h1>
      <p class="lede">
        Build the apps your household actually wants — groceries, recipes,
        chores — without the App Store, App Review, or a backend to run. One
        command puts them online for your family, and every app ships with a
        typed API your agents can call.
      </p>
      <div class="cta">
        <a class="button" href="/guides/installation">Install Homestead</a>
        <a class="link" href="/guides/">Read the docs &rarr;</a>
      </div>
    </section>

    <section class="agent" id="agents" aria-label="Agents in action">
      <div class="agent-copy">
        <p class="section-label">Agents in action</p>
        <h2>Say it once. It lands in the family's apps.</h2>
        <p class="sub">
          Homestead publishes a typed schema for every app on boot. An agent
          reads it, calls real operations — not screenshots, not scraping —
          and the result shows up in the same apps your household already
          uses.
        </p>
        <a class="link" href="/apps">See what agents can reach &rarr;</a>
      </div>
      <div class="chat" aria-label="Example agent conversation">
        <p class="chat-msg from-user">
          We cooked the lemon orzo tonight — and we're out of olive oil.
        </p>
        <div class="chat-msg from-agent">
          <p>Done. I logged the recipe and added olive oil to the list.</p>
          <div class="skill-row">
            <span class="tick">&#10003;</span>
            log_recipe_cooked &middot; Lemon orzo &rarr; Recipes
          </div>
          <div class="skill-row">
            <span class="tick">&#10003;</span>
            add_grocery_item &middot; Olive oil &rarr; Groceries
          </div>
        </div>
        <div class="chat-result">
          <span class="badge">Groceries &middot; 1 new item</span>
          <span class="badge">Recipes &middot; cooked tonight</span>
        </div>
      </div>
    </section>

    <section class="features" id="features" aria-label="The platform">
      <div class="features-intro">
        <p class="section-label">What the platform handles</p>
        <h2>The boring, necessary parts — already done.</h2>
        <p class="sub">
          A native app means a developer account, App Review, and a backend to
          run — for software only your family will open. Homestead ships that
          foundation, so you write just the part that's yours.
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
            Each feature is a self-contained app — routes, data, settings,
            and workers in one folder. Scaffold it, add one line of config, done.
          </p>
          <div class="mock">
            <pre><code><span class="tok-dir">groceries/</span>
  components/
  hooks/
  resources.ts
  <span class="tok-file">app.config.ts</span></code></pre>
          </div>
        </article>

        <article class="card">
          <h3>Skills your agents can call</h3>
          <p>
            Each app's actions are exposed as typed operations — real skills
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
            <pre><code><span class="tok-lock">&#9679;</span> my-home/data/<span class="tok-file">aepbase.db</span>
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

      <p class="apps-line">
        Homestead ships with 11 built-in apps — groceries, recipes, todos,
        gift cards, and more.
        <a class="link" href="/apps">See what's included &rarr;</a>
      </p>
    </section>

    <section class="who" aria-label="Who Homestead is for">
      <article>
        <h3>For self-hosters</h3>
        <p>
          One binary on one port, systemd-ready.
          <code>homestead install-service</code> sets up the service;
          <code>homestead doctor</code> checks the box first.
        </p>
        <a class="link" href="/guides/installation">Install &rarr;</a>
      </article>
      <article>
        <h3>For your household</h3>
        <p>
          Real apps from first boot — groceries, recipes, events, todos —
          with accounts and invites built in. No one else's cloud.
        </p>
        <a class="link" href="/apps">See the apps &rarr;</a>
      </article>
      <article>
        <h3>For your agents</h3>
        <p>
          An AEP-compliant REST API with schemas discovered on boot. Anything
          a person can do in the UI, an agent can do through the API.
        </p>
        <a class="link" href="#agents">How it works &rarr;</a>
      </article>
    </section>

    <section class="faq" id="faq" aria-label="Frequently asked questions">
      <div class="faq-inner">
        <div class="faq-intro">
          <p class="section-label">Questions, answered</p>
          <h2>Before you point it at a server.</h2>
        </div>

        <details>
          <summary>What hardware do I need?</summary>
          <p>
            Any macOS or Linux box, x64 or arm64. The installer pulls a
            prebuilt, verified binary with everything embedded — no Node,
            Bun, or Go at runtime. A mini PC or a small VPS is plenty, and
            <code>homestead doctor</code> checks a machine before you commit
            to it.
          </p>
        </details>

        <details>
          <summary>How do updates work?</summary>
          <p>
            Edit <code>homestead.config.ts</code> or your apps and a running
            instance applies the change on its own — it rebuilds the SPA and
            reapplies config, and open tabs reload. To ship new code, point the
            project dir at a git checkout of your config and <code>git pull</code>;
            the running instance picks it up with no extra step.
          </p>
        </details>

        <details>
          <summary>How do I back up my data?</summary>
          <p>
            Everything lives in one directory: a single SQLite file
            (<code>data/aepbase.db</code>) plus a <code>files/</code> folder
            for uploads. Copy that directory with whatever backup tool you
            already use, and your homestead is backed up.
          </p>
        </details>

        <details>
          <summary>Is it open source?</summary>
          <p>
            Yes — MIT licensed, with the full
            <a class="link" href="https://github.com/rambleraptor/homestead"
              >source on GitHub</a
            >.
          </p>
        </details>

        <details>
          <summary>What leaves my machine?</summary>
          <p>
            Your data: nothing. The database binds to loopback and a single
            port faces your network — many people keep even that on a private
            network like Tailscale. The binary only reaches out for things
            you ask for: release downloads, <code>git pull</code> of your own
            config remote, and — only if you turn them on — Google sign-in and
            web-push delivery.
          </p>
        </details>

        <details>
          <summary>Can I write my own apps?</summary>
          <p>
            That's the point. <code>homestead init</code> gives you an
            <code>apps/</code> folder; an app is a directory with an
            <code>app.config.ts</code> declaring its routes, data, widgets,
            and settings. One line in <code>homestead.config.ts</code> ships
            it — the
            <a class="link" href="/guides/quick-start">Quick Start</a> walks
            through it.
          </p>
        </details>
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
        <pre><code><span class="prompt">$</span> curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash</code></pre>
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
        <a href="/apps">Apps</a>
        <a href="/guides/">Docs</a>
        <a href="#faq">FAQ</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
