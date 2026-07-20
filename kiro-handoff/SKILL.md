---
name: kiro-handoff
description: "Auto-spawn Kiro CLI headlessly (via a fork) to execute a coding task instead of the manual copy-paste handoff. Use whenever a task in this repo would normally go 'Claude drafts prompt -> user pastes into Kiro -> user brings back diff' per wpe/CLAUDE.md's Claude=planner/Kiro=coder model. Handles the session-scoped trust gate, the fork isolation so Kiro's raw output never enters main context, and the post-review checklist."
---

# /kiro-handoff

Runs the Claude(planner) + Kiro(coder) workflow described in `wpe/CLAUDE.md` without
the user manually pasting prompts into a separate CLI. Claude still drafts the prompt
and still reviews the diff — only the "paste it, wait, paste the result back" middle
step is automated, via a `fork` that isolates Kiro's noisy raw output from the main
conversation.

## When to use this

Any task in this repo that would normally follow the manual Kiro handoff in
`wpe/CLAUDE.md`: a bug fix, a feature change, anything where Claude drafts a
self-contained prompt for Kiro rather than writing the code itself.

Do NOT use this for tasks the user has said to keep manual (they may still want to
paste into interactive Kiro themselves for exploratory/ambiguous work — this skill is
for well-specified, fork-able tasks).

## Step 0 — session trust gate (ask exactly once per session)

`kiro-cli` must run with `--trust-all-tools` to work headlessly (see "Why
--trust-all-tools is required" below) and that flag auto-approves **every** tool call
Kiro makes — not just file writes, but shell commands and any resource-modifying
action it has tools for (confirmed via Kiro's own security docs, checked 2026-07-20).

- **First Kiro spawn in a session**: show the user the drafted prompt and the target
  repo/directory, and ask for explicit go-ahead. Offer these choices:
  1. Run this once (confirm again next time)
  2. Run this once and trust Kiro for the rest of this session (no more asking)
- If the user picks (2), remember that for the rest of the *conversation* only — this
  is not written to memory/disk, it resets next session. Every new session starts back
  at "ask the first time."
- **Every subsequent spawn in the same session**: if the user granted session trust,
  spawn directly, no confirmation. If they didn't, ask again per-task (their choice
  from item 2 in the original design discussion — default to asking every time unless
  they explicitly grant session trust).
- Never grant session trust unprompted, and never carry "trust this session" across
  a `/clear` or new conversation — treat those as a new session.

## Step 1 — Claude drafts the Kiro prompt (main context, as today)

Same as the manual flow: a self-contained prompt with affected files, requirements,
constraints, and acceptance criteria. This still requires Claude's judgment and stays
in the main conversation — nothing about this step changes.

Paste the prompt **as literal content** in the fork directive below — per
[[feedback_kiro_prompt_delivery]], Kiro cannot read a Claude scratchpad file path, so
never hand the fork "read /path/to/prompt.md and use that as the prompt."

## Step 2 — spawn a fork to run Kiro and capture the result

Use `Agent` with `subagent_type: "fork"`. The fork prompt must tell it to:

1. `cd` into the correct service directory (see the service map in `wpe/CLAUDE.md` —
   e.g. `zurich/`, `wpe-milan/`, etc.). Get this wrong and Kiro edits the wrong repo.
2. Run:
   ```
   kiro-cli chat --no-interactive "<the full Kiro prompt, inlined verbatim>" --trust-all-tools
   ```
   (never add `--v3` — it's mutually exclusive with `--trust-all-tools` and errors out)
3. Wait for the process to exit (it exits on its own when done — no polling needed,
   typically 10s-a few minutes depending on task size).
4. Run `git status` and `git diff` in that directory.
5. Report back ONLY:
   - pass/fail (did Kiro make the expected changes, did it report any tool denial —
     denials shouldn't happen with `--trust-all-tools` but check anyway)
   - the full `git diff` output
   - if it failed: a short tail of Kiro's chat output (strip ANSI escapes first, e.g.
     `... | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g'` or `grep -a`), not the full transcript

Never let the fork's full raw Kiro transcript come back to main context — that
defeats the entire point of this integration. If the fork's report includes a huge
pasted log, that's a fork-prompt mistake to fix, not something to just accept.

## Step 3 — review, same as the manual flow

Once the fork reports back with the diff, review it exactly as `wpe/CLAUDE.md`
prescribes: run `/code-review` plus whichever Golang skills from the checklist table
apply (`golang-security`, `golang-safety`, `golang-naming`, etc.) before telling the
user it's ready to ship. The fork automated the handoff, not the review — Claude
still signs off on correctness, style, and security.

## Known constraints (validated 2026-07-20, see [[project_kiro_headless_integration]])

- `--trust-all-tools` and `--v3` cannot be combined.
- Without `--trust-all-tools`, in `--no-interactive` mode every tool call is
  auto-denied (Kiro reports this in its own output, exits 0, doesn't hang) — this is a
  safe way to sanity-check the prompt/CLI mechanics without granting any trust, if
  ever needed.
- `--trust-all-tools` risk scope is broad per Kiro's docs: covers file
  writes/deletes, shell/system modifications, and any other resource-changing tool
  call, not just files. Never point this at a production environment or a task
  involving destructive/irreversible operations without extra scrutiny — those still
  warrant asking the user even under session trust.
- Raw stdout is full of ANSI escape codes; strip them before treating any substring
  as a success/fail marker.
