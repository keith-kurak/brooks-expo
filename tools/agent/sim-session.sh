#!/usr/bin/env bash
# One EAS Simulator session with the argent controller, shared by the CI
# agents (validate-issue.sh, verify-on-simulator.sh) and local development
# (.claude/skills/eas-sim-dev). Commands:
#
#   dev-build [ios|android]        newest finished dev-client build whose
#                                  fingerprint matches this checkout
#                                  (iOS: `development-simulator`, Android:
#                                  `development`, an APK); prints its id
#                                  (exit 1: none). Default: ios
#   metro-port                     the port of a Metro server started from
#                                  this worktree, a tunneled one first
#                                  (exit 1: none)
#   metro-url [port]               the public https URL of the Metro tunnel
#                                  on <port> (default 8081)
#   start --name <text> --build-id <id> [--open-url <url>] [--dev]
#         [--minutes <n>] [--idle <n>] [--tag <t>]...
#                                  start an argent session with the build
#                                  installed and launched, wait until it is
#                                  live, print the device udid and the
#                                  browser preview URL. --dev adds the
#                                  dev-menu launch args (no onboarding, no
#                                  auto-open, no floating gear)
#   env                            print export lines: ARGENT_TOOLS_URL,
#                                  ARGENT_AUTH_TOKEN, UDID
#   argent <tool> [flags...]       run an argent tool against the session;
#                                  adds --udid unless the tool is
#                                  list-devices or --udid is given
#   link | unlink                  route (or stop routing) the local argent
#                                  CLI and MCP server to the session
#   evidence <dir> --subject <s> (--verdict <line> | --verdict-file <f>)
#            [eas-simulator-evidence run flags...]
#                                  stop the session, collect its artifacts,
#                                  and build the evidence site in <dir>/site
#   stop                           stop the session and reset the dotenv
#
# Preview-only sessions (.claude/skills/eas-sim-preview): a browser preview
# of the dev client on iOS and Android, no controller, no dotenv. They are
# found again by a tag named after this worktree.
#   preview --name <text> --open-url <url> [--platform ios|android|both]
#           [--ios-build <id>] [--android-build <id>] [--minutes <n>]
#                                  start the sessions in parallel and print
#                                  each platform's preview URL
#   preview-list                   this worktree's live preview sessions
#   preview-stop                   stop them
#
# The session id and the controller config live in .env.eas-simulator
# (gitignored; it holds a token). EXPO_TOKEN must allow simulator sessions
# in CI; locally `eas login` is enough.
# @ref LLP 0009#the-simulator-session
set -euo pipefail

DOTENV=.env.eas-simulator
EAS=(npx --yes eas-cli@latest)

die() { echo "sim-session: $*" >&2; exit 1; }

# The session's controller config: from the dotenv, else from remoteConfig.
load_session_env() {
  [ -f "$DOTENV" ] || die "no $DOTENV; run \`$0 start\` first"
  set -a
  # shellcheck disable=SC1090
  . "./$DOTENV"
  set +a
  if [ -z "${ARGENT_TOOLS_URL:-}" ] || [ -z "${ARGENT_AUTH_TOKEN:-}" ]; then
    eval "$("${EAS[@]}" simulator:get --json --non-interactive | node -e "
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
  [ -n "${ARGENT_TOOLS_URL:-}" ] && [ -n "${ARGENT_AUTH_TOKEN:-}" ] \
    || die "argent connection config not found; is this an argent session?"
  export ARGENT_TOOLS_URL ARGENT_AUTH_TOKEN
}

# argent's tools need an explicit --udid; there is no default device. It
# is cached per session because list-devices is a round trip.
session_udid() {
  local cache="${TMPDIR:-/tmp}/eas-sim-udid-${EAS_SIMULATOR_SESSION_ID:-unknown}"
  if [ -s "$cache" ]; then cat "$cache"; return; fi
  local udid
  udid=$(bash tools/agent/argent.sh run list-devices \
    | grep -oE '"udid" *: *"[^"]+"' | head -n 1 | sed -E 's/.*"([^"]+)"$/\1/')
  [ -n "$udid" ] || die "no device udid in the session's list-devices output"
  printf '%s' "$udid" > "$cache"
  printf '%s' "$udid"
}

