# LLP 0009: TestFlight feedback to verified pull request

**Type:** Design
**Status:** Draft
**Systems:** Expo App, EAS Workflows, Agent Development
**Author:** Keith Kurak / Claude Opus 5.5
**Date:** 2026-10-14
**Revised:** 2026-10-14 (shared session script, local skill, label trigger)
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

`agent-validate` label on a PR
  └─ expo-bot-verify.yml (pull_request_labeled trigger), same jobs as above

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

[observed] Comments use the account that owns the `GH_TOKEN` EAS
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

## The simulator session

[observed] `tools/agent/sim-session.sh` owns every EAS Simulator session:
start (with the build installed and launched), wait until live, read the
argent connection config, find the device udid, run argent tools, build
the evidence page, and stop. The CI agents call it through
`start_simulator_session` in `comment-lib.sh`, and the `eas-sim-dev` skill
calls it directly. Thus a local run and a CI run boot, drive, and record a
session the same way, and a fix to the session logic reaches both.

[observed] Evidence pages always come from `eas-simulator-evidence`
(github.com/jacobhammerle/eas-simulator-evidence), through
`sim-session.sh evidence`. That command passes `--name` and `--slug` from
`brand.config.js`, because `app.json` has neither, and lets the tool stop
the session: `eas simulator:stop` clears `.env.eas-simulator`, and the tool
reads the session id from that file.

## Local development

[observed] `.claude/skills/eas-sim-dev/SKILL.md` is the local loop: a
`development-simulator` dev-client build, Metro behind the account-signed
Expo tunnel (`EXPO_UNSTABLE_TUNNEL_V2=1 expo start --tunnel`), and a session
started with `--open-url exp+ecommerce-demo://expo-development-client/?url=<tunnel>`
so the dev client loads Metro at launch. Edits reach the cloud simulator by
Fast Refresh. It follows Mode C, Method 1 of the official Expo
`eas-simulator` skill. [confirmed — Keith Kurak, 2026-10-14] The tunnel is
the chosen transport for this loop.

[observed 2026-10-14] With the v2 tunnel, Metro's manifest gives an
`http://<id>.on.expo.app` launch asset, and the same host answers over
`https`. `sim-session.sh metro-url` prints the `https` form.

[confirmed — Keith Kurak, 2026-10-14] Local development uses one iOS
simulator per git worktree, and no Android sessions: this is a demo, and
more sessions add complexity without adding to it. Parallel work uses
parallel worktrees, each with its own `.env.eas-simulator`, Metro port, and
tunnel. `sim-session.sh start` refuses to start a second live session from
the same dotenv.

