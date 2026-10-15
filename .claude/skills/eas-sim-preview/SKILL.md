---
name: eas-sim-preview
description: Open Brooks on an iOS simulator and an Android emulator in the EAS cloud, in browser preview only (no agent control), with both dev clients connected to this worktree's running Metro dev server so edits show by Fast Refresh. Use when asked to "preview on iOS and Android", "open the app in cloud simulators", "share a live preview", or "show the dev server on both platforms". For agent-driven testing with argent, use eas-sim-dev.
---

# Live preview on iOS and Android (EAS Simulator)

This opens one `web-preview-only` session per platform. Each session
installs the dev-client build and opens it on this worktree's Metro dev
server through the Expo tunnel. The result is two browser links that a
person drives. No agent controls the devices, so there is no argent, no
`describe`, and no evidence page. It follows Mode C, Method 1 of the
official Expo `eas-simulator` skill:
https://github.com/expo/skills/blob/main/plugins/expo/skills/eas-simulator/SKILL.md

> **EAS service, costs apply.** Two sessions bill at the same time. They
> stop by themselves after `--minutes` (default 30). Stop them earlier with
> `preview-stop` (step 5) when the person is done.

Session commands are in `tools/agent/sim-session.sh`. For the dev server
and the project checks, use the Expo Agent CLI (`npx @expo/agent-cli`;
AGENTS.md, "Expo commands"), but not its `--eas` flags: they drive only
`agent-device` sessions, and these previews have no controller. Preview sessions write no
`.env.eas-simulator`, so they do not touch an `eas-sim-dev` session in the
same worktree. The script finds them again by a tag named after the
worktree (`preview-<worktree folder>`), and it allows one preview per
platform per worktree.

**Authorization for the tunnel:** the project owner chose the Expo
account-signed tunnel for live development on EAS Simulator (2026-10-14:
"it's totally fine to use the tunnel. I'd rather you use the tunnel").
While Metro runs with the tunnel, it is reachable at
`https://<id>.on.expo.app`, so the cloud dev clients can load the manifest,
the bundle, and the assets and get Fast Refresh updates.

## 1. Ground truth

```bash
pwd                                                       # the worktree root
npx --yes eas-cli@latest simulator:availability --json    # "available": true
bash tools/agent/sim-session.sh preview-list              # a live preview may exist already
```

If a preview for this worktree is still live, give the person its links
again (step 4 prints them on start; `preview-list` shows the session pages)
or stop it first. Do not start a second one.

## 2. Find the dev-client builds (before any session)

```bash
bash tools/agent/sim-session.sh dev-build ios        # development-simulator profile
bash tools/agent/sim-session.sh dev-build android    # development profile (an APK)
```

`preview` runs these lookups itself. Run them first anyway: a missing build
takes 15-20 minutes to make, and the person should know before anything
boots. If one is missing, give the build command it prints and ask whether
to build it or to preview only the other platform (`--platform ios` or
`--platform android`).

Never use a release build (`simulator`, `production`) here: its JavaScript
is fixed at build time and does not connect to Metro.

## 3. Find the running dev server and its tunnel

```bash
PORT=$(bash tools/agent/sim-session.sh metro-port)       # Metro started from this worktree
METRO_URL=$(bash tools/agent/sim-session.sh metro-url $PORT)
```

- **No Metro from this worktree:** start one with the tunnel, with the Bash
  tool's `run_in_background`. Do not set `CI=1`; it turns off the file
  watcher and Fast Refresh.

  ```bash
  PORT=8082; while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null; do PORT=$((PORT+1)); done
  EXPO_UNSTABLE_TUNNEL_V2=1 npx @expo/agent-cli start -- --tunnel --port $PORT > "$SCRATCH/metro.log" 2>&1
  ```

  Wait for the `Waiting on exp+ecommerce-demo://…on.expo.app` line, then
  run `metro-url $PORT`.
- **Metro runs but without the tunnel** (`metro-url` says "Metro is not
  tunneled"): that Metro probably belongs to the person. Ask before you
  change it. Either they restart it with `EXPO_UNSTABLE_TUNNEL_V2=1 …
  expo start --tunnel`, or you start a second, tunneled Metro on a free
  port as above and use that port. Do not stop their Metro yourself.

Build the dev-client link. Both platforms use the same one:

```bash
OPEN_URL="exp+ecommerce-demo://expo-development-client/?url=$(node -p "encodeURIComponent('$METRO_URL')")"
```

## 4. Start the previews

Name the preview for its purpose, in 3-6 words.

```bash
bash tools/agent/sim-session.sh preview --name "Cart badge review" --open-url "$OPEN_URL"
```

- Both platforms boot in parallel; this takes 90 s to 15 min. The command
  prints an `ios preview:` and an `android preview:` URL, plus each
  session's page on expo.dev.
- Use `--minutes <n>` for a longer or shorter preview, up to the plan
  limit. Idle time does not stop a preview, because browser activity does
  not count as session activity.
- Use `--platform ios` or `--platform android` for one platform only.

Give the person both preview URLs, each on its own line, for their
browser. Do not open them yourself, and never send a preview URL to a
device. The URLs carry an access token, so share them only with the
people who should see the preview.

Then confirm that each dev client loaded the JavaScript. If you started
Metro, its log must show an `iOS Bundled …` and an `Android Bundled …`
line. If Metro belongs to the person, ask them to check its terminal or
the previews. If a platform does not load within about a minute, the link
probably did not open the dev client. Tell the person; they can use "Enter
URL manually" in the dev client launcher, in the browser preview, with
`$METRO_URL`.

On Android, the dev-menu onboarding screen can appear the first time. The
iOS session skips it through launch arguments, but Android has no
equivalent; the person closes it in the preview.

## 5. While the preview runs, and after

- Edits in this worktree reach both previews by Fast Refresh. A change to
  native code does not: it needs new dev-client builds (step 2) and new
  previews.
- When the person is done, or before you start new previews:

  ```bash
  bash tools/agent/sim-session.sh preview-stop
  ```

- Stop Metro only if you started it in step 3.
