<script setup lang="ts"></script>

<template>
  <main class="hs">
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

    <section class="apps-hero">
      <h1>From a schema to a running app.</h1>
      <p class="lede">
        You describe your data. Homestead hands back a database, an API, a
        chatbot, and a UI to go with it, all on your own machine. Here's what
        happens in between.
      </p>
    </section>

    <section class="apps-group">
      <ol class="arch">
        <li class="arch-step">
          <div class="arch-n">01</div>
          <div class="arch-c">
            <h3>You define your data</h3>
            <p>
              Every app begins with a resource definition: the fields for one
              kind of thing. A grocery list has grocery items. That's the whole
              job.
            </p>
            <pre class="arch-code"><span class="c">// grocery-item</span>
fields: {
  name:     { type: <span class="s">'string'</span>, required: <span class="k">true</span> },
  quantity: { type: <span class="s">'number'</span> },
  category: { type: <span class="s">'string'</span> },
  bought:   { type: <span class="s">'boolean'</span> },
}</pre>
          </div>
        </li>

        <li class="arch-step">
          <div class="arch-n">02</div>
          <div class="arch-c">
            <h3>Homestead builds the backend</h3>
            <p>
              On boot it creates a SQLite database on your machine and a REST
              API for every resource: the usual create, read, update, delete.
              Users and auth come built in.
            </p>
            <pre class="arch-code"><span class="m">POST</span>/api/aep/grocery-items
<span class="m">GET</span>/api/aep/grocery-items
<span class="m">GET</span>/api/aep/grocery-items/<span class="c">{id}</span>
<span class="m">PATCH</span>/api/aep/grocery-items/<span class="c">{id}</span>
<span class="m">DELETE</span>/api/aep/grocery-items/<span class="c">{id}</span></pre>
          </div>
        </li>

        <li class="arch-step">
          <div class="arch-n">03</div>
          <div class="arch-c">
            <h3>Read and write from anywhere</h3>
            <p>
              Everything goes through that one authenticated API: call it over
              REST, drive it from the CLI (handy for agents), or just ask the
              built-in chatbot.
            </p>
            <pre class="arch-code"><span class="c"># CLI</span>
<span class="p">$</span> homestead resources grocery-item create --name <span class="s">"Milk"</span> --quantity 2
<span class="p">$</span> homestead resources grocery-item list

<span class="c"># REST</span>
<span class="p">$</span> curl $HOMESTEAD/api/aep/grocery-items \
    -H <span class="s">"Authorization: Bearer $TOKEN"</span></pre>
          </div>
        </li>

        <li class="arch-step">
          <div class="arch-n">04</div>
          <div class="arch-c">
            <h3>React apps on top</h3>
            <p>
              Homestead builds and serves the React apps that sit on top of that
              API: the interface your household actually opens. Change them, or
              write your own.
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section class="apps-note">
      <p>
        Your apps, your agents, and the chatbot all touch the same records, on
        hardware you own, start to finish.
      </p>
      <div class="cta">
        <a class="button" href="/guides/quick-start">Quick start</a>
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
        <a href="/">Home</a>
        <a href="/architecture">Architecture</a>
        <a href="/guides/">Docs</a>
        <a href="https://github.com/rambleraptor/homestead">GitHub</a>
      </nav>
    </footer>
  </main>
</template>
