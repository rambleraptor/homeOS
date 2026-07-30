# AI Support

Your household data sits behind a standard REST API, so AI tools can work
with it. You have four ways in:

- **[`homestead resources`](#read-and-write-data-from-the-cli)** — a CLI that
  reads and writes your data. Best for an agent or a script.
- **[Chat](#chat-with-your-data)** — a built-in assistant that manages your
  data in plain language.
- **[An MCP server](#connect-an-mcp-client)** — connect Claude or another MCP
  client to your instance.
- **[Agent skills](#teach-a-coding-agent-with-skills)** — drop-in skills that
  teach your coding agent to scaffold apps, edit your schema, and stand up an
  instance.

The built-in features that call a model directly — [Chat](#chat-with-your-data)
and the photo-import features (grocery lists, HSA receipts) — share one
provider you [configure once](#configure-your-ai-provider). The CLI, MCP, and
skills above use whatever model you already run, so they need no provider
config.

---

## Configure your AI provider

Homestead's built-in AI features — the [chat assistant](#chat-with-your-data),
grocery-list photo import, and HSA receipt scanning — run through a single
provider you choose. Three are supported, via the
[Vercel AI SDK](https://ai-sdk.dev):

| Provider           | `provider`    | Example model              |
| ------------------ | ------------- | -------------------------- |
| OpenAI (Codex)     | `'openai'`    | `gpt-4o`                   |
| Anthropic (Claude) | `'anthropic'` | `claude-3-5-sonnet-latest` |
| Google (Gemini)    | `'google'`    | `gemini-2.5-flash`         |

Set the `ai` block in `homestead.config.ts` — provider, model, and auth — and
read the API key from the environment so the secret never reaches the client
bundle:

```ts
// homestead.config.ts
const aiApiKey = fromEnv('AI_API_KEY');
const ai: HomesteadConfig['ai'] = aiApiKey
  ? {
      provider: 'google', //  'openai' | 'anthropic' | 'google'
      model: 'gemini-2.5-flash', // must be vision-capable for the photo features
      auth: { apiKey: aiApiKey },
    }
  : undefined;

const config: HomesteadConfig = {
  apps: [/* … */],
  ai,
};
```

```bash
# .env — get a key from your chosen provider's console.
AI_API_KEY=your_ai_provider_api_key_here
```

Restart the server to apply changes. AI is **opt-in**: with no `ai` block (no
key set), the chat and photo endpoints return `503` and the rest of Homestead
works as normal.

::: tip Vision models
The grocery and HSA photo features send an image to the model, so the
configured `model` must be vision-capable. The example models above all are.
:::

---

## Read and write data from the CLI

`homestead resources` reads and writes your household data from the command
line. Run it on the box where Homestead is installed; it authenticates
itself by reading the instance's database, so you don't pass credentials.

**List every resource and what you can do with it:**

```bash
homestead resources
```

```
Available resources — run `homestead resources <resource> <verb>`:

  account-tag   list, get, create, delete            (parent: --user)
  gift-card     list, get, create, update, delete
  transaction   list, get, create, delete            (parent: --gift-card)

Run `homestead resources <resource>` for fields and usage.
```

**See a resource's fields and usage:**

```bash
homestead resources gift-card
```

This prints the description, every field (with type and whether it's
required), file fields, and any custom methods.

**Read and write:**

```bash
homestead resources gift-card list
homestead resources gift-card get <id>
homestead resources gift-card create --merchant "Visa" --amount 100
homestead resources gift-card update <id> --notes "Used $50"
homestead resources gift-card delete <id>
```

For a child resource, pass the parent id before the verb:

```bash
homestead resources --gift-card <card-id> transaction list
```

The command discovers your schema at runtime, so it always lists the
resources your apps declare. Point an agent at it and it learns your whole
API by running `homestead resources`.

### Flags

| Flag                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `--token=TOKEN`               | Use an existing bearer token instead of minting one.           |
| `--email=… --password=…`      | Authenticate with superuser credentials instead of minting.    |
| `--server-url=URL`            | Target a remote engine (default `http://127.0.0.1:<port>/api/aep`). |
| `--@data=PATH`                | Supply a JSON body from a file (for create or custom methods). |
| `--data-dir=PATH`             | Where the SQLite database lives (default `<project>/data`).    |

---

## Chat with your data

Chat is a built-in assistant that looks up and changes your household data in
plain language — "how much is left on my Visa gift card?", "add milk to the
grocery list", "what events are coming up?". It's always installed; find it in
the top navigation.

Chat works with **any** app you've added, with no per-app setup. It acts
with **your** permissions, confirms before deleting, and shows you which
actions it took. Conversations are not stored — each one lives only in the
open tab.

### Enable Chat

Chat runs on whichever model you [configure as your AI
provider](#configure-your-ai-provider) — OpenAI, Anthropic, or Gemini. Set the
`ai` block in `homestead.config.ts`, supply `AI_API_KEY`, and restart the
server; the Chat screen then answers questions instead of reporting that the
assistant isn't configured. Without an `ai` block, Chat reports that it isn't
configured and the rest of Homestead works as normal.

---

## Connect an MCP client

Homestead ships a **built-in [MCP](https://modelcontextprotocol.io) server** at
`/api/mcp` — no separate process. It exposes the same tools as Chat (create,
read, update, and delete per resource, plus document search when embeddings are
configured), and every action runs with the signed-in user's own permissions.

**Enable it.** MCP clients sign in through Homestead's OAuth authorization
server, so turn that on in `homestead.config.ts` and restart:

```bash
OAUTH_SERVER_ENABLED=1
OAUTH_SERVER_ISSUER_URL=https://your-host   # the instance's public origin
```

The MCP server is on by default whenever the authorization server is enabled
(set `auth.authServer.mcpEnabled: false` to run the AS without it).

**Connect a client.** Point your MCP client (e.g. Claude Desktop) at:

```
https://your-host/api/mcp
```

Authorization is automatic — **no bearer token to copy**. The client discovers
the authorization server from the endpoint, registers itself, and opens
Homestead's sign-in and consent screen in your browser; approve it and the
client is connected. The model can then list, read, and write your household
resources.

> Prefer an out-of-process option? The community
> [`aep-mcp-server`](https://github.com/aep-dev/aep-mcp-server) can still be
> pointed at the engine's `/api/aep` prefix with a bearer token from
> `homestead login`.

---

## Teach a coding agent with skills

Homestead ships [`SKILL.md`](https://agentskills.io) skills in the repo
under `.claude/skills/`:

| Skill             | What it does                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `setup-homestead` | Stand up a new instance — scaffold, first boot, claim the admin account, install service. |
| `create-app`      | Scaffold a new feature app end-to-end — resources, hooks, components, config, e2e.        |
| `add-resource`    | Add or modify a resource definition (fields, enums, file fields, child resources).        |
| `add-widget`      | Add a dashboard widget to an existing app.                                                 |

Copy them into your agent's skills directory (use `~/...` for all projects,
or the dotted form inside one project), then start a fresh session:

```bash
cp -R /path/to/homestead/.claude/skills/*  ~/.claude/skills/    # Claude Code
cp -R /path/to/homestead/.claude/skills/*  ~/.codex/skills/     # Codex
cp -R /path/to/homestead/.claude/skills/*  ~/.gemini/skills/    # Gemini CLI
```
