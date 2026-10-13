/**
 * Shoe mileage: how far each pair has gone, read from the device health provider.
 *
 * @ref LLP 0006#mileage-is-workout-distance — A pair's miles are the distance
 * of the Health workouts it covers (runs by default) since its start date, plus
 * any miles it already had. Not the all-day walking-and-running distance:
 * that counts every step to the fridge, in whatever shoes.
 *
 * @ref LLP 0005#native-returns-summaries-js-decides — The native module only
 * returns workouts. The sums, the 70% line and the pace estimate live here.
 */
import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
import type { ActivityWorkout, WorkoutKind } from '../../modules/brooks-activity/src/BrooksActivity.types';
import { getActivityAccess } from '../utils/health';

const METERS_PER_MILE = 1609.344;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The share of a pair's limit at which the app says "time to replace".
 * [confirmed] The user asked for "70% done, time to replace". It is early on
 * purpose: a new pair wants a few easy runs before it takes a long one.
 */
export const REPLACE_AT = 0.7;

/**
 * Limits the add sheet offers. [inferred] Running-shoe guidance commonly puts
 * a pair's life at 300 to 500 miles; 400 is the middle and the default.
 */
export const LIMIT_CHOICES = [300, 400, 500] as const;
export const DEFAULT_LIMIT = 400;

/** The pace window: the last four weeks say more about next week than the last year. */
const PACE_DAYS = 28;
/** The longest history read at once. A pair older than three years is not the question. */
const MAX_DAYS = 3 * 365;

export interface OwnedShoe {
  id: string;
  /** The catalog style, when the pair is one the catalog lists. */
  productId: string | null;
  colorCode: string | null;
  /** Shown everywhere, so a pair the catalog does not list still has a name. */
  name: string;
  /** Local midnight of the first day the pair counts. */
  startedAt: number;
  limitMiles: number;
  /** Miles the pair had before it was added. */
  startMiles: number;
  /** Which workouts count toward it. */
  kinds: WorkoutKind[];
  /** Set when the pair is retired. Workouts after this no longer count. */
  retiredAt: number | null;
  addedAt: number;
}

/** What Health said about one pair at the last read. */
export interface ShoeHealthMiles {
  miles: number;
  workouts: number;
  /** Average miles a week over the last four weeks, or null with no recent workouts. */
  weeklyMiles: number | null;
}

export interface ShoeMileage {
  totalMiles: number;
  limitMiles: number;
  /** 0 and up; over 1 means past the limit. */
  share: number;
  /** Whole percent, for labels. */
  percent: number;
  replace: boolean;
  milesLeft: number;
  /** At the recent pace; null when there is no recent pace. */
  weeksLeft: number | null;
  /** "70% done, time to replace." or "45% done." */
  status: string;
  /** "280 of 400 mi" */
  milesLabel: string;
}

export function mileageOf(shoe: OwnedShoe, health: ShoeHealthMiles | undefined): ShoeMileage {
  const totalMiles = shoe.startMiles + (health?.miles ?? 0);
  const share = shoe.limitMiles > 0 ? totalMiles / shoe.limitMiles : 0;
  const percent = Math.floor(share * 100);
  const replace = share >= REPLACE_AT;
  const milesLeft = Math.max(0, shoe.limitMiles - totalMiles);
  const pace = health?.weeklyMiles ?? null;
  return {
    totalMiles,
    limitMiles: shoe.limitMiles,
    share,
    percent,
    replace,
    milesLeft,
    weeksLeft: pace && pace > 0 ? milesLeft / pace : null,
    status: replace ? `${percent}% done, time to replace.` : `${percent}% done.`,
    milesLabel: `${formatMileage(totalMiles)} of ${formatMileage(shoe.limitMiles)} mi`,
  };
}

export function formatMileage(miles: number): string {
  return Math.round(miles).toLocaleString('en-US');
}

