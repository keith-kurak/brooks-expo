#!/usr/bin/env bash
# Boots an EAS cloud simulator with the binary the workflow repacked (or
# built) with the base branch's JS, lets Claude Code try to replicate the
# reported issue (screenshots into evidence/), deploys the evidence to EAS
# Hosting, then:
#   REPLICATED     -> fix-issue.sh opens a PR; the issue gets verdict +
#                     PR link + evidence link
#   CONFIRMED      -> (feature request: capability absent) same path, the
#                     PR implements it
#   NOT-REPLICATED -> the issue gets the reasoning + evidence link
# Requires: BUILD_ID, ISSUE_NUMBER, BASE_BRANCH, GH_REPO, GH_TOKEN,
#           EXPO_TOKEN_SIMULATOR, CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# Optional: INSTRUCTION (guidance from the @expo-bot comment or the intake)
#           BUILD_STATUS, REPACK_STATUS (upstream job statuses)
#           AUTO_VERIFY (default true: fix-issue.sh dispatches expo-bot-verify
#           on the PR; "false" skips it)
# @ref LLP 0009#the-pipeline
set -euo pipefail

EVIDENCE_DIR="evidence"
# shellcheck disable=SC1091
. tools/agent/comment-lib.sh

# The worker's auto-injected EXPO_TOKEN is restricted-scope and cannot
# create simulator sessions (they are actor-gated). Use the personal
# access token stored as EXPO_TOKEN_SIMULATOR for everything.
if [ -n "${EXPO_TOKEN_SIMULATOR:-}" ]; then
  export EXPO_TOKEN="$EXPO_TOKEN_SIMULATOR"
else
  echo "EXPO_TOKEN_SIMULATOR is not set; simulator:start will fail with 'Not authorized'."
  echo "Add a personal access token as EXPO_TOKEN_SIMULATOR in the production environment."
  exit 1
fi
if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN is not set; add a GitHub token with issues, contents,"
  echo "and pull-request write access in the production EAS environment."
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Neither CLAUDE_CODE_OAUTH_TOKEN nor ANTHROPIC_API_KEY is set."
  exit 1
fi

