# Greplica

Greplica (`greplica`) stores lightweight codebase memory for coding agents. The CLI provides small graph-memory primitives; agent workflows are provided as skills.

Greplica normally stores the current Git repository's real remote URL and target root path. If the current directory is not inside a Git repository, Greplica stores memory against that folder path with no remote URL.

## Requirements

- Node.js and npm.
- Build tools needed by native npm packages such as `better-sqlite3`.
- An embedding provider for graph context search and proposal application. Local embeddings run in-process by default; OpenAI embeddings require `OPENAI_API_KEY` when configured.

## Agent Setup

Copy this prompt into the coding agent from the repository you want to use with Greplica:

`````txt
Install Greplica for this repo.

Goal:
- Install the `greplica` CLI from the Greplica GitHub repo.
- Install the bundled Greplica skills into this coding agent's user-level skills directory.
- Add Greplica usage guidance to the project instruction location this coding agent actually reads.
- Ask me whether to use local or OpenAI embeddings, then initialize Greplica with that choice.

Use this repo unless I provide a different URL or branch:

```txt
git@github.com:Autoloops/greplica.git
```

Do the install in the way that fits this environment. Prefer a persistent source checkout so future updates do not need a fresh clone:

```bash
GREPLICA_SRC="${GREPLICA_SRC:-$HOME/.greplica/src/greplica}"
if [ -d "$GREPLICA_SRC/.git" ]; then
  git -C "$GREPLICA_SRC" fetch --prune origin
  git -C "$GREPLICA_SRC" pull --ff-only
else
  mkdir -p "$(dirname "$GREPLICA_SRC")"
  git clone --depth 1 git@github.com:Autoloops/greplica.git "$GREPLICA_SRC"
fi
npm install --prefix "$GREPLICA_SRC"
npm install -g "$GREPLICA_SRC"
```

`npm install --prefix "$GREPLICA_SRC"` runs Greplica's build through the package `prepare` script, so do not run a separate build unless troubleshooting.

If global npm install is not allowed, use the agent's normal npm prefix/tool-install approach and make sure `greplica` is on PATH for future sessions. For an isolated npm prefix, use the equivalent of `npm install -g --prefix <prefix-dir> "$GREPLICA_SRC"` and add `<prefix-dir>/bin` to PATH.

Install these two skill folders from the cloned repo:

```txt
$GREPLICA_SRC/skills/greplica-bootstrap
$GREPLICA_SRC/skills/greplica-update-working-memory
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

Update this project's agent instruction location so future coding agents know how to use Greplica. Use the place this project and agent already use for durable agent guidance.

Common examples are `AGENTS.md` for Codex and `CLAUDE.md` for Claude Code, but do not assume either file is correct for every environment. If an instruction file already exists, update that file. If multiple relevant instruction files exist, update each one that future agents in this project are expected to read. If no instruction location is clear, ask me where to save the block before creating a new file.

Add or update this block:

````md
## Greplica

When `greplica` is available, use it before broad manual exploration:

```bash
greplica graph context "<natural-language question about the current task>"
```

Use the returned claims, components, flows, and code anchors to decide which files to inspect next. Treat Greplica as navigation and prior context, not final truth: verify implementation facts against current files and diffs before editing.

For large or unclear tasks, run 2-4 focused `greplica graph context` queries from different angles, such as the feature area, eval/test path, data model, and command/entrypoint. Avoid generic query spam.

Do not run `greplica doctor` as a routine preflight. Run the intended Greplica command directly; use `doctor` only after a command fails and the failure suggests installation, target detection, or embedding-provider diagnosis would help.
````

Before running Greplica init, ask me whether to use local embeddings or OpenAI embeddings.

Local is the default recommendation: it runs on this laptop without an API key and downloads the local embedding model into `~/.greplica/models`. OpenAI may be faster or higher quality, but requires `OPENAI_API_KEY`.

If I choose local, use the default local config and initialize memory without pre-downloading the embedding model:

```bash
greplica graph read >/dev/null
```

Do not run `greplica init --local` during setup unless I explicitly ask to pre-warm local embeddings. `greplica init --local` checks local embeddings and may download the model immediately; otherwise the model downloads on first `greplica graph context` or proposal apply.

If I choose OpenAI, verify `OPENAI_API_KEY` is available in the environment, the target root's `.env.local`, or the target root's `.env`, then run:

```bash
greplica init --openai
```

If OpenAI is selected and `OPENAI_API_KEY` is missing or invalid, stop and ask me to set it. Do not ask me to paste the key into chat. I can set it either in my shell before starting the coding agent, or in the target root's `.env.local` file:

```txt
OPENAI_API_KEY=...
```