cmd_dev_build() {
  local platform=${1:-ios} profile
  case "$platform" in
    ios) profile=development-simulator ;;
    android) profile=development ;;
    *) die "dev-build takes ios or android" ;;
  esac
  local hash
  hash=$("${EAS[@]}" fingerprint:generate --platform "$platform" --build-profile "$profile" \
    --json --non-interactive 2>/dev/null | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => console.log(JSON.parse(d.slice(d.indexOf('{'))).hash ?? ''));")
  [ -n "$hash" ] || die "could not compute the $platform fingerprint"
  local id
  id=$("${EAS[@]}" build:list --platform "$platform" --build-profile "$profile" \
    --fingerprint-hash "$hash" --status finished --limit 1 --json --non-interactive 2>/dev/null \
    | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => { const a = JSON.parse(d.slice(d.indexOf('['))); console.log(a[0]?.id ?? ''); });")
  if [ -z "$id" ]; then
    echo "No $profile $platform build matches fingerprint $hash. Build one (about 15-20 min):" >&2
    echo "  npx --yes eas-cli@latest build --platform $platform --profile $profile --non-interactive" >&2
    exit 1
  fi
  echo "$id"
}

# A Metro server is ours when its process runs from this worktree, so a
# Metro from another worktree is never picked up. A tunneled one wins over
# a local-only one, because only a tunneled Metro reaches a cloud device.
cmd_metro_port() {
  local root port pid cwd first=""
  root=$(git rev-parse --show-toplevel)
  for port in $(seq 8081 8099); do
    # lsof exits 1 for a free port; under pipefail that must not end the scan.
    pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)
    [ -n "$pid" ] || continue
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)
    [ "$cwd" = "$root" ] || continue
    curl -fsS -o /dev/null -H "expo-platform: ios" "http://127.0.0.1:${port}/" 2>/dev/null || continue
    if cmd_metro_url "$port" >/dev/null 2>&1; then
      echo "$port"
      return
    fi
    [ -n "$first" ] || first=$port
  done
  if [ -n "$first" ]; then
    echo "$first"
    echo "sim-session: Metro on $first runs from this worktree but is not tunneled" >&2
    return
  fi
  die "no Metro server from $root on ports 8081-8099"
}

cmd_metro_url() {
  local port=${1:-8081}
  # Metro's manifest names the host the dev client must load from; with a
  # tunnel that is the public tunnel host, not localhost.
  curl -fsS -H "expo-platform: ios" "http://127.0.0.1:${port}/" | node -e "
    let d = ''; process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      const u = new URL(JSON.parse(d).launchAsset.url);
      if (u.hostname === 'localhost' || /^[0-9.]+$/.test(u.hostname)) {
        console.error('Metro is not tunneled (launchAsset host ' + u.hostname + '). Start it with EXPO_UNSTABLE_TUNNEL_V2=1 ... expo start --tunnel.');
        process.exit(1);
      }
      // The manifest says http, but the tunnel also serves https, which
      // is what the dev client URL should carry.
      console.log('https://' + u.host);
    });"
}

cmd_start() {
  local name="" build_id="" open_url="" dev="" minutes=30 idle="" tags=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --name) name=$2; shift 2 ;;
      --build-id) build_id=$2; shift 2 ;;
      --open-url) open_url=$2; shift 2 ;;
      --dev) dev=1; shift ;;
      --minutes) minutes=$2; shift 2 ;;
      --idle) idle=$2; shift 2 ;;
      --tag) tags+=(--tag "$2"); shift 2 ;;
      *) die "unknown start flag: $1" ;;
    esac
  done
  [ -n "$name" ] || die "start needs --name (what this session is for)"
  [ -n "$build_id" ] || die "start needs --build-id"

  # Never stack sessions: a second start bills twice and overwrites the
  # dotenv's session id.
  if [ -f "$DOTENV" ] && grep -q EAS_SIMULATOR_SESSION_ID "$DOTENV"; then
    if "${EAS[@]}" simulator:get --json --non-interactive 2>/dev/null | grep -qE '"status": *"(IN_PROGRESS|STARTING|QUEUED|NEW)"'; then
      die "a session from $DOTENV is still running; reuse it or run \`$0 stop\` first"
    fi
  fi
  printf '# managed by eas-cli\n' > "$DOTENV"

  local flags=(--platform ios --type argent --build-id "$build_id"
    --max-duration-minutes "$minutes" --non-interactive --name "${name:0:50}")
  [ -n "$idle" ] && flags+=(--max-idle-time-minutes "$idle")
  [ -n "$open_url" ] && flags+=(--open-url "$open_url")
  if [ -n "$dev" ]; then
    flags+=(--launch-arg -EXDevMenuIsOnboardingFinished --launch-arg 1
      --launch-arg -EXDevMenuShowsAtLaunch --launch-arg 0
      --launch-arg -EXDevMenuShowFloatingActionButton --launch-arg 0)
  fi
  "${EAS[@]}" simulator:start "${flags[@]}" ${tags[@]+"${tags[@]}"}

  # start's own poll is unreliable; boot takes 90 s to 15 min.
  local s=""
  for _ in $(seq 1 64); do
    s=$("${EAS[@]}" simulator:get --json --non-interactive 2>/dev/null || true)
    if echo "$s" | grep -q '"status": *"IN_PROGRESS"' && echo "$s" | grep -q remoteConfig; then
      load_session_env
      echo "udid: $(session_udid)"
      echo "$s" | node -e "
        let d = ''; process.stdin.on('data', c => d += c);
        process.stdin.on('end', () => {
          const j = JSON.parse(d.slice(d.indexOf('{')));
          let url = '';
          (function walk(o) { if (!o || typeof o !== 'object' || url) return;
            for (const [k, v] of Object.entries(o)) { if (k === 'webPreviewUrl' && typeof v === 'string') url = v; else walk(v); } })(j);
          if (url) console.log('preview: ' + url);
        });" || true
      return
    fi
    if echo "$s" | grep -qE '"status": *"(STOPPED|ERRORED)"'; then
      die "the session failed to boot"
    fi
    sleep 15
  done
  die "the session was not ready in time"
}