[observed] argent reads `ARGENT_TOOLS_URL` before `~/.argent/link.json`, so
`sim-session.sh argent` (which loads the worktree's dotenv on every call)
always reaches that worktree's session. [inferred] `sim-session.sh link`
uses `argent link`, which is global to the machine: while it is linked,
every argent client on that Mac without its own `ARGENT_TOOLS_URL`, in any
worktree, drives the linked device. The skill allows the MCP path only when
one worktree has a session, and unlinks in its cleanup step.

## Preview on both platforms

[observed] `.claude/skills/eas-sim-preview/SKILL.md` and `sim-session.sh
preview` open one `web-preview-only` session on iOS and one on Android, each
with its dev-client build (`development-simulator` for iOS, the
`development` APK for Android) and `--open-url` set to this worktree's
tunneled Metro. A person drives them in the browser; no agent controls them.
[confirmed — Keith Kurak, 2026-10-14] This is the one exception to "one iOS
simulator per worktree": previews have no controller, and their purpose is
to show a person both platforms.

[observed] `simulator:start --out-config-type env --json` writes no dotenv,
waits until the session is ready, and prints `id`, `deviceRunSessionUrl`,
and `remoteConfig.previewUrl` (eas-cli 24.13.0 source). So previews do not
touch an `eas-sim-dev` session's `.env.eas-simulator`. Each preview carries
the tag `preview-<worktree folder>`; `preview-list` and `preview-stop` find
the sessions with `simulator:list --tag`. `sim-session.sh metro-port` picks
only a Metro whose process runs from this worktree.

[inferred] Not yet run end to end: the Android `--open-url` with the
`exp+ecommerce-demo` scheme, and `--open-url` on a `web-preview-only`
session. eas-cli accepts `--open-url` for every session type.

## The Expo Agent CLI

[confirmed — Keith Kurak, 2026-10-15] Agents favor `npx @expo/agent-cli`
(github.com/expo/expo-agent-cli) for Expo commands, in a hybrid with the
session tooling above: agent-cli for `status`, `install`, `typecheck`,
`doctor`, `start`, and `runtime:reload | errors | tree`; `sim-session.sh`
and argent for the cloud session and screen-level driving. AGENTS.md
("Expo commands") holds the rule.

[observed — @expo/agent-cli 1.0.18 package source, 2026-10-15] Its EAS
commands start sessions with `--type agent-device`, and only that type is
"drivable": an argent session is reported as another type, not used. With
several live sessions in the Expo project it prefers the id in the
worktree's `.env.eas-simulator`, then the requested platform, then the
newest. So `--eas` would not see an `eas-sim-dev` session, and a worktree
without its own session could take another worktree's. The `--eas` flags
are therefore not used here.

[observed 2026-10-15] For this project, `dev --ios --plan` plans
`expo prebuild` plus a local `expo run:ios` build (rule `dev-client-stale`,
because Xcode is installed and no build is recorded), and it drops
`--tunnel` because the plan ends in `run:ios`. So the dev server for the
cloud loop is `EXPO_UNSTABLE_TUNNEL_V2=1 npx @expo/agent-cli start --
--tunnel --port <port>`, which gave an `https://<id>.on.expo.app` tunnel;
`runtime:errors` against it answered `NO_APP_CONNECTED` (exit 1) while no
app was connected. [inferred] `runtime:*` reaches a cloud app because it
talks to Metro's debugger, not to the device; not yet observed with a
connected cloud app.

[inferred] The CI agents keep `bun run typecheck` in their fixed tool
lists, so a CI run does not change with an agent-cli release.

## The agent-validate label

[observed] `expo-bot-verify.yml` also has a `pull_request_labeled` trigger
for the `agent-validate` label. The label path runs the same jobs as a
dispatch. Each job reads the PR number as
`inputs.pr_number || github.event.pull_request.number`. A label run has no
reviewer instruction, so the verify agent derives its checks from the diff.

[inferred] The label trigger needs the GitHub repository connected to the
EAS project, the `agent-validate` label in the repository, and the PR head
in the same repository (EAS does not run PR triggers for forks). To run the
check again, remove the label and add it again. The `@expo-bot review`
comment does the same through the bridge and does not need the connection.

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

## e2e bug bash

[observed] `e2e.config.ts` sets up e2e (TesterArmy, `e2e@0.21.0`,
`@e2e-dev/mobile@0.12.1`, `@e2e-dev/eas@0.3.1`) with one target, `ios`, on
EAS Simulators: `easSimulators({ buildId: E2E_BUILD_ID })` leases one hosted
simulator per worker and EAS installs the `development-simulator` dev-client
build. `app.launchArguments` carries `--initialUrl <E2E_METRO_URL>` plus the
expo-dev-menu flags, the form the e2e setup guide gives for an Expo
development build, so every fresh launch loads this worktree's tunneled
Metro. `e2e.bugbash.config.ts` adds the guide's exploration budgets
(`maxSteps`/`maxModelCalls` 40), the `skeptic` and `fuzzer` personas, and
Brooks context: email-only device-local sign-in, a Checkout button that
does nothing, no Health data on the simulator. The `e2e-bug-bash` skill wraps
`npx e2e guide bug-bash` with the Brooks steps.

[observed 2026-10-15] Both configs type-check with the app (`bun run
typecheck`) and load in `e2e list`, and the base config fails to load with a
message naming `E2E_BUILD_ID` and `E2E_METRO_URL` when either is missing.
The model is Anthropic through `ANTHROPIC_API_KEY` (`E2E_MODEL`, default
`claude-sonnet-5-5`); the guide's table says a Claude Max or Team plan needs
a Claude Console API key for this.

[inferred] Not yet run end to end: the `--initialUrl` launch on an EAS
simulator, the dev client loading a `--no-dev --minify` Metro, and several
`e2e explore` processes each leasing its own session from one target.

## Fork only

[confirmed — Keith Kurak, 2026-10-15] Pull requests, issues, and comments
go to the fork `keith-kurak/brooks-expo` only, never to the upstream
repository `SchroederNathan/brooks-expo`. [observed] The pipeline already
complies: every workflow sets `GH_REPO: keith-kurak/brooks-expo`, `gh.mjs`
calls the REST API for that repository, `fix-issue.sh` pushes to a clone of
it, and the bridge acts on `github.repository`. For people and local agents,
AGENTS.md ("Pull requests") names the repository on every `gh pr create`,
and this clone's `gh` default is the fork (`gh repo set-default`, stored in
`.git/config`, so all worktrees of this clone share it).

## Setup

These steps are outside the repository. [inferred] Until they are done, the
workflows fail at the first step that needs them.

1. Enable Issues on the GitHub repository. [observed 2026-10-14]
   `has_issues` is `false` on `keith-kurak/brooks-expo`.
2. Create the `testflight` and `agent-validate` labels. The `bug` and
   `enhancement` labels exist.
3. In the EAS project, connect App Store Connect (Settings → Connections),
   and keep the intake workflow files on the default branch.
4. Add EAS environment variables (secret, `production` environment):
   `EXPO_TOKEN_SIMULATOR` (a personal access token; EAS Simulator sessions
   are actor-gated), `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`)
   or `ANTHROPIC_API_KEY`, and `GH_TOKEN` (issues, contents, and pull
   requests write).
5. Add GitHub repository secrets for the bridge: `EXPO_TOKEN` and
   `CLAUDE_CODE_OAUTH_TOKEN`.
6. Connect the GitHub repository to the EAS project (project settings →
   GitHub) for the `agent-validate` label trigger. The deploy workflow's
   push trigger needs the same connection.
7. Test each stage by hand before relying on the trigger:
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