After setup, tell me:
- where the Greplica source checkout is
- where the CLI was installed
- where the two skills were installed
- which project instruction file or location was updated
- which embedding mode was selected
- where the Greplica config file is
- whether I need to restart the coding agent for skills to appear
- how to invoke `greplica-bootstrap` and `greplica-update-working-memory`
`````

## Using Greplica

After setup, invoke the skills by asking your coding agent to use them:

```txt
Use greplica-bootstrap for this repo.
```

```txt
Use greplica-update-working-memory for this session.
```

Run bootstrap once near the start of using Greplica in a repo. Run update working memory near the end of a coding session when the session contains durable decisions, changed flows, constraints, follow-up work, or useful implementation context.

Do not run `greplica doctor` before normal Greplica commands. Use the intended command directly, such as `greplica graph context "<query>"`; if it fails, use the error message to decide whether `doctor` would help diagnose installation, target detection, or embedding-provider configuration.

## Updating Greplica

If Greplica was installed from a persistent source checkout, update it with:

```bash
GREPLICA_SRC="${GREPLICA_SRC:-$HOME/.greplica/src/greplica}"
before="$(git -C "$GREPLICA_SRC" rev-parse HEAD)"
git -C "$GREPLICA_SRC" pull --ff-only --prune
after="$(git -C "$GREPLICA_SRC" rev-parse HEAD)"

if [ "$before" != "$after" ]; then
  npm install --prefix "$GREPLICA_SRC"
  npm install -g "$GREPLICA_SRC"
fi
```

If the checkout changed, copy the two skill folders from `$GREPLICA_SRC/skills/` over the installed skill folders again so agent instructions stay current.

Current source-install benchmark on this machine:

- Fresh documented clone/install/build/global-install flow: about 9.7s.
- Fresh persistent-checkout flow without the redundant explicit build: about 9.0s.
- Full cold start after deleting `~/.greplica`, with local embedding pre-warm via `greplica init --local`: about 38.9s.
- Optimized local cold start without pre-warming embeddings: about 7.6s; first graph-context query pays the local model download later.
- No-op update with unconditional reinstall: about 9.2s.
- No-op update with the conditional reinstall command above: about 2.9s.
- Direct `npm install -g git+ssh://...` is not reliable yet because the git dependency prepare step can fail before `tsc` is available.

The better long-term install path is to publish or attach a built package artifact that already contains `dist/`, `skills/`, and `README.md`. Then install/update can become a single `npm install -g <package-or-tarball>` command without cloning the repo or compiling TypeScript during user setup.

## Configuration

`greplica` stores default CLI config at `~/.greplica/config.json`:

```json
{
  "version": 1,
  "embedding": {
    "provider": "local",
    "model": "all-mpnet-base-v2",
    "dimensions": 768,
    "batchSize": 16
  }
}
```

Print the config path, current JSON, allowed providers, and common examples:

```bash
greplica config
```

Edit the printed JSON file directly to change the selected embedding provider, model, dimensions, or batch size. For example:

```json
{
  "version": 1,
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "batchSize": 100
  }
}
```

Allowed `embedding.provider` values are `local` and `openai`.

`greplica init --local` and `greplica init --openai` also update the same config file to provider defaults while initializing memory for the current repo or folder and checking that the selected embedding provider is ready.

Local embeddings run in-process with a quantized Hugging Face Transformers model and cache model files under `~/.greplica/models`. The first `greplica init --local` or local embedding check downloads the configured model; subsequent runs reuse the cache.

Useful local model choices:

- `all-mpnet-base-v2`, 768 dimensions, default local model.
- `all-MiniLM-L6-v2`, 384 dimensions, smaller local option.

`greplica` looks for `OPENAI_API_KEY` in this order:

1. the process environment
2. `<target-root>/.env.local`
3. `<target-root>/.env`

The key is never printed by `greplica doctor`.

Memory is stored in `~/.greplica/graph.db` by default. Set `GREPLICA_HOME` only for tests or advanced isolated runs.

## Commands

```bash
greplica init [--local|--openai]
greplica config
greplica doctor [--check-embeddings]
greplica graph read
greplica graph context "<query>" [--json|--debug]
greplica proposal validate <proposal.json>
greplica proposal apply <proposal.json>
```

`greplica graph context "<query>"` prints concise Markdown for coding-agent use. Use `--json` for compact structured output, or `--debug` for the full retrieval payload with ranking signals and embedding status.

`greplica` automatically prepares memory state when commands run, so users should not need a separate init step.

`greplica doctor` is for install verification and diagnosing failures, not a required preflight before every Greplica command.

## Alpha Status

Greplica is ready for small-team dogfooding. The bootstrap flow is the most stable path. The update-working-memory flow validates and applies proposals, but memory quality still needs human review, especially for nuanced session rationale, future work, and superseding older claims.