# The session bills until stopped, and a run that dies before commenting
# would leave the issue silent; the trap covers both.
COMMENT_POSTED=""
cleanup() {
  code=$?
  npx --yes eas-cli@latest simulator:stop --non-interactive >/dev/null 2>&1 || true
  if [ "$code" -ne 0 ] && [ -z "$COMMENT_POSTED" ]; then
    if [ -s /tmp/issue-verdict.md ]; then
      node tools/agent/gh.mjs comment "$ISSUE_NUMBER" "## 🤖 Agent triage

**Verdict:** $(verdict_badge "$(normalize_verdict "$(head -n 1 /tmp/issue-verdict.md)" INCONCLUSIVE)")

⚠️ **A later step failed after the verdict** — the full report is in the expo-bot-issue run logs on EAS.

_Posted by the expo-bot-issue EAS workflow._" || true
    else
      node tools/agent/gh.mjs comment "$ISSUE_NUMBER" "## 🤖 Agent triage

⚠️ **Triage errored before a verdict** — see the expo-bot-issue run logs on EAS, then comment \`@expo-bot\` here to retry.

_Posted by the expo-bot-issue EAS workflow._" || true
    fi
  fi
}
trap cleanup EXIT

if [ "${BUILD_STATUS:-}" = "failure" ]; then
  echo "Upstream simulator build failed; nothing to validate against."
  exit 1
fi
if [ "${REPACK_STATUS:-}" = "failure" ]; then
  echo "Repacking the binary with the base branch's JS failed; nothing to validate against."
  exit 1
fi
if [ -z "${BUILD_ID:-}" ]; then
  echo "BUILD_ID is empty; no simulator binary to validate against."
  exit 1
fi

mkdir -p "$EVIDENCE_DIR"

# Issue context for the replication prompt and the session name.
node tools/agent/gh.mjs get-issue "$ISSUE_NUMBER" > /tmp/issue-info.json
ISSUE_TITLE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/issue-info.json','utf8')).title)")

echo "Replicating issue #$ISSUE_NUMBER against binary $BUILD_ID (repacked or built with $BASE_BRANCH JS)"

# Named so the dashboard reads like a triage history. --build-id installs
# and launches the binary before the session is ready.
start_simulator_session "$(printf 'Issue #%s expo-bot: %s' "$ISSUE_NUMBER" "$ISSUE_TITLE")"

# The binary carries the base branch's JS as its embedded bundle, and its
# `simulator` update channel gets no publishes, so no update download
# replaces it. Give the launch a moment to settle.
sleep 15

# Deterministic floor beneath the AI replicator: the app rendered a home
# screen at all.
SNAPSHOT=$(bash tools/agent/argent.sh run describe --udid "$UDID")
echo "$SNAPSHOT" | tee /tmp/home-snapshot.txt
if [ -z "$SNAPSHOT" ]; then
  echo "❌ Validation failed: empty UI snapshot after launch."
  exit 1
fi

# The prompt lives in the repo (EAS caps workflow YAML at 16 kB).
cp tools/agent/prompts/expo-bot-issue.md /tmp/issue-prompt.md
printf '\nThe issue under triage is #%s: "%s".\n' "$ISSUE_NUMBER" "$ISSUE_TITLE" >> /tmp/issue-prompt.md
device_facts >> /tmp/issue-prompt.md
if [ -n "${INSTRUCTION:-}" ]; then
  printf '\nGuidance for this run (from the @expo-bot comment or the intake triage): %s\n' "$INSTRUCTION" >> /tmp/issue-prompt.md
fi

echo "Running Claude replicator..."
# The verdict file is the contract; Claude's own exit code is not. timeout
# is the hard backstop: a hung agent gets killed, leaves no verdict, and
# the run reports inconclusive.
rm -f /tmp/issue-verdict.md
timeout 20m npx --yes @anthropic-ai/claude-code@latest \
  -p "$(cat /tmp/issue-prompt.md)" \
  --model "$CLAUDE_MODEL" \
  --max-turns 120 \
  --output-format stream-json --verbose \
  --allowedTools "Bash(bash tools/agent/argent.sh*),Read,Glob,Grep,Write" \
  | node tools/agent/log-format.js || true

if [ ! -s /tmp/issue-verdict.md ]; then
  echo "INCONCLUSIVE: the replicator produced no verdict (agent error, timeout, or runaway)." > /tmp/issue-verdict.md
fi
# normalize_verdict collapses a doubled keyword ("CONFIRMED: REPLICATED: ...")
# to the one the agent meant; an unreadable line becomes INCONCLUSIVE.
VERDICT_LINE=$(normalize_verdict "$(head -n 1 /tmp/issue-verdict.md)" INCONCLUSIVE)
echo "================ VERDICT ================"
cat /tmp/issue-verdict.md
echo "========================================="

# The evidence site: the session's own artifacts (cpu/mem samples, the
# action timeline, the screen recording) plus the screenshots and the
# report, built by eas-simulator-evidence and deployed to EAS Hosting
# under a per-issue alias. sim-session.sh evidence stops the session first
# (it bills until then). A missing artifact never fails triage; a build or
# deploy failure does. --json puts the summary on the last stdout line.
RUN_JSON=$(bash tools/agent/sim-session.sh evidence "$EVIDENCE_DIR" \
  --subject "Issue #${ISSUE_NUMBER}" \
  --verdict "$VERDICT_LINE" --verdict-file /tmp/issue-verdict.md \
  --agent expo-bot --lane "Issue #${ISSUE_NUMBER}" --build-id "$BUILD_ID" \
  --deploy-alias "issue-${ISSUE_NUMBER}-evidence" --json)
EVIDENCE_URL=$(node -e "
  const last = process.argv[1].trim().split('\n').pop();
  console.log(JSON.parse(last).url ?? '');
" "$RUN_JSON")
echo "Evidence site: $EVIDENCE_URL"
export EVIDENCE_URL VERDICT_LINE

# Comment ingredients shared by every branch below.
VERDICT_SHOWN=$(verdict_badge "$VERDICT_LINE")
THUMBS=$(evidence_thumbs "$EVIDENCE_DIR" "$EVIDENCE_URL")
REPORT=$(tail -n +2 /tmp/issue-verdict.md)
PR_URL=""
VERIFY_RUN_URL=""

if [[ "$VERDICT_LINE" == REPLICATED* || "$VERDICT_LINE" == CONFIRMED* ]]; then
  # Replicated bug or confirmed feature gap: attempt an automated PR. A
  # fix failure must not eat the verdict; fall through to a
  # replicated-but-unfixed comment.
  if [[ "$VERDICT_LINE" == CONFIRMED* ]]; then
    PR_WORD="Implementation"
  else
    PR_WORD="Fix"
  fi
  bash tools/agent/fix-issue.sh || true
  PR_URL=$(cat /tmp/fix-pr-url 2>/dev/null || true)

  # fix-issue.sh dispatches expo-bot-verify on the PR unless AUTO_VERIFY is
  # "false"; tell the reporter where that verdict will land.
  VERIFY_RUN_URL=$(cat /tmp/fix-verify-run-url 2>/dev/null || true)
  VERIFY_LINE=""
  if [ -n "$VERIFY_RUN_URL" ]; then
    VERIFY_LINE="
- 🧪 **Verifying** — code review + a second cloud simulator; results land on the PR ([run](${VERIFY_RUN_URL}))"
  elif [ -n "$PR_URL" ]; then
    VERIFY_LINE="
- ⚠️ **Not verified** — comment \`@expo-bot\` on the PR to review and check it on a cloud simulator"
  fi

  if [ -n "$PR_URL" ]; then
    node tools/agent/gh.mjs comment "$ISSUE_NUMBER" "## 🤖 Agent triage

**Verdict:** ${VERDICT_SHOWN}

- 🔧 **${PR_WORD} PR** — ${PR_URL}${VERIFY_LINE}
- 🖼️ **Evidence** — ${EVIDENCE_URL}

${THUMBS}

<details>
<summary>Full report</summary>

${REPORT}

</details>

_Posted by the expo-bot-issue EAS workflow._"
  else
    # The fix agent's line 1 is "No fix: <reason>"; the bullet already
    # says no PR was opened, so keep just the reason. Test the file first:
    # it is missing when the agent hit its turn limit, and a bare
    # `head file | sed` under set -e + pipefail would exit this script.
    NO_FIX_REASON=""
    if [ -s /tmp/fix-summary.md ]; then
      NO_FIX_REASON=$(head -n 1 /tmp/fix-summary.md | sed -E 's/^No fix:[[:space:]]*//')
    fi
    [ -n "$NO_FIX_REASON" ] || NO_FIX_REASON="the fix agent errored or timed out; see the workflow logs."
    node tools/agent/gh.mjs comment "$ISSUE_NUMBER" "## 🤖 Agent triage

**Verdict:** ${VERDICT_SHOWN}

- ⚠️ **No PR opened** — ${NO_FIX_REASON} A human needs to pick this up.
- 🖼️ **Evidence** — ${EVIDENCE_URL}

${THUMBS}

<details>
<summary>Full report</summary>

${REPORT}

</details>

_Posted by the expo-bot-issue EAS workflow._"
  fi
else
  node tools/agent/gh.mjs comment "$ISSUE_NUMBER" "## 🤖 Agent triage

**Verdict:** ${VERDICT_SHOWN}

- 🖼️ **Evidence** — ${EVIDENCE_URL}

${THUMBS}

<details>
<summary>Full report</summary>

${REPORT}

</details>

_Posted by the expo-bot-issue EAS workflow. Missed something? Comment \`@expo-bot <hint>\` to retry._"
fi
COMMENT_POSTED=1

set-output evidence_url "$EVIDENCE_URL"
set-output verdict "$VERDICT_LINE"
# The same line with its status emoji, for the workflow's report doc.
set-output verdict_shown "$VERDICT_SHOWN"
set-output pr_url "${PR_URL:-none}"
set-output verify_run_url "${VERIFY_RUN_URL:-none}"
