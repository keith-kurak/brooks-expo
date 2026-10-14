#!/usr/bin/env bash
# Shared settings and the bot comment shape. Source it; do not run it.
#   APP_ID, APP_NAME, APP_SLUG             -> from brand.config.js
#   CLAUDE_MODEL                           -> the model every agent runs on
#   evidence_tool <cmd> [args...]         -> the eas-simulator-evidence CLI
#   normalize_verdict "<line>" [FALLBACK] -> line 1 of a verdict file, made unambiguous
#   verdict_badge "<verdict line>"        -> the line with a leading status emoji
#   evidence_thumbs <dir> <site_url>      -> an HTML row of screenshot thumbnails
# Every bot post shares one layout: "## 🤖 <stage>", a bold Verdict or
# Status line, a short bullet list (PR, evidence), a thumbnail row, the
# full report folded away, and a "_Posted by_" footer. The "## 🤖" prefix
# is load-bearing: gh.mjs get-issue drops those comments so a re-triage
# does not read the bot's own output as evidence.
#
# Adapted from jacobhammerle/employee-onboarding. @ref LLP 0009#where-it-came-from

# brand.config.js owns the app's identity (app.json has no name or slug),
# so read it instead of repeating the bundle identifier here.
APP_ID=$(node -p "require('./brand.config.js').brand.bundleIdentifier")
APP_NAME=$(node -p "require('./brand.config.js').brand.name")
APP_SLUG=$(node -p "require('./brand.config.js').brand.slug")
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-5-5}"
export APP_ID APP_NAME APP_SLUG CLAUDE_MODEL

# --no-install: run the copy in node_modules and fail loudly when it is
# missing, instead of fetching a floating version from the registry.
evidence_tool() { npx --no-install eas-simulator-evidence "$@"; }

# Line 1 of a verdict file decides the result, and agents do not always
# write it cleanly ("PASS: FAIL: ..." was seen upstream). The package
# collapses a chain of leading keywords to the LAST one, turns a PASS line
# that still mentions FAIL into a FAIL, passes PASS / FAIL / REPLICATED /
# NOT-REPLICATED / CONFIRMED / INCONCLUSIVE through unchanged, and makes
# anything else "<fallback>: malformed verdict line: ...". <fallback> is
# $2 (default FAIL; the issue flow passes INCONCLUSIVE).
normalize_verdict() {
  if [ -n "${2:-}" ]; then
    evidence_tool verdict "$1" --fallback "$2"
  else
    evidence_tool verdict "$1"
  fi
}

# The verdict keyword picks the emoji; the evidence site uses the same
# mapping for its badge color.
verdict_badge() { evidence_tool verdict "$1" --badge; }

# Up to four screenshots from <dir>, in capture order, as linked
# thumbnails served by the evidence site (files sit at the site root).
# Prints nothing when there are no images, so callers can drop it in.
evidence_thumbs() { evidence_tool thumbs "$1" "$2" --max 4; }

# Boots an argent-type EAS Simulator session with BUILD_ID installed and
# launched, waits for it, and exports ARGENT_TOOLS_URL, ARGENT_AUTH_TOKEN,
# and UDID. $1 is the session name (cut to 50 characters).
start_simulator_session() {
  local name=${1:0:50}
  npx --yes eas-cli@latest simulator:start --platform ios --type argent \
    --build-id "$BUILD_ID" \
    --max-duration-minutes 30 --non-interactive --name "$name"

  local live="" s
  for _ in $(seq 1 64); do
    s=$(npx --yes eas-cli@latest simulator:get --json --non-interactive 2>/dev/null || true)
    if echo "$s" | grep -q '"status": "IN_PROGRESS"' && echo "$s" | grep -q remoteConfig; then
      live=1
      break
    fi
    if echo "$s" | grep -qE '"status": "(STOPPED|ERRORED)"'; then
      echo "Simulator session failed to boot."
      return 1
    fi
    sleep 15
  done
  [ -n "$live" ] || { echo "Session not ready in time."; return 1; }

  # An argent session's connection config lands in .env.eas-simulator;
  # exporting it routes every local `argent run` to the session's remote
  # tool-server.
  set -a
  # shellcheck disable=SC1091
  . ./.env.eas-simulator
  set +a
  if [ -z "${ARGENT_TOOLS_URL:-}" ] || [ -z "${ARGENT_AUTH_TOKEN:-}" ]; then
    # Fallback: pull them out of the session's remoteConfig.
    eval "$(npx --yes eas-cli@latest simulator:get --json --non-interactive | node -e "
      let d = '';
      process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        const found = {};
        (function walk(o) {
          if (!o || typeof o !== 'object') return;
          for (const [k, v] of Object.entries(o)) {
            if ((k === 'ARGENT_TOOLS_URL' || k === 'ARGENT_AUTH_TOKEN') && typeof v === 'string') found[k] = v;
            else walk(v);
          }
        })(JSON.parse(d.slice(d.indexOf('{'))));
        for (const [k, v] of Object.entries(found)) console.log(\`export \${k}=\${JSON.stringify(v)}\`);
      });
    ")"
  fi
  if [ -z "${ARGENT_TOOLS_URL:-}" ] || [ -z "${ARGENT_AUTH_TOKEN:-}" ]; then
    echo "argent connection config not found in .env.eas-simulator or simulator:get."
    return 1
  fi
  export ARGENT_TOOLS_URL ARGENT_AUTH_TOKEN

  UDID=$(bash tools/agent/argent.sh run list-devices \
    | grep -oE '"udid" *: *"[^"]+"' | head -n 1 | sed -E 's/.*"([^"]+)"$/\1/')
  if [ -z "$UDID" ]; then
    echo "No device udid in the argent session's list-devices output."
    return 1
  fi
  export UDID
  echo "argent session device: $UDID"
}

# The appendix every simulator prompt gets: the identifiers the agent
# needs in its argent commands.
device_facts() {
  printf '\nThe app bundle identifier is: %s\n' "$APP_ID"
  printf 'The device udid for every argent command is: %s\n' "$UDID"
}