cmd_env() {
  load_session_env
  printf 'export ARGENT_TOOLS_URL=%q\n' "$ARGENT_TOOLS_URL"
  printf 'export ARGENT_AUTH_TOKEN=%q\n' "$ARGENT_AUTH_TOKEN"
  printf 'export UDID=%q\n' "$(session_udid)"
}

cmd_argent() {
  [ $# -gt 0 ] || die "argent needs a tool name"
  load_session_env
  local tool=$1; shift
  if [ "$tool" = "list-devices" ] || printf '%s\n' "$@" | grep -qx -- '--udid'; then
    exec bash tools/agent/argent.sh run "$tool" "$@"
  fi
  exec bash tools/agent/argent.sh run "$tool" --udid "$(session_udid)" "$@"
}

cmd_link() {
  load_session_env
  # Global for this machine (~/.argent/link.json): every argent client,
  # the MCP server included, now drives the cloud device.
  argent link "$ARGENT_TOOLS_URL" --token "$ARGENT_AUTH_TOKEN" --yes
  echo "Linked. Reconnect the argent MCP server (/mcp) so it picks up the remote session."
  echo "Device udid for --udid: $(session_udid)"
}

cmd_unlink() { argent unlink --yes || true; }

cmd_evidence() {
  [ $# -gt 0 ] || die "evidence needs a directory"
  local dir=$1; shift
  # --stop: the tool stops the session itself, because simulator:stop
  # clears the dotenv and the tool reads the session id from it. --name
  # and --slug: app.json has neither; brand.config.js does.
  npx --no-install eas-simulator-evidence run "$dir" --stop \
    --name "$(node -p "require('./brand.config.js').brand.name")" \
    --slug "$(node -p "require('./brand.config.js').brand.slug")" "$@"
  printf '# managed by eas-cli\n' > "$DOTENV"
}

cmd_stop() {
  "${EAS[@]}" simulator:stop --non-interactive >/dev/null 2>&1 || true
  printf '# managed by eas-cli\n' > "$DOTENV"
  echo "Session stopped and $DOTENV reset."
}

# Preview sessions carry this tag so preview-list and preview-stop find
# them without a dotenv. Tags are stored lowercased.
preview_tag() {
  printf 'preview-%s' "$(basename "$(git rev-parse --show-toplevel)" \
    | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-')"
}

# Live preview sessions of this worktree as "id<TAB>platform<TAB>status".
preview_sessions() {
  "${EAS[@]}" simulator:list --tag "$(preview_tag)" --type web-preview-only \
    --status new --status queued --status starting --status in-progress \
    --limit 20 --json --non-interactive 2>/dev/null | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        for (const s of JSON.parse(d.slice(d.indexOf('{'))).sessions ?? [])
          console.log([s.id, s.platform, s.status, s.deviceRunSessionUrl].join('\t'));
      });"
}