/** "About 3 weeks left" from a pace, or null when there is no pace to go on. */
export function weeksLeftLabel(m: ShoeMileage): string | null {
  if (m.weeksLeft == null) return null;
  if (m.milesLeft <= 0) return 'Past its limit';
  const weeks = Math.round(m.weeksLeft);
  if (weeks < 1) return 'Less than a week left at your pace';
  return `About ${weeks} ${weeks === 1 ? 'week' : 'weeks'} left at your pace`;
}

/** Local midnight of the day `at` falls in. */
export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** False in Expo Go, on web, and where the health provider is unavailable. */
export function isMileageAvailable(): boolean {
  return BrooksActivity?.isAvailable() ?? false;
}

/** Whole readable window required for recomputation, including the pace window. */
export function mileageReadDays(shoes: OwnedShoe[], now = Date.now()): number {
  if (shoes.length === 0) return PACE_DAYS;
  const earliest = Math.min(...shoes.map(s => s.startedAt));
  // Rounded for local days across daylight-saving changes.
  return Math.max(PACE_DAYS, Math.min(MAX_DAYS, Math.round((startOfDay(now) - earliest) / DAY_MS) + 1));
}

/**
 * Reads Health and sums each pair's miles.
 *
 * `ask` decides what happens when the app has never asked for Health access.
 * With `ask`, the system sheet appears; the add sheet passes it, because the
 * shopper just tapped. Without it, nothing is read: a launch or a return to
 * the app must never put a permission sheet in front of the shopper.
 * @ref LLP 0005#nothing-leaves-the-device — The app asks only after a tap.
 *
 * Resolves to null when nothing was read.
 */
export async function readShoeMiles(
  shoes: OwnedShoe[],
  { ask, background = false }: { ask: boolean; background?: boolean }
): Promise<Record<string, ShoeHealthMiles> | null> {
  if (!BrooksActivity || !BrooksActivity.isAvailable() || shoes.length === 0) return null;
  if (ask) await BrooksActivity.requestAccessAsync();
  const access = await getActivityAccess();
  if (!access.workouts || !access.distance || (background && !access.background)) return null;

  const now = Date.now();
  const days = mileageReadDays(shoes, now);
  // Never replace a complete cache with a limited-history reread. @ref LLP 0005#android
  if (access.maxReadDays != null && days > access.maxReadDays) {
    throw new Error('Allow earlier history in Health Connect to count from this start date. Your saved miles are unchanged.');
  }
  const workouts = await BrooksActivity.getWorkoutsAsync(days);
  if (workouts.some(w => w.distanceMeters == null && shoes.some(s =>
    s.kinds.includes(w.kind) && w.start >= s.startedAt && w.start < (s.retiredAt ?? Infinity)))) {
    throw new Error('Some recorded workouts have no distance. Your saved miles are unchanged. Check distance sharing in your recording app.');
  }
  return Object.fromEntries(shoes.map((s) => [s.id, sumFor(s, workouts, now)]));
}

/**
 * @ref LLP 0006#every-pair-counts-its-own-workouts — Each pair counts every
 * matching workout in its own window. Two active pairs that both count runs
 * both get every run; retiring a pair closes its window.
 */
export function sumFor(shoe: OwnedShoe, workouts: ActivityWorkout[], now: number): ShoeHealthMiles {
  const end = shoe.retiredAt ?? Infinity;
  const mine = workouts.filter(
    (w) => shoe.kinds.includes(w.kind) && w.start >= shoe.startedAt && w.start < end
  );
  const miles = (w: ActivityWorkout) => (w.distanceMeters ?? 0) / METERS_PER_MILE;
  const recentFrom = Math.max(shoe.startedAt, now - PACE_DAYS * DAY_MS);
  const recent = mine.filter((w) => w.start >= recentFrom);
  // The pace is per week of the pair's own time when the pair is newer than the window.
  const recentWeeks = (now - recentFrom) / (7 * DAY_MS);
  return {
    miles: mine.reduce((sum, w) => sum + miles(w), 0),
    workouts: mine.length,
    weeklyMiles:
      shoe.retiredAt == null && recent.length > 0 && recentWeeks >= 1
        ? recent.reduce((sum, w) => sum + miles(w), 0) / recentWeeks
        : null,
  };
}
