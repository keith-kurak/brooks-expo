#!/usr/bin/env bash
# SessionStart hook: reminds every session in every worktree that on-device
# testing defaults to an EAS cloud iOS simulator (AGENTS.md, "Testing on a
# device"). It prints the hook JSON; the text goes into the model's context.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

msg="On-device testing in this repo defaults to an EAS cloud iOS simulator: use the eas-sim-dev skill for any reproduction, UI check, fix verification, or screenshots, without asking first. This overrides general device-selection rules such as \"prefer a running local simulator\". Use a local simulator or an Android emulator only when the user asks for one. One cloud iOS simulator per worktree; stop it when the task is done. To show a person iOS and Android together, use eas-sim-preview. For Expo commands (status, install, typecheck, doctor, start, runtime:reload/errors/tree), favor npx @expo/agent-cli, but not its dev --ios, smoke, or --eas commands here. Open pull requests only on the fork keith-kurak/brooks-expo (gh pr create --repo keith-kurak/brooks-expo --base main), never on upstream SchroederNathan/brooks-expo. (AGENTS.md, \"Expo commands\", \"Pull requests\", and \"Testing on a device\".)"

# A session id in this worktree's dotenv may belong to a session that is
# still running; the skill checks it before starting another.
if [ -f .env.eas-simulator ] && grep -q '^EAS_SIMULATOR_SESSION_ID=' .env.eas-simulator; then
  msg="$msg This worktree's .env.eas-simulator names a session id from an earlier run. Check it with \`npx --yes eas-cli@latest simulator:get --json\` before you start a new one."
fi

node -e '
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: process.argv[1] },
  }));
' "$msg"
