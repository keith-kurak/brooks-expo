---
name: eas-sim-dev
description: The default way to run, test, or check Brooks on a device. Develop and test a change live on an EAS cloud iOS simulator - Metro behind the Expo tunnel, an EAS Simulator session with the dev-client build connected to it, argent (CLI or MCP) to drive the app, Fast Refresh for each edit, and an evidence page from eas-simulator-evidence. Use for any request to reproduce a bug, check a UI change, verify a fix, take screenshots, or "run it on the simulator" in this repo, even when the user does not say "cloud" and local simulators exist (AGENTS.md, "Testing on a device"). Use a local simulator only when the user asks for one.
---

# Live development on EAS Simulator

This skill is the Brooks-specific version of the official Expo
`eas-simulator` skill (Mode C, Method 1: a dev build plus a Metro tunnel).
Read that skill when a step here fails: it has the error reference. Its
source: https://github.com/expo/skills/blob/main/plugins/expo/skills/eas-simulator/SKILL.md

> **EAS service, costs apply.** A session bills until it stops. Stop it when
> the work is done (step 7), also when the work fails.

**One iOS simulator per worktree.** This loop is iOS only and uses one
session at a time. To work on two changes at once, use two git worktrees:
each has its own `.env.eas-simulator`, Metro port, and tunnel. Do not start
a second session in the same worktree, and do not start an Android session;
agent-driven Android work is out of scope for this demo. To show a person
the change on both iOS and Android, use the `eas-sim-preview` skill: it
opens browser-only previews on the same Metro and does not touch this
session.

**Tools.** Use the Expo Agent CLI (`npx @expo/agent-cli`) for the project,
the dev server, and the JavaScript runtime: `status`, `start`,
`runtime:reload`, `runtime:errors`, `runtime:tree`, `typecheck` (AGENTS.md,
"Expo commands"). Use `sim-session.sh` and argent for the cloud session and
for screen-level driving. Do not use agent-cli's `dev --ios`, `smoke`, or
`--eas` flags here: in this project `dev --ios` plans a local Xcode build,
and the `--eas` flags drive only `agent-device` sessions, not this argent one.

All session logic is in `tools/agent/sim-session.sh`. The CI agents
(`expo-bot-issue`, `expo-bot-verify`) use the same script, so a local run
and a CI run start the session the same way. Run `bash
tools/agent/sim-session.sh` with no arguments for its command list.

