#!/usr/bin/env bash
# Thin wrapper for the TestFlight intake job: picks the token, runs the
# intake script, and publishes its result as step outputs.
# Requires: FEEDBACK_KIND (screenshot|crash), GH_REPO, GITHUB_TOKEN,
#           BASE_BRANCH, EXPO_TOKEN_SIMULATOR (or an EXPO_TOKEN that can
#           read the project's App Store Connect API key)
# Optional: ASC_FEEDBACK_ID (trigger context),
#           CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY (agent triage)
set -euo pipefail

# The worker's auto-injected EXPO_TOKEN is restricted-scope. The personal
# token used for simulator sessions can read credentials and dispatch
# workflows, so prefer it, matching the other expo-bot scripts.
if [ -n "${EXPO_TOKEN_SIMULATOR:-}" ]; then
  export EXPO_TOKEN="$EXPO_TOKEN_SIMULATOR"
fi
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is not set; add a GitHub token with issues write"
  echo "access as a secret env var in the production EAS environment."
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "No CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY: filing a plain issue without agent triage."
fi

node tools/agent/intake-testflight.mjs

RESULT=/tmp/testflight/result.json
if [ ! -s "$RESULT" ]; then
  echo "intake-testflight.mjs wrote no result file."
  exit 1
fi
field() { node -e "console.log(JSON.parse(require('fs').readFileSync('$RESULT','utf8')).$1 ?? '')"; }

set-output issue_number "$(field issue_number)"
set-output issue_url "$(field issue_url)"
set-output run_url "$(field run_url)"
set-output kind "$(field kind)"

# A duplicate submission was added to the existing issue; nothing to
# dispatch, and the job is green.
if [ "$(field duplicate)" = "true" ]; then
  echo "Duplicate of issue #$(field issue_number); no new issue or triage run."
  exit 0
fi

# A filed issue with no triage run is a partial success: the issue
# comment says how to retry, and the job goes red so it is noticed.
if [ -z "$(field run_url)" ]; then
  echo "Issue filed but the expo-bot dispatch failed; see above."
  exit 1
fi
