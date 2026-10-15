---
name: e2e-bug-bash
description: Run an e2e (TesterArmy) bug bash on Brooks from this machine - several `e2e explore` explorers in parallel, each on its own EAS cloud iOS simulator running the dev-client build connected to this worktree's tunneled Metro, then a repro test for every claimed bug. Use when asked to "bug bash", "QA the app", "hunt for bugs", or "explore this branch for bugs", or to write and run e2e tests in e2e/.
---

# Bug bash on EAS Simulators

The procedure is the e2e package's own guide. Read it first, every time; it
is versioned with the installed package:

```bash
npx e2e guide bug-bash     # prepare, charters, fan out, merge, triage, verify, report
npx e2e guide explore      # one explore run: budgets, verdict, report
npx e2e guide writing-tests
```

This skill adds only what is specific to Brooks. Docs:
https://e2e.tester.army/docs/bug-bash

> **Costs apply twice.** Every `e2e explore` run leases its own EAS
> Simulator session (billed until it stops), and every step makes model
> calls. Four explorers at a time are four sessions. Each run's log prints
> its AI cost and duration.

## Files

| File | What it is |
| --- | --- |
| `e2e.config.ts` | Base config: target `ios` on EAS Simulators (`@e2e-dev/eas`), the dev-client build from `E2E_BUILD_ID`, every launch opening `E2E_METRO_URL`; model from `E2E_MODEL` through `ANTHROPIC_API_KEY` |
| `e2e.bugbash.config.ts` | Bug-bash overrides: 40-step budgets, the `default`, `skeptic`, and `fuzzer` personas, and the Brooks context that keeps explorers from reporting the demo's intended limits |
| `e2e/*.e2e.ts` | Tests; `e2e/smoke.e2e.ts` checks the setup |
| `e2e/bugbash/*.e2e.ts` | Repro tests the verify step writes, tagged `bugbash` |
| `.e2e/` | Run output and explorer runs (gitignored) |

## 1. Prepare (Brooks)

```bash
npx --yes eas-cli@latest whoami                       # EAS login, or EXPO_TOKEN set
[ -n "$ANTHROPIC_API_KEY" ] && echo set || echo "set ANTHROPIC_API_KEY first"
export E2E_BUILD_ID=$(bash tools/agent/sim-session.sh dev-build)
```

`dev-build` finds the `development-simulator` build whose fingerprint
matches this checkout. If there is none, build it first (15-20 minutes):
`npx --yes eas-cli@latest build --platform ios --profile development-simulator --non-interactive`.

Start one Metro for all explorers, tunneled (cloud devices cannot reach
localhost), with the Bash tool's `run_in_background`. The guide says to
explore a production build, so serve production JavaScript:

```bash
PORT=8082; while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null; do PORT=$((PORT+1)); done
EXPO_UNSTABLE_TUNNEL_V2=1 npx @expo/agent-cli start -- --tunnel --port $PORT --no-dev --minify \
  > "$SCRATCH/metro.log" 2>&1
```

Wait for the `Waiting on …on.expo.app` line, then:

```bash
export E2E_METRO_URL=$(bash tools/agent/sim-session.sh metro-url $PORT)
npx e2e run e2e/smoke.e2e.ts          # one session; must pass before any charter
```

If the smoke test sees the dev-client launcher, a red screen, or a
blank screen, fix that first: drop `--no-dev --minify` and rerun, then check
`$SCRATCH/metro.log`. Never start charters on a failing smoke test.

Pass `--config e2e.bugbash.config.ts` to every command from here on.

## 2. Charters (Brooks)

Five to ten, one area and one posture each (guide, step 2). On a branch,
read `git diff --stat main...HEAD` first and aim charters at what changed.
Starting points in this app:

```text
browse|ios|skeptic|Starting at the Browse tab, open a category and apply two filters, then clear them; check every product count, size, and price against the product pages
pdp|ios|skeptic|Starting at a product page from Home, change colorway and size; check that price, stock, images, and the selected size stay consistent, then add to bag
cart|ios|skeptic|Starting at the Cart tab after adding two products, change quantities, remove one, and undo; check every line total and the order total
search|ios|fuzzer|Starting at the Browse tab search, search empty, a 300-character string, unicode, leading spaces, and "ghost 16"; report results or empty states that are wrong
login|ios|fuzzer|Starting at Profile, open sign-in and submit an empty email, "a@b", a 300-character email, unicode, and leading spaces, then join; report validation that is missing or wrong
state|ios|default|Add a product to the bag, sign in, open Shoes and Challenges from Profile, then restart the app; report anything lost or stale after the restart
first-run|ios|default|Like a first-time shopper, find a neutral road running shoe in your size and add it to the bag; report anything confusing, broken, or inconsistent
```

Write them to `.e2e/bugbash/charters.txt` and fan out four at a time with
the guide's `xargs` loop (step 3), adding `--config e2e.bugbash.config.ts`.
Every line uses target `ios`; each run leases its own device.

## 3. Merge, triage, verify, report

Follow guide steps 4-7. Brooks notes:

- **Environment bucket:** no Apple Health data, product photos and search
  over the network, the tunnel, and the dev-client build. A finding that
  only exists because of one of these is rejected, naming it.
- **Design bucket:** cite the `@ref LLP …` comment or the LLP section when
  the code documents the behavior (for example, Checkout does nothing:
  `src/screens/cart/index.tsx`).
- **Repro tests** go in `e2e/bugbash/<slug>.e2e.ts`, tagged
  `{ tags: ['bugbash'] }`, built with `test` from `@e2e-dev/mobile`. Run
  each alone:
  `npx e2e run e2e/bugbash/<slug>.e2e.ts --config e2e.bugbash.config.ts`.
  A bug is confirmed only by `ASSERTION_FAILED`. Each run leases a session.
- `bun run test:e2e` excludes `bugbash`, so repro tests never gate a run.

## 4. Clean up

- Stop the background Metro task.
- Check that no session is left: `npx --yes eas-cli@latest simulator:list --tag e2e --status in-progress`.
  The provider stops its sessions when a run ends; stop any leftover with
  `simulator:stop --id <id>`.
- Leave `e2e/bugbash/` and `.e2e/bugbash/` uncommitted unless the user asks.
  Offer to fix each confirmed bug; the repro test turning green is the
  proof, and it stays as a regression test without the `bugbash` tag.
- For substantial work, add a diary entry under `diaries/` (AGENTS.md).
