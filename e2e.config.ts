// e2e (TesterArmy) on EAS Simulators, against this worktree's dev server.
//
// The target leases one hosted iOS simulator per worker from EAS
// (@e2e-dev/eas). EAS installs the `development-simulator` dev-client build
// named by E2E_BUILD_ID, and every fresh launch opens the dev server at
// E2E_METRO_URL, so tests and bug-bash explorers see this branch's
// JavaScript, not a build's embedded bundle. The cloud device reaches Metro
// only through the Expo tunnel, so E2E_METRO_URL is the https tunnel URL.
// @ref LLP 0009#e2e-bug-bash
//
//   E2E_BUILD_ID=$(bash tools/agent/sim-session.sh dev-build)
//   E2E_METRO_URL=$(bash tools/agent/sim-session.sh metro-url <port>)
//   ANTHROPIC_API_KEY=<key> npx e2e run
//
// EAS auth: EXPO_TOKEN, else the `eas login` session. Model: E2E_MODEL
// (default claude-sonnet-5-5) through ANTHROPIC_API_KEY.
import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { mobileTools } from '@e2e-dev/mobile/tools';
import { easSimulators } from '@e2e-dev/eas';
import { anthropic } from '@ai-sdk/anthropic';
// brand.config.js is CommonJS (app.config.ts and Metro read it too); e2e loads
// this file as an ES module, which imports module.exports as the default.
import brandConfig from './brand.config.js';

const { brand } = brandConfig;

const buildId = process.env.E2E_BUILD_ID;
const metroUrl = process.env.E2E_METRO_URL;
if (!buildId || !metroUrl) {
  throw new Error(
    'e2e needs E2E_BUILD_ID (bash tools/agent/sim-session.sh dev-build) and ' +
      'E2E_METRO_URL (bash tools/agent/sim-session.sh metro-url <port>, a tunneled Metro).',
  );
}

export const iphone = mobile({
  platform: 'ios',
  device: easSimulators({ buildId, tags: ['e2e'] }),
  // Drawing touches into a recording outlasts cleanup on an EAS iOS simulator.
  videoTouches: false,
});

// Named so e2e.bugbash.config.ts builds its personas on the same model and tools.
export const model = anthropic(process.env.E2E_MODEL ?? 'claude-sonnet-5-5');
export const tools = mobileTools(iphone);

export default {
  tests: 'e2e/**/*.e2e.ts',
  // One hosted simulator, and one billed EAS session, per worker.
  workers: Number(process.env.E2E_WORKERS ?? 1),
  // A remote device plus agent judgments runs slower than a local one.
  timeout: 240_000,
  targets: [
    {
      name: 'ios',
      engine: iphone,
      app: {
        bundleId: brand.bundleIdentifier,
        // Every fresh launch loads the dev server, with the dev menu out of
        // the way (UserDefaults launch arguments of expo-dev-menu).
        launchArguments: [
          '--initialUrl',
          metroUrl,
          '-EXDevMenuShowsAtLaunch',
          'NO',
          '-EXDevMenuIsOnboardingFinished',
          'YES',
          '-EXDevMenuShowFloatingActionButton',
          'NO',
        ],
      },
    },
  ],
  agents: {
    default: { model, tools },
  },
} satisfies E2EConfig;
