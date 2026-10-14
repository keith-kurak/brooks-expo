#!/usr/bin/env bash
# Boots an EAS cloud simulator with the binary the workflow repacked (or
# built) with this PR's JS, lets Claude Code verify the PR (screenshots
# into evidence/), deploys the evidence to EAS Hosting, comments the result
# on the PR, and emits step outputs.
# Requires: BUILD_ID, PR_NUMBER, GH_REPO, GITHUB_TOKEN, EXPO_TOKEN_SIMULATOR,
#           CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# Optional: INSTRUCTION (reviewer guidance from the @expo-bot comment, or
#           the issue verdict when fix-issue.sh dispatched this run)
#           BUILD_STATUS, REPACK_STATUS (upstream job statuses)
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
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is not set; add a GitHub token with pull-request write"
  echo "access as a secret env var in the production EAS environment."
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Neither CLAUDE_CODE_OAUTH_TOKEN nor ANTHROPIC_API_KEY is set."
  exit 1
fi
# The session bills until stopped, and a run that dies before commenting
# would leave the PR silent; the trap covers both. A reached verdict is
# reported as the verdict even when a later step (evidence deploy,
# comment) failed.
COMMENT_POSTED=""
cleanup() {
  code=$?
  npx --yes eas-cli@latest simulator:stop --non-interactive >/dev/null 2>&1 || true
  if [ "$code" -ne 0 ] && [ -z "$COMMENT_POSTED" ]; then
    if [ -s /tmp/verify-verdict.md ]; then
      node tools/agent/gh.mjs comment "$PR_NUMBER" "## 🤖 Agent verification

**Verdict:** $(verdict_badge "$(normalize_verdict "$(head -n 1 /tmp/verify-verdict.md)")")

⚠️ **A later step failed after the verdict** — the full report is in the expo-bot-verify run logs on EAS.

_Posted by the expo-bot-verify EAS workflow._" || true
    else
      node tools/agent/gh.mjs comment "$PR_NUMBER" "## 🤖 Agent verification

⚠️ **Verification errored before a verdict** — see the expo-bot-verify run logs on EAS, then comment \`@expo-bot review\` to retry.

_Posted by the expo-bot-verify EAS workflow._" || true
    fi
  fi
}
trap cleanup EXIT

if [ "${BUILD_STATUS:-}" = "failure" ]; then
  echo "Upstream simulator build failed; nothing to verify."
  exit 1
fi
if [ "${REPACK_STATUS:-}" = "failure" ]; then
  echo "Repacking the binary with the PR's JS failed; nothing to verify."
  exit 1
fi
if [ -z "${BUILD_ID:-}" ]; then
  echo "BUILD_ID is empty; no simulator binary to verify against."
  exit 1
fi

mkdir -p "$EVIDENCE_DIR"

# PR context for the verifier prompt and the session name.
node tools/agent/gh.mjs get-pr "$PR_NUMBER" > /tmp/pr-info.json
PR_TITLE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/pr-info.json','utf8')).title)")
node tools/agent/gh.mjs get-pr-diff "$PR_NUMBER" > /tmp/pr.diff
if [ "$(wc -c < /tmp/pr.diff)" -gt 150000 ]; then
  head -c 150000 /tmp/pr.diff > /tmp/pr.diff.capped
  printf '\n\n[diff truncated at 150 kB]\n' >> /tmp/pr.diff.capped
  mv /tmp/pr.diff.capped /tmp/pr.diff
fi

echo "Verifying binary $BUILD_ID (repacked or built with this PR's JS)"

# Named so the dashboard reads like a history of verified PRs.
start_simulator_session "$(printf 'PR #%s expo-bot: %s' "$PR_NUMBER" "$PR_TITLE")"

# The binary carries this PR's JS as its embedded bundle. Its update
# channel is `simulator` (eas.json), which nothing publishes to, so no
# downloaded update replaces that bundle. Give the launch a moment to settle.
# @ref LLP 0009#the-simulator-binary
sleep 15

# Deterministic floor beneath the AI verifier: the app rendered a home
# screen at all.
SNAPSHOT=$(bash tools/agent/argent.sh run describe --udid "$UDID")
echo "$SNAPSHOT" | tee /tmp/home-snapshot.txt
if [ -z "$SNAPSHOT" ]; then
  echo "❌ Verification failed: empty UI snapshot after launch."
  exit 1
fi

# The prompt lives in the repo (EAS caps workflow YAML at 16 kB).
cp tools/agent/prompts/expo-bot-verify.md /tmp/verify-prompt.md
printf '\nThe PR under test is #%s: "%s".\n' "$PR_NUMBER" "$PR_TITLE" >> /tmp/verify-prompt.md
device_facts >> /tmp/verify-prompt.md
if [ -n "${INSTRUCTION:-}" ]; then
  printf '\nReviewer guidance for this run: %s\n' "$INSTRUCTION" >> /tmp/verify-prompt.md
fi

echo "Running Claude verifier..."
# The verdict file is the contract; Claude's own exit code is not. timeout
# is the hard backstop: a hung agent gets killed, leaves no verdict, and
# the run fails closed.
timeout 20m npx --yes @anthropic-ai/claude-code@latest \
  -p "$(cat /tmp/verify-prompt.md)" \
  --model "$CLAUDE_MODEL" \
  --max-turns 120 \
  --output-format stream-json --verbose \
  --allowedTools "Bash(bash tools/agent/argent.sh*),Read,Glob,Grep,Write" \
  | node tools/agent/log-format.js || true

if [ ! -s /tmp/verify-verdict.md ]; then
  echo "FAIL: verifier produced no verdict file (agent error, timeout, or runaway)." > /tmp/verify-verdict.md
fi
# normalize_verdict makes line 1 unambiguous: "PASS: FAIL: ..." is a
# FAIL, not the PASS a plain glob would read.
VERDICT_LINE=$(normalize_verdict "$(head -n 1 /tmp/verify-verdict.md)")
echo "================ VERDICT ================"
cat /tmp/verify-verdict.md
echo "========================================="

# The evidence site, deployed to EAS Hosting under a per-PR alias. See
# validate-issue.sh for what --stop, --json, --name, and --slug do.
RUN_JSON=$(evidence_tool run "$EVIDENCE_DIR" --stop \
  --subject "PR #${PR_NUMBER}" \
  --verdict "$VERDICT_LINE" --verdict-file /tmp/verify-verdict.md \
  --name "$APP_NAME" --slug "$APP_SLUG" \
  --agent expo-bot --lane "PR #${PR_NUMBER}" --build-id "$BUILD_ID" \
  --deploy-alias "pr-${PR_NUMBER}-evidence" --json)
EVIDENCE_URL=$(node -e "
  const last = process.argv[1].trim().split('\n').pop();
  console.log(JSON.parse(last).url ?? '');
" "$RUN_JSON")
echo "Evidence site: $EVIDENCE_URL"

# Same shape as every bot post. The package prints it: the verdict line is
# the normalized one above, and the rest of the verdict file is the report.
node tools/agent/gh.mjs comment "$PR_NUMBER" "$(evidence_tool comment "$EVIDENCE_DIR" "$EVIDENCE_URL" \
  --verdict "$VERDICT_LINE" --verdict-file /tmp/verify-verdict.md \
  --title "Agent verification" \
  --agent "the expo-bot-verify EAS workflow")"
COMMENT_POSTED=1

set-output evidence_url "$EVIDENCE_URL"
set-output verdict "$VERDICT_LINE"
# The same line with its status emoji, for the workflow's report doc.
set-output verdict_shown "$(verdict_badge "$VERDICT_LINE")"
