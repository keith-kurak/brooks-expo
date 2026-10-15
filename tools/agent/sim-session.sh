#!/usr/bin/env bash
# One EAS Simulator session with the argent controller, shared by the CI
# agents (validate-issue.sh, verify-on-simulator.sh) and local development
# (.claude/skills/eas-sim-dev). Commands:
#
#   dev-build                      newest finished `development-simulator`
#                                  build whose fingerprint matches this
#                                  checkout; prints its id (exit 1: none)
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
  local hash
  hash=$("${EAS[@]}" fingerprint:generate --platform ios --build-profile development-simulator \
    --json --non-interactive 2>/dev/null | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => console.log(JSON.parse(d.slice(d.indexOf('{'))).hash ?? ''));")
  [ -n "$hash" ] || die "could not compute the iOS fingerprint"
  local id
  id=$("${EAS[@]}" build:list --platform ios --build-profile development-simulator \
    --fingerprint-hash "$hash" --status finished --limit 1 --json --non-interactive 2>/dev/null \
    | node -e "
      let d = ''; process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => { const a = JSON.parse(d.slice(d.indexOf('['))); console.log(a[0]?.id ?? ''); });")
  if [ -z "$id" ]; then
    echo "No development-simulator build matches fingerprint $hash. Build one (about 15-20 min):" >&2
    echo "  npx --yes eas-cli@latest build --platform ios --profile development-simulator --non-interactive" >&2
    exit 1
  fi
  echo "$id"
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

[ $# -gt 0 ] || { sed -n '2,40p' "$0"; exit 1; }
cmd=$1; shift
case "$cmd" in
  dev-build) cmd_dev_build "$@" ;;
  metro-url) cmd_metro_url "$@" ;;
  start) cmd_start "$@" ;;
  env) cmd_env "$@" ;;
  argent) cmd_argent "$@" ;;
  link) cmd_link "$@" ;;
  unlink) cmd_unlink "$@" ;;
  evidence) cmd_evidence "$@" ;;
  stop) cmd_stop "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
