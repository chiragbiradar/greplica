# Agent Install Prompt

Paste this prompt into your coding agent from inside the repo you want Greplica to remember.

`````txt
Install Greplica for this repo.

Run:

```bash
npm install -g greplica
greplica install --platform <codex|claude|opencode> --embedding local
```

Use the platform matching this agent. Do not manually copy skills. After installation, summarize the installer output, including skills, embedding mode, whether hooks were installed, and whether I need to restart or trust hooks.

Before running install or bootstrap, ask me one question:
"Should I use the last five prior sessions for this same repo to create richer Greplica memory?"

Recommend yes, but do not read old transcripts deeply until I answer.

Then bootstrap shallow memory for this repo:
- Prefer using the `greplica-bootstrap` skill.
- If the skill is not visible until restart, read the installed `greplica-bootstrap/SKILL.md` file and follow it directly.
- Create, validate, and apply the bootstrap proposal.
- Keep bootstrap output brief: give a one-sentence summary of what this repo does and say baseline memory was applied.

If I opted into prior-session learning:
- Find the five most recent prior sessions for this same repo and platform.
- Candidate locations: Codex `~/.codex/sessions/**/*.jsonl`; Claude Code `~/.claude/projects/**/*.jsonl`.
- For OpenCode, tell me transcript backfill is not supported yet.
- Show me the five selected transcripts before bundling them: title if available, date/time, path, and why each matched this repo.
- Since I already opted in, continue without asking a second confirmation and run:

```bash
greplica transcript bundle --platform <codex-or-claude> --file <path-1> --file <path-2> --file <path-3> --file <path-4> --file <path-5> --out .greplica-transcript-backfill.md
```

- Then use the `greplica-fast-session-bootstrap` skill on `.greplica-transcript-backfill.md`.
- After apply, show exactly three compact, high-signal memories in this style:

```markdown
Applied transcript backfill to working memory: .greplica-transcript-backfill.md

Three useful things I learned from your previous sessions:

1. **<short title>**
   <specific stored memory>.
   Why it matters: <why this helps the next session>.
   Backed by: <session/code evidence>; connected to <component/flow>.
```

Then tell me how to use Greplica:
- Tell me that during work, the agent can use `greplica graph context "<question about the current task>"` to fetch relevant repo context, including prior working memory, before broad manual exploration.
- Tell me that near the end of a useful session, I should run "Use greplica-update-working-memory for this session." so decisions, changed flows, constraints, and follow-up work are stored.
- Tell me that OpenAI embeddings are also available later by rerunning `greplica install --platform <codex-or-claude-or-opencode> --embedding openai`.
- IMPORTANT: tell me that hooks and installed skills are the primary integration. Add a short AGENTS.md or CLAUDE.md instruction only if hooks are unavailable, not accepted, or I want extra repo-local guidance.
`````
