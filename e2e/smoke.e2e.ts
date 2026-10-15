// The setup check: a hosted simulator launches the dev build, the dev build
// loads this worktree's Metro, and the agent can see the app.
import { test } from '@e2e-dev/mobile';

test('Smoke: the app loads from the dev server and shows the Home tab', async ({ app, agent }) => {
  await app.open();
  await agent.assert(
    'a running-shoe store app is showing its Home screen, not the development-build launcher, a red error screen, or a blank screen',
  );
});
