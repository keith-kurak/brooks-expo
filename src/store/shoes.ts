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
import * as Linking from 'expo-linking';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
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
import { isAppClip } from '../utils/app-clip';

const SHOES_KEY = 'brooks.shoes.v1';
const MILES_KEY = 'brooks.shoes.miles.v1';
const nativeMileage = !isAppClip && BrooksActivity?.isAvailable() &&
  BrooksActivity.configureShoeMileage && BrooksActivity.getShoeMileageSnapshot &&
  BrooksActivity.refreshShoeMileageAsync ? BrooksActivity : null;

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
  publishWidget();
  storage.set<StoredMiles>(MILES_KEY, { byShoe: state.byShoe, readAt: state.readAt });
  for (const l of listeners) l();
}

function nativeSnapshot(json: string): StoredMiles {
  const snapshot: StoredMiles = JSON.parse(json);
  return {
    byShoe: Object.fromEntries(Object.entries(snapshot.byShoe).map(([id, miles]) => [
      id, { ...miles, weeklyMiles: miles.weeklyMiles ?? null },
    ])),
    readAt: snapshot.readAt ?? null,
  };
}

function receiveNativeMileage() {
  if (nativeMileage) commit({ ...state, ...nativeSnapshot(nativeMileage.getShoeMileageSnapshot!()) });
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

let reading: Promise<void> = Promise.resolve();

/**
 * Reads Health again and stores each pair's miles. `ask` may show the Health
 * sheet; pass it only from a tap. Failures keep the last read: stale miles are
 * better than none.
 *
 * Reads run one after another. A read that is already running started before
 * the latest change (a pair just added) and without `ask`, so a new call
 * queues behind it rather than reusing it.
 */
export function refreshMileage({ ask = false }: { ask?: boolean } = {}): Promise<void> {
  if (isAppClip) return Promise.resolve();
  reading = reading.then(async () => {
    try {
      if (nativeMileage) {
        receiveNativeMileage();
        if (ask) await nativeMileage.requestAccessAsync();
        await nativeMileage.refreshShoeMileageAsync!();
        // Read the current snapshot, not an earlier queued event's payload.
        receiveNativeMileage();
        return;
      }
      const read = await readShoeMiles(state.shoes, { ask });
      if (read) commit({ ...state, byShoe: read, readAt: Date.now() });
    } catch {
      // Keep the last read.
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
 * @ref LLP 0006#background-health-sync — Native code also refreshes while JS
 * is suspended. Import that result before the foreground read or any publish.
 */
export function useMileageSync() {
  useEffect(() => {
    if (isAppClip) return;
    const health = nativeMileage?.addListener('onShoeMileageUpdated', receiveNativeMileage);
    refreshMileage();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshMileage();
    });
    return () => {
      health?.remove();
      sub.remove();
    };
  }, []);
}

/**
 * Sends the most-worn pair to the widget, as finished strings: the widget's
 * runtime can import nothing and compute little.
 * @ref LLP 0006#the-widget-reads-the-app-group
 */
function publishWidget() {
  if (isAppClip) return;
  // Keep only shoe configuration and cached photo paths in native storage.
  // Native code owns the totals and widget publication on current iOS builds.
  // @ref LLP 0006#background-health-sync
  if (nativeMileage) {
    const configuration = {
      shoes: state.shoes.map((shoe) => ({ ...shoe, image: shoe.retiredAt == null ? widgetPhoto(shoe) ?? '' : '' })),
      url: Linking.createURL('/(tabs)/(shoes)/shoes'),
    };
    const initial = { byShoe: state.byShoe, readAt: state.readAt };
    state = { ...state, ...nativeSnapshot(nativeMileage.configureShoeMileage!(JSON.stringify(configuration), JSON.stringify(initial))) };
    return;
  }
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
  return shoeImageFile(`${product.id}-${colorway.code}-600`, url, () => commit(state));
}

/** The app pushes the stored state once at launch, so a reinstall or an update repaints the widget. */
publishWidget();