**Authorization for the tunnel:** the project owner chose the Expo
account-signed tunnel for this workflow (2026-10-14: "it's totally fine to
use the tunnel. I'd rather you use the tunnel"). Metro on
`localhost:<port>` is reachable through `https://<id>.on.expo.app` while it
runs, so the cloud dev client can load the manifest, the bundle, and the
assets and get Fast Refresh updates. Stop Metro when the session ends.

## 0. Ground truth

Do these once per run, before you start anything:

```bash
pwd                                                  # must be the brooks-expo root
npx @expo/agent-cli status                           # project, dev server, what to run next
npx --yes eas-cli@latest whoami                      # logged in to the right account
npx --yes eas-cli@latest simulator:availability --json   # "available": true
cat .env.eas-simulator 2>/dev/null                   # a session id here may still be live
```

If the dotenv names a session, run `npx --yes eas-cli@latest simulator:get
--json`. Reuse an `IN_PROGRESS` session only if this run started it. Never
start a second session on top of a live one; `sim-session.sh start` refuses.

## 1. Find the dev-client build (before the session)

```bash
BUILD_ID=$(bash tools/agent/sim-session.sh dev-build)
```

It finds the newest finished `development-simulator` build whose fingerprint
matches this checkout. If there is none (exit 1), or the change touches
native code (`modules/`, `plugins/`, `targets/`, config plugins in
`app.config.ts`, a native dependency), build one first. It takes 15-20
minutes, so build before you start the session:

```bash
npx --yes eas-cli@latest build --platform ios --profile development-simulator --non-interactive
```

Never use a `simulator` (release) build for this loop. Its JavaScript is
fixed at build time and cannot hot reload.

## 2. Start Metro behind the tunnel (before the session)

Choose a free port. Do not stop another Metro to free 8081.

```bash
PORT=8082; while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null; do PORT=$((PORT+1)); done; echo $PORT
```

Start Metro with the Bash tool's `run_in_background`, and log to a file in
the scratchpad. Do not set `CI=1`: it turns off the file watcher, and then
Fast Refresh does nothing.

```bash
EXPO_UNSTABLE_TUNNEL_V2=1 npx @expo/agent-cli start -- --tunnel --port $PORT > "$SCRATCH/metro.log" 2>&1
```

`agent-cli start` is `expo start` plus a sync of package agent skills;
everything after `--` goes to `expo start` unchanged.

Wait until the log has a `Waiting on exp+ecommerce-demo://…on.expo.app`
line, then get the public URL and build the dev-client link:

```bash
METRO_URL=$(bash tools/agent/sim-session.sh metro-url $PORT)       # https://<id>.on.expo.app
OPEN_URL="exp+ecommerce-demo://expo-development-client/?url=$(node -p "encodeURIComponent('$METRO_URL')")"
```

`exp+ecommerce-demo` is the dev-client scheme that Expo CLI prints for this
project (`exp+<slug>`). If the link opens the launcher and not the app, try
the app scheme from `brand.config.js` (`ecomdemo://expo-development-client/?url=…`).

## 3. Start the session

Name the session for its purpose, in 3-6 words. Include the issue or PR
number when there is one.

```bash
bash tools/agent/sim-session.sh start --name "Cart badge fix for #42" \
  --build-id "$BUILD_ID" --dev --open-url "$OPEN_URL" --idle 15 --tag local-dev
```

- `--dev` adds the dev-menu launch args (no onboarding popup, no auto-open
  menu, no floating gear), so screenshots are clean.
- The script waits until the session is live (90 s to 15 min), then prints
  the device `udid` and the browser `preview` URL. Give the preview URL to
  the user for their browser. Never open it on the device.
- `--idle 15` stops a forgotten session after 15 minutes without controller
  activity. Browser-preview activity does not count, so leave it out if the
  user wants to drive the preview themselves, and set `--minutes` instead.

Confirm that the app loaded your JavaScript: `$SCRATCH/metro.log` must show
an `iOS Bundled …` line. If it does not appear within about a minute,
reset once (step 7, then steps 2-3 again). If the second try also fails,
stop and report. Do not reconnect or restart Metro in place.

Then check from the runtime side that the app connected:

```bash
npx @expo/agent-cli runtime:errors --port $PORT     # exit 1 NO_APP_CONNECTED = the app did not load
```

## 4. Drive the app with argent

Read the `argent-device-interact` skill before the first interaction. Its
rules apply here: run a discovery tool (`describe`) before every tap, and
never take tap coordinates from a screenshot. Coordinates are normalized
0.0-1.0.

For React components, `npx @expo/agent-cli runtime:tree --port $PORT`
lists the focused screen's testIDs, labels, and handlers from the React
tree. It has no geometry and does not see native views (the tab bar, system
dialogs), so use it to find what to check, and argent `describe` for where
to tap.

**Option A, CLI (default).** `sim-session.sh argent` loads the session
config and adds `--udid`:

```bash
bash tools/agent/sim-session.sh argent describe
bash tools/agent/sim-session.sh argent gesture-tap --x 0.5 --y 0.42
bash tools/agent/sim-session.sh argent keyboard --text "Ghost 16"
bash tools/agent/sim-session.sh argent gesture-swipe --fromX 0.5 --fromY 0.7 --toX 0.5 --toY 0.3
bash tools/agent/sim-session.sh argent screenshot --scale 1 --out evidence/1-home.png
bash tools/agent/sim-session.sh argent tools describe <tool>    # a tool's flags
```

**Option B, argent MCP tools.** `bash tools/agent/sim-session.sh link`
routes the argent CLI and MCP server on this machine to the session. Then
reconnect the argent MCP server (`/mcp`) and pass the printed udid to each
tool. The link is global to this Mac: other agents that use argent now
drive the cloud device too, including agents in other worktrees. Use
Option B only when this is the only worktree with a session; otherwise use
Option A, which reads the session from this worktree's dotenv on every
call. Run `sim-session.sh unlink` in step 7.

App facts for driving Brooks:

- The tabs are Home, Browse, Cart, and Profile. Their labels are hidden, so
  `describe` shows each tab by its accessibility label.
- Products, prices, stock, and reviews are bundled and work offline. Search
  and product photos load from the network.
- The session is a fresh install: no Health data, an empty cart, no saved
  shoes or challenges.
- If the app crashes, read the device log and crash reports as the official
  skill's `references/logs-and-crashes.md` describes, before you guess from
  screenshots.

## 5. Change the code and check it

Edit the source. Fast Refresh sends the change to the cloud simulator, so
there is no rebuild. When a screen kept old state, or before you judge a
fix, put the app on the code on disk and read what it threw:

```bash
npx @expo/agent-cli runtime:reload --port $PORT
npx @expo/agent-cli runtime:errors --port $PORT --duration 5s
```

`runtime:errors` replays errors the app reported before, so reload first.
An empty window means nothing was thrown while it watched, not that the app
is healthy.

After each change, run `describe` again (old frames are stale) and take a
screenshot of the result. Keep the project rules in
AGENTS.md: read an `@ref LLP` before you change the code it governs, and run
`npx @expo/agent-cli typecheck` before you finish.

A change to native code does not hot reload. Stop (step 7), build a new
dev-client build (step 1), and start again.

## 6. Evidence page (optional, for a PR or an issue)

Use the same tool the CI agents use: `eas-simulator-evidence`.

1. Save screenshots while you drive, in capture order, as
   `evidence/<n>-<slug>.png`. The slug becomes the caption.
2. Write `evidence/verdict.txt`. Line 1 is the verdict, for example
   `PASS: <what you checked and saw>` or `FAIL: Screenshot 3 shows <what is wrong>`.
   The lines after it are the report (Markdown).
3. Build the page. This also stops the session, which is necessary: the
   recording and the metrics exist only after the stop.

```bash
bash tools/agent/sim-session.sh evidence evidence \
  --subject "Local · $(git branch --show-current)" \
  --verdict-file evidence/verdict.txt --build-id "$BUILD_ID" --agent "Claude Code"
npx --no-install eas-simulator-evidence open evidence            # look at it locally
npx --no-install eas-simulator-evidence deploy evidence --alias local-<branch>-evidence   # share it
```

`evidence/` is gitignored. The hosted page is public, so keep secrets out of
the screenshots and the report.

## 7. Stop and clean up

Always, also after a failure:

```bash
bash tools/agent/sim-session.sh stop      # no-op if step 6 already stopped it
bash tools/agent/sim-session.sh unlink    # only if you used Option B
```

Then stop the background Metro task (TaskStop, or kill the
`expo start --tunnel --port $PORT` process).

## 8. Hand off to CI

Push the branch to the fork and open the PR there, never on the upstream
repository (AGENTS.md, "Pull requests"):

```bash
git push -u origin HEAD
gh pr create --repo keith-kurak/brooks-expo --base main --head "$(git branch --show-current)"
```

To run the same check in CI, add the
`agent-validate` label to the PR. `expo-bot-verify.yml` then reviews the
diff, repacks a `simulator` build with the PR's JavaScript, verifies it on a
new cloud simulator, and posts the verdict and the evidence page on the PR
(LLP 0009). To run it again, remove the label and add it again.

For substantial work, add a diary entry under `diaries/` (AGENTS.md).