cmd_preview() {
  local name="" open_url="" platforms="ios android" ios_build="" android_build="" minutes=30
  while [ $# -gt 0 ]; do
    case "$1" in
      --name) name=$2; shift 2 ;;
      --open-url) open_url=$2; shift 2 ;;
      --platform) case "$2" in both) platforms="ios android" ;; ios|android) platforms=$2 ;; *) die "--platform takes ios, android, or both" ;; esac; shift 2 ;;
      --ios-build) ios_build=$2; shift 2 ;;
      --android-build) android_build=$2; shift 2 ;;
      --minutes) minutes=$2; shift 2 ;;
      *) die "unknown preview flag: $1" ;;
    esac
  done
  [ -n "$name" ] || die "preview needs --name (what this preview is for)"
  [ -n "$open_url" ] || die "preview needs --open-url (the dev-client link to Metro)"

  # One preview per platform per worktree: a second one bills twice and
  # shows the same thing.
  local live
  live=$(preview_sessions)
  for p in $platforms; do
    if printf '%s\n' "$live" | awk -F'\t' -v p="$p" 'toupper($2) == toupper(p)' | grep -q .; then
      die "this worktree already has a live $p preview; run \`$0 preview-list\` or \`$0 preview-stop\`"
    fi
  done

  # Resolve every build before booting anything, so a missing build costs
  # no session time.
  for p in $platforms; do
    if [ "$p" = ios ] && [ -z "$ios_build" ]; then ios_build=$(cmd_dev_build ios); fi
    if [ "$p" = android ] && [ -z "$android_build" ]; then android_build=$(cmd_dev_build android); fi
  done

  # Both platforms boot in parallel. --out-config-type env writes no
  # dotenv, so an eas-sim-dev session in this worktree is untouched;
  # --json makes start wait until the session is ready and print its
  # preview URL. Browser activity does not reset an idle timer, so only
  # --max-duration-minutes bounds a preview.
  local tmp pids=() tag
  tmp=$(mktemp -d)
  tag=$(preview_tag)
  for p in $platforms; do
    local flags=(--platform "$p" --type web-preview-only --out-config-type env --json
      --non-interactive --max-duration-minutes "$minutes" --tag "$tag" --tag preview
      --name "${name:0:50}" --open-url "$open_url")
    if [ "$p" = ios ]; then
      # Dev-menu UserDefaults: no onboarding popup, no auto-open, no gear.
      flags+=(--build-id "$ios_build"
        --launch-arg -EXDevMenuIsOnboardingFinished --launch-arg 1
        --launch-arg -EXDevMenuShowsAtLaunch --launch-arg 0
        --launch-arg -EXDevMenuShowFloatingActionButton --launch-arg 0)
    else
      flags+=(--build-id "$android_build")
    fi
    ("${EAS[@]}" simulator:start "${flags[@]}" > "$tmp/$p.json" 2> "$tmp/$p.log") &
    pids+=($!)
    echo "Starting the $p preview..." >&2
  done

  local failed=""
  for i in "${!pids[@]}"; do
    wait "${pids[$i]}" || failed=1
  done
  for p in $platforms; do
    if [ -s "$tmp/$p.json" ]; then
      node -e "
        const fs = require('fs');
        const raw = fs.readFileSync(process.argv[1], 'utf8');
        const j = JSON.parse(raw.slice(raw.indexOf('{')));
        console.log(process.argv[2] + ' preview: ' + (j.remoteConfig?.previewUrl ?? '(no preview URL)'));
        console.log(process.argv[2] + ' session: ' + j.deviceRunSessionUrl);
      " "$tmp/$p.json" "$p"
    else
      echo "$p preview failed to start:" >&2
      tail -n 20 "$tmp/$p.log" >&2
      failed=1
    fi
  done
  echo "The sessions stop by themselves after $minutes minutes. Stop them earlier with: $0 preview-stop"
  rm -rf "$tmp"
  [ -z "$failed" ]
}

cmd_preview_list() {
  local live
  live=$(preview_sessions)
  [ -n "$live" ] || { echo "No live preview sessions for this worktree."; return; }
  printf '%s\n' "$live"
}

cmd_preview_stop() {
  local id
  preview_sessions | while IFS=$'\t' read -r id _; do
    [ -n "$id" ] || continue
    "${EAS[@]}" simulator:stop --id "$id" --non-interactive >/dev/null 2>&1 || true
    echo "Stopped preview session $id"
  done
}

[ $# -gt 0 ] || { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 1; }
cmd=$1; shift
case "$cmd" in
  dev-build) cmd_dev_build "$@" ;;
  metro-port) cmd_metro_port "$@" ;;
  metro-url) cmd_metro_url "$@" ;;
  start) cmd_start "$@" ;;
  env) cmd_env "$@" ;;
  argent) cmd_argent "$@" ;;
  link) cmd_link "$@" ;;
  unlink) cmd_unlink "$@" ;;
  evidence) cmd_evidence "$@" ;;
  stop) cmd_stop "$@" ;;
  preview) cmd_preview "$@" ;;
  preview-list) cmd_preview_list "$@" ;;
  preview-stop) cmd_preview_stop "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
