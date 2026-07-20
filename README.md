# claude-kiro

A [Claude Code](https://claude.com/claude-code) skill that automates the
"Claude plans, [Kiro](https://kiro.dev) codes" handoff: instead of manually
copy-pasting a prompt into an interactive Kiro CLI session and pasting the
diff back, Claude drafts the prompt, spawns Kiro headlessly in an isolated
subagent (a *fork*), and only brings back a condensed pass/fail + diff report
— Kiro's raw, noisy transcript never enters Claude's context.

## What it does

1. Claude drafts a self-contained coding prompt (files, requirements,
   constraints, acceptance criteria) — same as it would for a human coder.
2. On the first Kiro spawn in a session, Claude asks for confirmation and
   offers to trust Kiro for the rest of that session (so later tasks don't
   re-prompt). This trust is conversation-scoped only — it is never written
   to disk and resets on every new session.
3. Claude spawns a forked subagent that runs:
   ```
   kiro-cli chat --no-interactive "<prompt>" --trust-all-tools
   ```
   waits for it to exit, then captures `git status` / `git diff` in the
   target directory.
4. The fork reports back ONLY pass/fail + the diff (+ a short log tail on
   failure) — never the full raw Kiro transcript.
5. Claude reviews the diff before calling the task done, same as it would
   review a human's PR.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) CLI.
- [`kiro-cli`](https://kiro.dev) installed and on `PATH` (tested against
  `kiro-cli 2.13.0`).
- A git repo to run tasks against (the skill's fork step runs `git status`/
  `git diff` to capture Kiro's changes).

## Install

Skills live under a `.claude/skills/` directory, either globally for your
user or per-project.

**Quick install (global, no npm publish needed):**
```bash
npx github:eggysetiawan/claude-kiro
```

**Project-scoped** (only active in the current repo — run from the project root):
```bash
npx github:eggysetiawan/claude-kiro --project
```

**Manual (no npx):**
```bash
git clone https://github.com/eggysetiawan/claude-kiro.git /tmp/claude-kiro
mkdir -p ~/.claude/skills                       # or /path/to/project/.claude/skills
cp -r /tmp/claude-kiro/kiro-handoff ~/.claude/skills/kiro-handoff
```

Restart Claude Code (or start a new session) so it picks up the new skill.

## Usage

Invoke it explicitly:
```
/kiro-handoff
```
or just describe a coding task the way you normally would — Claude Code
matches skills by description and will pull this one in on its own when a
task fits (a well-specified coding change that would otherwise go through a
manual Kiro handoff).

The first time in a session that Claude wants to spawn Kiro, it will show
you the drafted prompt and target directory and ask:
- run once (ask again next time), or
- run once and trust Kiro for the rest of this session.

**Important trust caveat:** `kiro-cli --trust-all-tools` auto-approves
*every* tool call Kiro makes — not just file writes, but shell commands and
any other resource-changing action it has tools for. Don't grant session
trust for tasks touching production systems, destructive operations, or
credentials with broad permissions. See Kiro's own docs on this flag:
https://kiro.dev/docs/cli/chat/security/#using-tools-trust-all-safely

## Customizing for your project

`kiro-handoff/SKILL.md` references a couple of project-specific things you
should adapt:
- A repo-level convention doc (in the original project, `CLAUDE.md`) that
  defines the Claude=planner / Kiro=coder working model and a service map
  for multi-service monorepos.
- A post-diff review checklist (in the original project, a table of Go
  code-review skills). Swap in whatever review steps make sense for your
  stack.

If your project doesn't have either, just delete those references from
Step 1 and Step 3 of the skill — the fork-spawn mechanics (Steps 0 and 2)
work standalone.
