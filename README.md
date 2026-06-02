# Greplica

Greplica (`greplica`) stores lightweight codebase memory for coding agents. The CLI provides small graph-memory primitives; agent workflows are provided as skills.

## Requirements

- Node.js and npm.
- Build tools needed by native npm packages such as `better-sqlite3`.
- An OpenAI API key for graph context search and proposal application.

## Agent Setup

Copy this prompt into the coding agent from the repository you want to use with Greplica:

````txt
Install Greplica for this repo.

Goal:
- Install the `greplica` CLI from the Greplica GitHub repo.
- Install the bundled Greplica skills into this coding agent's user-level skills directory.
- Verify the CLI can see this repo and can access OpenAI embeddings when configured.

Use this repo unless I provide a different URL or branch:

```txt
git@github.com:Autoloops/greplica.git
```

Do the install in the way that fits this environment. A typical CLI install flow is:

```bash
git clone --depth 1 git@github.com:Autoloops/greplica.git /tmp/greplica
npm install --prefix /tmp/greplica
npm run --prefix /tmp/greplica build
npm install -g /tmp/greplica
```

If `/tmp/greplica` already exists, update it or use a fresh temporary clone.

If global npm install is not allowed, use the agent's normal npm prefix/tool-install approach and make sure `greplica` is on PATH for future sessions. For an isolated npm prefix, use the equivalent of `npm install -g --prefix <prefix-dir> /tmp/greplica` and add `<prefix-dir>/bin` to PATH.

Install these two skill folders from the cloned repo:

```txt
/tmp/greplica/skills/greplica-bootstrap
/tmp/greplica/skills/greplica-update-working-memory
```

Use the native skill install location for the coding agent:

- Claude Code personal skills: `~/.claude/skills/<skill-name>/SKILL.md`
- Claude Code project skills, only if I ask for repo-local install: `.claude/skills/<skill-name>/SKILL.md`
- Codex personal skills: `${CODEX_HOME:-~/.codex}/skills/<skill-name>/SKILL.md`
- Other SKILL.md-compatible agents: use their user-level skill directory.

The installed directories should be named exactly:

```txt
greplica-bootstrap
greplica-update-working-memory
```

After installing skills, verify:

```bash
greplica doctor
greplica doctor --check-openai
```

If `greplica doctor --check-openai` reports that `OPENAI_API_KEY` is missing or invalid, stop and ask me to set it. Do not ask me to paste the key into chat. I can set it either in my shell before starting the coding agent, or in this repo's `.env.local` file:

```txt
OPENAI_API_KEY=...
```

After setup, tell me:
- where the CLI was installed
- where the two skills were installed
- whether I need to restart the coding agent for skills to appear
- how to invoke `greplica-bootstrap` and `greplica-update-working-memory`
````

## Using Greplica

After setup, invoke the skills by asking your coding agent to use them:

```txt
Use greplica-bootstrap for this repo.
```

```txt
Use greplica-update-working-memory for this session.
```

Run bootstrap once near the start of using Greplica in a repo. Run update working memory near the end of a coding session when the session contains durable decisions, changed flows, constraints, follow-up work, or useful implementation context.

## Configuration

`greplica` looks for `OPENAI_API_KEY` in this order:

1. the process environment
2. `<repo-root>/.env.local`
3. `<repo-root>/.env`

The key is never printed by `greplica doctor`.

Memory is stored in `~/.greplica/graph.db` by default. Set `GREPLICA_HOME` only for tests or advanced isolated runs.

## Commands

```bash
greplica doctor [--check-openai]
greplica graph read
greplica graph context "<query>"
greplica proposal validate <proposal.json>
greplica proposal apply <proposal.json>
```

`greplica` automatically prepares repo memory state when commands run, so users should not need a separate init step.

## Alpha Status

Greplica is ready for small-team dogfooding. The bootstrap flow is the most stable path. The update-working-memory flow validates and applies proposals, but memory quality still needs human review, especially for nuanced session rationale, future work, and superseding older claims.
