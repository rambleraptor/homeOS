# AI Support

Your household data lives behind a standard, AEP-compliant REST API, which
makes it easy to work with from AI tools. Homestead gives you three ways in:

- **[`homestead resources`](#the-homestead-resources-cli)** — a CLI that
  discovers your schema and reads/writes data, ideal for an agent or for
  scripting.
- **[Chat](#chat)** — a built-in assistant that manages your data in plain
  language.
- **[An MCP server](#connecting-an-mcp-server)** — connect Claude or another
  MCP client to your instance.
- **[Agent skills](#agent-skills)** — drop-in skills that teach your coding
  agent how to scaffold apps, edit your schema, and stand up an instance.

---

## The `homestead resources` CLI

`homestead resources` is a self-describing client for your household's
data. It mints a short-lived admin token locally (by reading your
instance's database — no stored credentials needed) and talks to the
engine over its REST API. Run it on the box where Homestead is installed.

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

Because the command discovers the schema at runtime, it always reflects
the resources your apps actually declare — point an agent at it and it can
learn your whole API by running `homestead resources`.

### Useful flags

| Flag                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `--token=TOKEN`               | Use an existing bearer token instead of minting one.           |
| `--email=… --password=…`      | Authenticate with superuser credentials instead of minting.    |
| `--server-url=URL`            | Target a remote engine (default `http://127.0.0.1:<port>/api/aep`). |
| `--@data=PATH`                | Supply a JSON body from a file (for create or custom methods). |
| `--data-dir=PATH`             | Where the SQLite database lives (default `<project>/data`).    |

---

## Chat

Chat is a built-in assistant, powered by Gemini, that looks up and changes
your household data in plain language — "how much is left on my Visa gift
card?", "add milk to the grocery list", "what events are coming up?". It's
always installed; you'll find it in the top navigation.

Under the hood it's given a tool for every operation on every resource, so
it works with **any** app you've added — no per-app setup. It acts with
**your** permissions, confirms before deleting, and shows you which
actions it took.

### Enabling it

Chat needs a Gemini API key, set on the server as an environment variable:

```bash
# in your project's .env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a key from [Google AI Studio](https://makersuite.google.com/app/apikey).
The key stays server-side. Without it, the chat screen reports that the
assistant isn't configured; everything else in Homestead works as normal.
Conversations are not stored — each one lives only in the open tab.

---

## Connecting an MCP server

[MCP](https://modelcontextprotocol.io) lets AI clients like Claude call
external tools. Because your data is a standard AEP REST API, the
community [`aep-mcp-server`](https://github.com/aep-dev/aep-mcp-server) can
expose it to any MCP client — turning every resource into a tool the model
can call, the same way Chat works, but inside your AI client of choice.

The MCP server runs separately from Homestead (it isn't bundled). Point it
at your instance:

- **API URL** — your instance's engine, at the `/api/aep` prefix
  (e.g. `http://your-host:3000/api/aep`). The OpenAPI document is served at
  `/api/aep/openapi.json`.
- **Bearer token** — the API expects a bearer token. Obtain one by logging
  in with superuser credentials against the engine's login endpoint, the
  same way the SPA and `homestead resources --email … --password …` do.

Follow the `aep-mcp-server` README for its exact configuration, then add it
to your MCP client (such as Claude). From there the model can list, read,
and write your household resources directly.

---

## Agent skills

Homestead ships [`SKILL.md`](https://agentskills.io) skills —
packaged instructions that teach a coding agent to do common Homestead tasks
the right way. They live in the repo under `.claude/skills/`:

| Skill             | What it does                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `setup-homestead` | Stand up a new instance — scaffold, first boot, claim the admin account, install service. |
| `create-app`      | Scaffold a new feature app end-to-end — resources, hooks, components, config, e2e.        |
| `add-resource`    | Add or modify a resource definition (fields, enums, file fields, child resources).        |
| `add-widget`      | Add a dashboard widget to an existing app.                                                 |

`SKILL.md` is a cross-agent format — the same folder works in Claude Code,
Codex, and Gemini CLI. Copy the skills into your agent's directory (use
`~/...` for all projects, or the dotted form inside one project), then start
a fresh session. Each agent picks the matching skill from your request.

```bash
cp -R /path/to/homestead/.claude/skills/*  ~/.claude/skills/    # Claude Code
cp -R /path/to/homestead/.claude/skills/*  ~/.codex/skills/     # Codex
cp -R /path/to/homestead/.claude/skills/*  ~/.gemini/skills/    # Gemini CLI
```
