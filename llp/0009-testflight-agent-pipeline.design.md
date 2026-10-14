# LLP 0009: TestFlight feedback to verified pull request

**Type:** Design
**Status:** Draft
**Systems:** Expo App, EAS Workflows, Agent Development
**Author:** Keith Kurak / Claude Opus 5.5
**Date:** 2026-10-14
**Related:** [LLP 0000](./0000-brooks.explainer.md),
[jacobhammerle/employee-onboarding](https://github.com/jacobhammerle/employee-onboarding)

## Summary

A TestFlight tester sends a screenshot with a comment, or the app crashes.
Without a person in the loop, the pipeline files a GitHub issue, reproduces
the report on an EAS cloud simulator, writes a fix, opens a pull request,
reviews it, and checks the fix on a second cloud simulator. Every step posts
its result and screenshot evidence on the issue or the PR. A person reads
the PR and decides whether to merge it.

## Where it came from

[observed] The design is a port of the pipeline in
`jacobhammerle/employee-onboarding`. That repository's issue #112 and PR #113
(2026-09-22) show one run: the tester's submission at 14:20 UTC, the issue
at 14:21, the PR at 14:33, and the verification verdict at 14:41. The scripts
keep upstream's shape, its comment layout, and most of its comments, because
each upstream comment records a failure that was seen in a real run.

## The pipeline

```text
App Store Connect beta_feedback (screenshot | crash)
  └─ testflight-feedback.yml / testflight-crash.yml
       tools/agent/intake-testflight.{sh,mjs}
       fetch → Claude triage (bug | feature | duplicate) → GitHub issue
       └─ eas workflow:run expo-bot-issue.yml
            fingerprint → get-build (simulator profile) → repack | build
            tools/agent/validate-issue.sh
              EAS Simulator (argent) → Claude replicates → evidence site
              REPLICATED | CONFIRMED → tools/agent/fix-issue.sh
                 Claude edits → type check → push expo-bot/issue-N → PR
                 └─ eas workflow:run expo-bot-verify.yml
                      tools/agent/review-pr.sh  (code review comment)
                      tools/agent/verify-on-simulator.sh
                        EAS Simulator → Claude tests the PR → verdict comment
              NOT-REPLICATED | INCONCLUSIVE → reasoning on the issue

"@expo-bot" comment by an owner, member, or collaborator
  └─ .github/workflows/expo-bot-bridge.yml
       on an issue → expo-bot-issue.yml
       on a PR     → apply-change.sh (change modes) and/or expo-bot-verify.yml
```

[inferred] Each agent writes its result to a file with a fixed format (a
verdict line, then a report). The shell script reads that file and ignores
Claude's exit code. Thus a crash, a timeout, or a turn limit always gives a
known result: INCONCLUSIVE for triage, FAIL for verification, no PR for a
fix. A `trap` posts an error comment if a script exits before its result
comment, so no issue or PR stays without a reply.

[observed] Comments use the account that owns the `GITHUB_TOKEN` EAS
environment variable, because `tools/agent/gh.mjs` calls the GitHub REST API
with it. The bridge's acknowledgement comments use `github-actions[bot]`.
Every bot comment starts with `## 🤖`. `gh.mjs get-issue` removes those
comments from the issue context, so a new triage does not read the bot's
earlier output as evidence. Keep the prefix.

## The gates

- [observed] The fix agent and the change agent can run only
  `bun run typecheck` and `bun run test:<suite>`. After the agent stops, the
  script runs `bun run typecheck` again and pushes nothing if it fails.
  Brooks has no ESLint setup, so upstream's `expo lint` gate is not used.
- [observed] The fix agent cannot run `bun run sync`. A fix that needs a
  catalog data change becomes a "No fix" with a reason, because
  `packages/catalog` is the source of truth and its copies are generated.
- [inferred] The replication and verification agents can only run
  `bash tools/agent/argent.sh run …`, Read, Glob, Grep, and Write. They
  cannot change project files.
- [observed] Upstream PR #113 shows a gap: the code review said "Needs
  changes" because taps on empty space might not register, and the
  verification then passed after it tapped a text element. The verify
  prompt here tells the agent to test empty space when the PR is about
  empty space. The review result is still not an input to verification.

## The simulator binary

[observed] Both agent workflows find a completed iOS build of the
`simulator` profile with the same fingerprint, and `repack` it with the
branch's JavaScript. They build a new binary only when the native layer
changed. The `simulator` profile sets `environment: preview` so that the
`fingerprint` job (which runs in `preview`) and the build compute the same
hash. It sets `channel: simulator`, and nothing publishes to that channel, so
no downloaded update replaces the repacked bundle.

[inferred] The first run after this change builds a new simulator binary,
because no existing build has the `simulator` channel and the `preview`
environment. Later runs repack it.

## Security

[observed] `keith-kurak/brooks-expo` is a public repository. The bridge runs
only for comments by an owner, member, or collaborator, and it refuses PRs
whose head is a fork. Both checks stop a stranger from running agents with
this project's secrets. The EAS workflows have no GitHub trigger; only a
holder of an Expo token can start them.

[inferred] Issues, PR bodies, and tester comments are untrusted input to the
agents. The tool allowlists above limit what a prompt injection can do: the
agents that read device state cannot edit files, and the agents that edit
files cannot run arbitrary shell commands or push.

## Setup

These steps are outside the repository. [inferred] Until they are done, the
workflows fail at the first step that needs them.

1. Enable Issues on the GitHub repository. [observed 2026-10-14]
   `has_issues` is `false` on `keith-kurak/brooks-expo`.
2. Create a `testflight` label. The `bug` and `enhancement` labels exist.
3. In the EAS project, connect App Store Connect (Settings → Connections),
   and keep the intake workflow files on the default branch.
4. Add EAS environment variables (secret, `production` environment):
   `EXPO_TOKEN_SIMULATOR` (a personal access token; EAS Simulator sessions
   are actor-gated), `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`)
   or `ANTHROPIC_API_KEY`, and `GITHUB_TOKEN` (issues, contents, and pull
   requests write).
5. Add GitHub repository secrets for the bridge: `EXPO_TOKEN` and
   `CLAUDE_CODE_OAUTH_TOKEN`.
6. Test each stage by hand before relying on the trigger:
   `eas workflow:run expo-bot-issue.yml -F issue_number=<N>`, then
   `eas workflow:run testflight-feedback.yml`.

## Not ported

- [observed] Upstream publishes each PR's JavaScript to a `pr-N` update
  channel and lets testers switch to it from an Admin tab. Brooks has no
  channel switcher, so that job is left out.
- [observed] Upstream's `@expo-bot preview` and `@expo-bot swarm` modes
  depend on other workflows (live preview sessions, a five-device QA swarm)
  and are left out.
- [observed] Verification runs on iOS only, as upstream does. Android
  reports are triaged on iOS.

## Open questions

- [inferred] Should verification wait for the code review and treat each
  risk it names as an acceptance criterion?
- [inferred] The scripts run `@anthropic-ai/claude-code@latest` and
  `eas-cli@latest`. Pinning them would make runs reproducible, at the cost
  of manual upgrades.
