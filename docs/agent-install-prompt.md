# Agent Install Prompt

`````txt
Install Greplica for this repo.

Run:

```bash
npm install -g greplica
greplica install --platform <codex|claude|opencode> --embedding local
```

Use the platform matching this agent. Do not manually copy skills. After installation, summarize the installer output, including skills, embedding mode, whether hooks were installed, and whether I need to restart or trust hooks.

Before running any command, ask me one question:
"Allow Greplica to learn from your past sessions to show what it can learn?"

Recommend yes, but do not read old transcripts deeply until I answer.

After I answer, run the install commands above, then bootstrap shallow memory for this repo:
- Prefer using the `greplica-bootstrap` skill.
- If the skill is not visible until restart, read the installed `greplica-bootstrap/SKILL.md` file and follow it directly.
- Create, validate, and apply the bootstrap proposal.
- Keep bootstrap output brief: give a one-sentence summary of what this repo does and say baseline memory was applied.

If I opted into prior-session learning:
- Find recent prior sessions for this same repo and platform, preferring work from the last 1-2 days.
- Candidate locations: Codex `~/.codex/sessions/**/*.jsonl`; Claude Code `~/.claude/projects/**/*.jsonl`.
- For OpenCode, tell me transcript backfill is not supported yet.
- Select 1-3 transcripts. Use one if there is a large high-signal session, two by default when multiple sessions are useful, and three only when sessions are smaller or cover distinct work.
- Since I already opted in, continue without asking a second confirmation and run:

```bash
greplica transcript bundle --platform <codex-or-claude> --file <path-1> [--file <path-2>] [--file <path-3>] --out <greplica-transcript-backfill.md>
```

- Then use the `greplica-fast-session-bootstrap` skill on `<greplica-transcript-backfill.md>`.
- After apply, show one important flow/component Greplica can now reconstruct without broad grepping. Include the optional correction section only if there is a strong repo-specific user correction or risk/gotcha:

```markdown
Applied transcript backfill to working memory.

What I can now reconstruct without grepping

**<flow or component name>**
- <specific workflow/component fact Greplica stored>
- <specific constraint, decision, or edge in the flow>

Stored in my graph. Next time your agent will ask `greplica graph context "<topic>"`; no grep reconstruction needed.

One correction I will remember

<Only include this section if there is a strong user correction tied to a repo-specific risk/gotcha. Explain what the agent would otherwise get wrong and what will be considered next time.>
```

Then tell me how to use Greplica:
- IMPORTANT: tell me that hooks and installed skills are the primary integration. Add a short AGENTS.md or CLAUDE.md instruction only if hooks are unavailable, not accepted, or I want extra repo-local guidance.
`````
