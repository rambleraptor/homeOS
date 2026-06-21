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

Chat is a built-in assistant, powered by Gemini, that looks up and changes
your household data in plain language — "how much is left on my Visa gift
card?", "add milk to the grocery list", "what events are coming up?". It's
always installed; find it in the top navigation.

Chat works with **any** app you've added, with no per-app setup. It acts
with **your** permissions, confirms before deleting, and shows you which
actions it took. Conversations are not stored — each one lives only in the
open tab.

### Enable Chat

Chat needs a Gemini API key. Get one from
[Google AI Studio](https://makersuite.google.com/app/apikey), then set it on
the server in your project's `.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Restart the server. The Chat screen now answers questions instead of
reporting that the assistant isn't configured.

Without a key, the rest of Homestead works as normal. The key stays
server-side.

---

## Connect an MCP client

The community
[`aep-mcp-server`](https://github.com/aep-dev/aep-mcp-server) exposes your
data to any [MCP](https://modelcontextprotocol.io) client, such as Claude.
Every resource becomes a tool the model can call. The MCP server runs
separately from Homestead.

Point it at your instance with two values:

- **API URL** — your instance's engine, at the `/api/aep` prefix
  (e.g. `http://your-host:3000/api/aep`). The OpenAPI document is at
  `/api/aep/openapi.json`.
- **Bearer token** — get one by logging in with your superuser credentials
  against the engine's login endpoint, the same way
  `homestead resources --email … --password …` does.

Follow the `aep-mcp-server` README to configure it, then add it to your MCP
client. The model can then list, read, and write your household resources.

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
