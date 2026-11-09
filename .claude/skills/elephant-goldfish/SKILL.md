---
name: elephant-goldfish
description: Design-then-review workflow (Elephant Goldfish Model). The main session (elephant) writes a self-contained design doc, then six goldfish-reviewer subagents with zero context review it in parallel. Use when the user says "elephant goldfish", "EGM", "design review", or before implementing a large feature, architecture change, migration, or cross-repo change. Skip for bug fixes and small changes.
---

# Elephant Goldfish

The elephant holds the full context and writes the design. The goldfish remember nothing: they see only the doc. Whatever a goldfish cannot understand from the doc alone is a gap in the doc.

## When to skip

Bug fixes, small tweaks, and single-file changes. Use the normal workflow for those: this cycle costs time and tokens.

## Steps

1. **Clarify.** Ask questions (AskUserQuestion) until the goal, scope, constraints, and non-goals are clear.
2. **Write the doc** at `docs/design/<YYYY-MM-DD>-<slug>.md`, using the template below.
   - Write it in full, plain prose. Never compress it (no caveman style, no `/caveman-compress`). The review tests whether the doc stands on its own, and compressed wording creates false findings.
   - Name real file paths, endpoints, tables, and env vars. Do not rely on anything said only in chat.
3. **Dispatch six goldfish** in a single message so they run in parallel, using `subagent_type: "goldfish-reviewer"`.
   - Never use `fork`: a fork inherits the conversation and stops being a goldfish.
   - The prompt contains only the doc path and the lens. Never explain or defend the design in the prompt.
   - Prompt shape: `Review <path>. Lens: <lens>. You may read the codebase to verify claims the doc makes.`
4. **Triage** the findings. Merge duplicates, then classify each one:
   - **Wording gap**: the design is right but the doc does not say it. Fix the doc.
   - **Design gap**: a real problem. Change the design.
   - **Rejected**: state why in one sentence.
5. **Update the doc** and append a `## Review log` section listing each finding and its decision.
6. **Second round (optional).** If there were blockers, send the updated doc to 2-3 fresh goldfish on the lenses that had them.
7. **Hand off.** Show the user a short summary (doc path, blockers fixed, open questions) and wait for approval before implementing.

## Lenses

| # | Lens | Looks for |
|---|------|-----------|
| 1 | Correctness | Edge cases, race conditions, failure paths, idempotency |
| 2 | Security | Authn/authz, input validation, secrets, data exposure |
| 3 | Data | Schema changes, migrations, backfills, consistency, rollback of data |
| 4 | Performance and cost | Queries, N+1, caching, external API quotas, infra cost |
| 5 | Product and UX | User flows, empty/error states, copy, admin ergonomics |
| 6 | Operations | Rollout, feature flags, observability, alerts, rollback plan |

Swap a lens for a more relevant one when the change calls for it (for example payments, cross-repo contracts, or SEO).

## Doc template

```markdown
# <Title>

Date: <YYYY-MM-DD> · Repos: <repos touched> · Status: draft | reviewed | approved

## Context
Why this is needed now. Link to issues or prior docs.

## Goals
## Non-goals

## Current state
How it works today, with file paths.

## Proposed design
Components, flows, and responsibilities. Diagrams in Mermaid if useful.

## Data and API changes
Schemas, migrations, endpoints, payloads, env vars.

## Rollout and rollback
Order of deploys across repos, flags, how to undo.

## Risks
## Open questions

## Review log
(filled after review)
```
