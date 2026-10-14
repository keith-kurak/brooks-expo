/**
 * The shoes the runner owns, and how far each pair has gone.
 *
 * @ref LLP 0006#the-owned-shoes-store — Pairs live on the device, in the same
 * synchronous storage as the cart and the member, so the Shoes tab and the
 * widget know every pair before the first frame. The miles from the last
 * Health read are stored with them: Health is only read after the app has
 * asked once, and a cold launch should not show "0 mi" until it has.
 *
 * Every change republishes the widget. @ref LLP 0006#the-widget-reads-the-app-group
 */
import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
import { isAppClip } from '../utils/app-clip';
import {
  formatMileage,
  mileageOf,
  readShoeMiles,
  type OwnedShoe,
  type ShoeHealthMiles,
} from '../data/mileage';
import { storage } from '../utils/kv-storage';
import { catalog } from '../data/catalog';
import { brooksImage, heroImage } from '../data/images';
import { byId, colorwayOf } from '../data/query';
import { shoeImageFile, updateShoeMileageWidget } from '../widgets/shoe-mileage';
import { hasEnrolledChallenge, refreshChallenges, subscribeChallenges } from './challenges';

const SHOES_KEY = 'brooks.shoes.v1';
const MILES_KEY = 'brooks.shoes.miles.v1';
const HEALTH_SYNC_TASK = 'brooks.shoe-mileage';

// The Clip and older development binaries can omit these native modules.
const background = !isAppClip && BrooksActivity?.isAvailable() &&
  requireOptionalNativeModule('ExpoBackgroundTask') && requireOptionalNativeModule('ExpoTaskManager')
  ? {
      tasks: require('expo-task-manager') as typeof import('expo-task-manager'),
      scheduler: require('expo-background-task') as typeof import('expo-background-task'),
    }
  : null;

interface StoredMiles {
  byShoe: Record<string, ShoeHealthMiles>;
  /** When Health was last read, or null if it never has been. */
  readAt: number | null;
}

export interface ShoesState extends StoredMiles {
  shoes: OwnedShoe[];
}

let state: ShoesState = {
  shoes: storage.get<OwnedShoe[]>(SHOES_KEY, []),
  ...storage.get<StoredMiles>(MILES_KEY, { byShoe: {}, readAt: null }),
};
const listeners = new Set<() => void>();

function commit(next: ShoesState) {
  state = next;
  storage.set(SHOES_KEY, state.shoes);
  storage.set<StoredMiles>(MILES_KEY, { byShoe: state.byShoe, readAt: state.readAt });
  publishWidget();
  for (const l of listeners) l();
  void reconcileBackgroundSync();
}

export function getShoesState(): ShoesState {
  return state;
}

export function useShoes(): ShoesState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state
  );
}

export function activeShoes(s: ShoesState): OwnedShoe[] {
  return s.shoes.filter((shoe) => shoe.retiredAt == null);
}

/** The active pair closest to its limit: the one the widget and Home show. */
export function mostWornShoe(s: ShoesState): OwnedShoe | null {
  let best: OwnedShoe | null = null;
  let bestShare = -1;
  for (const shoe of activeShoes(s)) {
    const share = mileageOf(shoe, s.byShoe[shoe.id]).share;
    if (share > bestShare) {
      best = shoe;
      bestShare = share;
    }
  }
  return best;
}

export function addShoe(input: Omit<OwnedShoe, 'id' | 'addedAt' | 'retiredAt'>): OwnedShoe {
  const shoe: OwnedShoe = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    addedAt: Date.now(),
    retiredAt: null,
  };
  commit({ ...state, shoes: [shoe, ...state.shoes] });
  return shoe;
}

export function retireShoe(id: string) {
  commit({
    ...state,
    shoes: state.shoes.map((s) => (s.id === id ? { ...s, retiredAt: Date.now() } : s)),
  });
}

export function removeShoe(id: string) {
  const { [id]: _gone, ...byShoe } = state.byShoe;
  commit({ ...state, shoes: state.shoes.filter((s) => s.id !== id), byShoe });
}

let reading: Promise<boolean> = Promise.resolve(true);
let registering: Promise<void> = Promise.resolve();

/** Keep one job while Health has been requested and shoes or a weekly challenge need it. */
export function reconcileBackgroundSync(): Promise<void> {
  registering = registering.then(async () => {
    if (!background || !(await background.tasks.isAvailableAsync())) return;
    const registered = await background.tasks.isTaskRegisteredAsync(HEALTH_SYNC_TASK);
    const shouldRun = (activeShoes(state).length > 0 || hasEnrolledChallenge()) &&
      !(await BrooksActivity!.shouldRequestAccessAsync());
    if (!shouldRun) {
      if (registered) await background.scheduler.unregisterTaskAsync(HEALTH_SYNC_TASK);
    } else if (!registered && await background.scheduler.getStatusAsync() === background.scheduler.BackgroundTaskStatus.Available) {
      await background.scheduler.registerTaskAsync(HEALTH_SYNC_TASK, { minimumInterval: 60 });
    }
  }).catch(() => {
    // Foreground mileage still works if scheduling is unavailable. Retry next time.
  });
  return registering;
}

