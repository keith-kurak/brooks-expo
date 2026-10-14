#!/usr/bin/env bash
# Applies the reviewer's @expo-bot instruction to the checked-out PR
# branch: a Claude Code agent edits the code, the type check must pass,
# and the result is committed and pushed to the PR head. Posts a summary
# comment on the PR either way. Runs in the GitHub Action bridge.
# Requires: INSTRUCTION, PR_NUMBER, GH_TOKEN,
#           CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# @ref LLP 0009#the-gates
set -euo pipefail

SUMMARY_FILE=/tmp/expo-bot-change-summary.md
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-5-5}"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  gh pr comment "$PR_NUMBER" --body "## 🤖 Agent iteration

⚠️ **Change modes need a CLAUDE_CODE_OAUTH_TOKEN** (or ANTHROPIC_API_KEY) repository secret. Add one and comment again, or use \`@expo-bot review\`, which works without it.

_Posted by the expo-bot bridge._"
  exit 1
fi

rm -f "$SUMMARY_FILE"
cp tools/agent/prompts/expo-bot-change.md /tmp/change-prompt.md
printf '\nThe requested change (from the @expo-bot comment on PR #%s): %s\n' \
  "$PR_NUMBER" "$INSTRUCTION" >> /tmp/change-prompt.md

echo "Running Claude change agent..."
# The summary file is the contract; Claude's own exit code is not.
timeout 10m npx --yes @anthropic-ai/claude-code@latest \
  -p "$(cat /tmp/change-prompt.md)" \
  --model "$CLAUDE_MODEL" \
  --max-turns 60 \
  --output-format stream-json --verbose \
  --allowedTools "Edit,Write,Read,Glob,Grep,Bash(bun run typecheck),Bash(bun run test:*)" \
  | node tools/agent/log-format.js || true

if [ -z "$(git status --porcelain)" ]; then
  REASON=$(cat "$SUMMARY_FILE" 2>/dev/null || echo "The agent gave no reason (error or timeout).")
  gh pr comment "$PR_NUMBER" --body "## 🤖 Agent iteration

**Requested:** _${INSTRUCTION}_

⚠️ **No change made** — ${REASON}

_Posted by the expo-bot bridge._"
  exit 1
fi

# Hard gate: never push code that does not type-check.
bun run typecheck

SUMMARY_LINE=$(head -n 1 "$SUMMARY_FILE" 2>/dev/null || true)
[ -n "$SUMMARY_LINE" ] || SUMMARY_LINE="$INSTRUCTION"

git config user.name "expo-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "expo-bot: ${SUMMARY_LINE}" \
  -m "Requested via an @expo-bot comment on PR #${PR_NUMBER}."
git push
COMMIT_SHA=$(git rev-parse --short HEAD)

DETAILS=$(tail -n +2 "$SUMMARY_FILE" 2>/dev/null || true)
# Same shape as every bot post: "## 🤖 <stage>", bold label lines, the
# agent's write-up, a "_Posted by_" footer.
gh pr comment "$PR_NUMBER" --body "## 🤖 Agent iteration

**Requested:** _${INSTRUCTION}_

✅ **Applied** — ${SUMMARY_LINE} (\`${COMMIT_SHA}\`, type check passed)

${DETAILS}

_Posted by the expo-bot bridge._"
