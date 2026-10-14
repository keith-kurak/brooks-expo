#!/usr/bin/env bash
# Claude Code reviews the PR diff and posts a review comment on the PR.
# The workflow is dispatched from a comment, so there is no pull_request
# context and the checkout may lack git metadata, so the diff comes from the
# GitHub API instead of git.
# Requires: PR_NUMBER, GH_REPO, GITHUB_TOKEN,
#           CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# @ref LLP 0009#the-pipeline
set -euo pipefail

# shellcheck disable=SC1091
. tools/agent/comment-lib.sh

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is not set; add a GitHub token with pull-request write"
  echo "access as a secret env var in the production EAS environment."
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Neither CLAUDE_CODE_OAUTH_TOKEN nor ANTHROPIC_API_KEY is set."
  exit 1
fi

# A run that dies before commenting would leave the PR silent.
COMMENT_POSTED=""
cleanup() {
  code=$?
  if [ "$code" -ne 0 ] && [ -z "$COMMENT_POSTED" ]; then
    node tools/agent/gh.mjs comment "$PR_NUMBER" "## 🤖 Automated code review

⚠️ **Review errored before it could complete** — see the expo-bot-verify run logs on EAS.

_Posted by the expo-bot-verify EAS workflow._" || true
  fi
}
trap cleanup EXIT

node tools/agent/gh.mjs get-pr "$PR_NUMBER" > /tmp/pr-info.json
node tools/agent/gh.mjs get-pr-diff "$PR_NUMBER" > /tmp/pr.diff

# Keep the diff within a sane prompt budget.
if [ "$(wc -c < /tmp/pr.diff)" -gt 150000 ]; then
  head -c 150000 /tmp/pr.diff > /tmp/pr.diff.capped
  printf '\n\n[diff truncated at 150 kB]\n' >> /tmp/pr.diff.capped
  mv /tmp/pr.diff.capped /tmp/pr.diff
fi

PROMPT=$(cat <<'EOF'
Review this pull request diff for Brooks, an Expo SDK 57 running-shoe
shopping app (iOS and Android). AGENTS.md has the project rules; LLPs in
llp/ explain the decisions that `@ref LLP NNNN#section` comments point
to. The diff is in /tmp/pr.diff and the PR title and body are in
/tmp/pr-info.json. You may read the project source (current working
directory) for context.

Write a concise code review in GitHub Markdown to /tmp/review.md, in
exactly this shape (fill in the angle-bracket parts, keep everything
else verbatim; lines 1-3 are shown, the rest is folded away):

**Verdict:** ✅ LGTM

**Summary** — <one line: what the change does and whether it is safe>

1. 🎯 **Correctness** — <does the change do what the PR says? Name the
   edge cases you checked>
2. 🐛 **Bugs and risks** — <real problems found, most severe first,
   or "None found."; skip style nits>

Use "**Verdict:** ⚠️ Needs changes" instead when you find a real
problem. Keep the whole review under 200 words.
EOF
)

# The review file is the contract; Claude's own exit code is not.
timeout 10m npx --yes @anthropic-ai/claude-code@latest \
  -p "$PROMPT" \
  --model "$CLAUDE_MODEL" \
  --max-turns 40 \
  --output-format stream-json --verbose \
  --allowedTools "Read Write Glob Grep" \
  | node tools/agent/log-format.js || true

if [ ! -s /tmp/review.md ]; then
  echo "**Verdict:** ⚠️ Review errored: the reviewer produced no output. See the workflow logs." > /tmp/review.md
fi

# Verdict and summary stay visible; the numbered notes fold away.
REVIEW_HEAD=$(head -n 3 /tmp/review.md)
REVIEW_NOTES=$(tail -n +4 /tmp/review.md | sed '/./,$!d')
NOTES_BLOCK=""
if [ -n "$REVIEW_NOTES" ]; then
  NOTES_BLOCK="
<details>
<summary>Review notes</summary>

${REVIEW_NOTES}

</details>
"
fi
node tools/agent/gh.mjs comment "$PR_NUMBER" "## 🤖 Automated code review

${REVIEW_HEAD}
${NOTES_BLOCK}
_Posted by the expo-bot-verify EAS workflow._"
COMMENT_POSTED=1
