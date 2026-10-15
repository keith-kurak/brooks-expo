// Bug-bash overrides on top of e2e.config.ts: exploration budgets, the
// postures as personas, and what an explorer must know about Brooks so it
// does not report the demo's intended limits as bugs. Follow
// `npx e2e guide bug-bash` with `--config e2e.bugbash.config.ts`, and the
// project steps in .claude/skills/e2e-bug-bash. @ref LLP 0009#e2e-bug-bash
//
// Every `e2e explore` run leases its own hosted simulator through the base
// target's EAS provider, so explorers never share a device; four at a time
// is four billed EAS Simulator sessions.
import type { E2EConfig } from 'e2e';
import base, { model, tools } from './e2e.config';

const shared: E2EConfig = base;

const context =
  'This is Brooks, a running-shoe shopping demo on an iOS simulator, loaded from a development server. ' +
  'Products, prices, stock, and reviews are bundled with the app; search and product photos load from the network, so scroll and wait before calling an image blank. ' +
  'The four tabs are Home, Browse, Cart, and Profile; their labels are hidden, so read each tab by its accessibility label. ' +
  'Sign-in is email only and stored on this device: no password, no server, and "Continue as guest" is always offered. ' +
  'The Checkout button intentionally does nothing; no order is ever placed. ' +
  'The simulator has no Apple Health data, so Health-based screens (Shoe Finder, Health data, shoe mileage, weekly challenge progress) show empty, permission, or no-data states; that is the simulator, not a bug. ' +
  'The weekly challenge prize is a labeled demo promotion. ' +
  'Never report a development-server banner, a Fast Refresh message, or a slow first load as an app bug.';

// Exploration needs 40 or more steps and model calls per step (guide, step 1).
const persona = { model, tools, maxSteps: 40, maxModelCalls: 40, context };

export default {
  ...shared,
  // The project's tests plus the repro tests the verify step writes.
  tests: [shared.tests ?? 'e2e/**/*.e2e.ts', 'e2e/bugbash/**/*.e2e.ts'].flat(),
  retries: 0,
  reporters: ['list'],
  video: 'on',
  agents: {
    ...shared.agents,
    default: persona,
    skeptic: {
      ...persona,
      system:
        'Distrust every number, price, size, count, and claim on screen; cross-check each against every other place it appears (product page, cart, badges, totals).',
    },
    fuzzer: {
      ...persona,
      system:
        "At every input, run the goal's input matrix before anything else, judging each entry before the next. Never take the happy path.",
    },
  },
} satisfies E2EConfig;