/**
 * Both foreground refresh and the scheduled task use the same read, cache and
 * widget publisher. A failed read keeps the previous totals and timestamp.
 * `ask` is only passed by a user tap; the background task never prompts.
 * @ref LLP 0006#background-health-sync
 */
export function refreshMileage({ ask = false }: { ask?: boolean } = {}): Promise<boolean> {
  if (isAppClip) return Promise.resolve(true);
  reading = reading.then(async () => {
    try {
      // A pair can be added, retired or removed while Health is reading. Reread
      // against the new list rather than committing totals for the old window.
      let shoes: OwnedShoe[];
      let read: Record<string, ShoeHealthMiles> | null;
      do {
        shoes = state.shoes;
        read = await readShoeMiles(shoes, { ask });
        ask = false;
      } while (shoes !== state.shoes);
      if (read) commit({ ...state, byShoe: read, readAt: Date.now() });
      return true;
    } catch {
      return false;
    } finally {
      void reconcileBackgroundSync();
    }
  });
  return reading;
}

/**
 * Reads Health at launch and each time the app comes back to the front, so
 * the miles (and the widget) catch up with runs logged while the app was
 * away. Never asks: it reads only once the shopper has answered the Health
 * sheet from a tap. Mounted once, by the root layout.
 *
 * @ref LLP 0006#background-health-sync — Foreground refresh catches up
 * even when iOS has deferred the scheduled background task.
 */
export function useMileageSync() {
  useEffect(() => {
    if (isAppClip) return;
    refreshMileage();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshMileage();
    });
    return () => sub.remove();
  }, []);
}

/**
 * Sends the most-worn pair to the widget, as finished strings: the widget's
 * runtime can import nothing and compute little.
 * @ref LLP 0006#the-widget-reads-the-app-group
 */
function publishWidget() {
  if (isAppClip) return;
  const shoe = mostWornShoe(state);
  // The groups are named on purpose: a bare `/shoes` matches the first clone
  // of the array group, so it pushed the screen onto Home's stack, with a
  // back button, instead of opening the Shoes tab.
  const url = Linking.createURL('/(tabs)/(shoes)/shoes');
  if (!shoe) {
    updateShoeMileageWidget({ hasShoe: false, name: '', share: 0, percent: '', status: '', miles: '', milesShort: '', limit: '', pace: '', replace: false, url, image: '' });
    return;
  }
  const m = mileageOf(shoe, state.byShoe[shoe.id]);
  const weeks = m.weeksLeft == null || m.milesLeft <= 0 ? null : Math.max(1, Math.round(m.weeksLeft));
  updateShoeMileageWidget({
    hasShoe: true,
    name: shoe.name,
    share: Math.min(1, m.share),
    percent: `${m.percent}%`,
    status: m.replace ? 'Time to replace' : `${formatMileage(m.milesLeft)} mi left`,
    miles: m.milesLabel,
    milesShort: formatMileage(m.totalMiles),
    limit: `${formatMileage(m.limitMiles)} mi`,
    pace: weeks == null ? '' : `About ${weeks} ${weeks === 1 ? 'week' : 'weeks'} left`,
    replace: m.replace,
    url,
    image: widgetPhoto(shoe) ?? '',
  });
}

/**
 * The pair's catalog photo, copied into the App Group for the widget. A pair
 * typed in by hand has no photo; the widget shows its name instead. The first
 * publish for a pair has no file yet, so the download publishes again.
 * @ref LLP 0006#the-widget-design
 */
function widgetPhoto(shoe: OwnedShoe): string | null {
  const product = shoe.productId ? byId(catalog, shoe.productId) : undefined;
  if (!product) return null;
  const colorway = colorwayOf(product, shoe.colorCode ?? undefined);
  // Square: the CDN ignores a 2:1 box and returns a square anyway. The widget
  // crops it to the shoe.
  const url = brooksImage(heroImage(colorway.images), { width: 600 });
  return shoeImageFile(`${product.id}-${colorway.code}-600`, url, publishWidget);
}

/** The app pushes the stored state once at launch, so a reinstall or an update repaints the widget. */
publishWidget();

// @ref LLP 0008#weekly-challenge-implementation — One scheduler job serves shoes and enrolled challenges.
subscribeChallenges(() => { void reconcileBackgroundSync(); });

// Imported by index.ts before Expo Router, so a headless launch defines the
// task without mounting a screen. @ref LLP 0006#background-health-sync
background?.tasks.defineTask(HEALTH_SYNC_TASK, async ({ error }) => {
  const { BackgroundTaskResult } = background.scheduler;
  if (error) return BackgroundTaskResult.Failed;
  const results = await Promise.all([refreshMileage(), refreshChallenges()]);
  return results.every(Boolean) ? BackgroundTaskResult.Success : BackgroundTaskResult.Failed;
});
