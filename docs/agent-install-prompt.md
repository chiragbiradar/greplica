# Agent Install Prompt

`````txt
Install Greplica for this repo.

Run:

```bash
npm install -g greplica
greplica install --platform <codex|claude|opencode> --embedding local
```

Use the platform matching this agent. Do not manually copy skills. After installation, do not echo the full installer output or repeat its next steps.

Before running any command, ask me one question:
"Allow Greplica to analyze previous sessions to remember the context your agent usually forgets?"

Recommend yes, but do not read old transcripts deeply until I answer.

After I answer, run the install commands above, then bootstrap shallow memory for this repo:
- Prefer using the `greplica-bootstrap` skill.
- If the skill is not visible until restart, read the installed `greplica-bootstrap/SKILL.md` file and follow it directly.
- Create, validate, and apply the bootstrap proposal.
- Keep bootstrap output for the final answer to one line: `Greplica is installed and baseline memory was applied.`

If I opted into prior-session learning:
- Find recent prior sessions for this same repo and platform, preferring work from the last 1-2 days.
- Candidate locations: Codex `~/.codex/sessions/**/*.jsonl`; Claude Code `~/.claude/projects/**/*.jsonl`.
- Do not require transcript metadata `cwd` to equal the current checkout path. Users may use worktrees, renamed folders, or multiple checkouts of the same repo.
- Treat a transcript as same-repo when its metadata `cwd` is the current path, or when that `cwd` still exists and Git reports the same `remote.origin.url` or same normalized repo identity as the current repo. If the old path no longer exists, use transcript cwd text, repo name, branch, and recent session content as weaker matching evidence.
- For OpenCode, tell me transcript backfill is not supported yet.
- Select 1-3 transcripts. Use one if there is a large high-signal session, two by default when multiple sessions are useful, and three only when sessions are smaller or cover distinct work.
- Show me the selected transcripts before bundling them: title if available, date/time, path, size/turn count if available, and why each matched this repo.
- Since I already opted in, continue without asking a second confirmation and run this with a temporary bundle path:

```bash
greplica transcript bundle --platform <codex-or-claude> --file <path-1> [--file <path-2>] [--file <path-3>] --out <greplica-transcript-backfill.md>
```

- Then use the `greplica-fast-session-bootstrap` skill on `<greplica-transcript-backfill.md>`.
- After apply, preserve this transcript-backfill value section in the final answer. Include the optional correction section only if there is a strong repo-specific user correction or risk/gotcha:

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

Final answer rules:
- Start with exactly: `Greplica is installed and baseline memory was applied.`
- If transcript backfill ran, include the transcript-backfill value section above unchanged.
- End with exactly: `Hooks and installed skills are active; restart/trust hooks only if prompted.`
- Do not include installer output, selected transcript recap, proposal paths, apply counts, command lists, bundle paths, or a long usage guide unless I ask.
`````
