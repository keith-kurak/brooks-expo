/**
 * The shopper's recent activity, read from the device health provider and reduced to the few
 * numbers a shoe recommendation can use.
 *
 * @ref LLP 0005#native-returns-summaries-js-decides — The native module returns
 * raw workouts and daily step totals. Everything that interprets them, from the
 * trail-climb threshold to the unit conversion, lives here, where it can be
 * tuned without a native rebuild.
 *
 * @ref LLP 0005#nothing-leaves-the-device — The profile is computed on demand
 * and kept in screen state. It is never stored and never sent anywhere.
 */
import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
import type { ActivityWorkout, DailySteps } from '../../modules/brooks-activity/src/BrooksActivity.types';
import { getActivityAccess } from '../utils/health';

/** Eight weeks: long enough to see a training block, short enough to be current. */
export const ACTIVITY_WINDOW_DAYS = 56;

const METERS_PER_MILE = 1609.344;

/**
 * Climb per mile above which a run counts as trail running. [inferred] Road
 * runs in hilly towns rarely pass ~25 m per mile; groomed trails usually do.
 */
const TRAIL_CLIMB_PER_MILE = 40;
/** Climb per mile above which a trail run counts as technical or mountain. [inferred] */
const MOUNTAIN_CLIMB_PER_MILE = 80;
/** Fewer tracked days than this and a daily step average says nothing. */
const MIN_STEP_DAYS = 7;

export interface ActivityProfile {
  days: number;
  runs: number;
  runMiles: number;
  weeklyRunMiles: number;
  longestRunMiles: number;
  /** Runs with enough climb to count as trail running. */
  trailRuns: number;
  /** Share of trail runs with mountain-grade climb, 0–1. */
  mountainShare: number;
  /** Share of runs logged indoors, 0–1. */
  treadmillShare: number;
  walks: number;
  hikes: number;
  /** Average over the days that have any steps; null with too few such days. */
  avgDailySteps: number | null;
  /** Missing records must not imply a zero-mile training week or outdoor running. */
  distanceComplete: boolean;
  indoorComplete: boolean;
  elevationComplete: boolean;
  workoutsAvailable: boolean;
}

/** False in Expo Go, on web, and where the health provider is unavailable. */
export function isActivityAvailable(): boolean {
  return BrooksActivity?.isAvailable() ?? false;
}

/**
 * Asks for read access the first time, then reads the window. Resolves to null
 * only when Health is unavailable. A denied request looks the same as an empty
 * Health store, because HealthKit hides read denials, so callers must treat an
 * empty profile as a normal state.
 */
export async function readActivityProfile(days = ACTIVITY_WINDOW_DAYS): Promise<ActivityProfile | null> {
  if (!BrooksActivity || !BrooksActivity.isAvailable()) return null;
  await BrooksActivity.requestAccessAsync();
  const access = await getActivityAccess();
  const readableDays = Math.min(days, access.maxReadDays ?? days);
  const [workouts, steps] = await Promise.all([
    access.workouts ? BrooksActivity.getWorkoutsAsync(readableDays) : [],
    access.steps ? BrooksActivity.getDailyStepsAsync(readableDays) : [],
  ]);
  return summarizeActivity(workouts, steps, readableDays, access.workouts);
}

export function summarizeActivity(
  workouts: ActivityWorkout[],
  steps: DailySteps[],
  days: number,
  workoutsAvailable = true
): ActivityProfile {
  const runs = workouts.filter((w) => w.kind === 'run');
  const miles = (w: ActivityWorkout) => (w.distanceMeters ?? 0) / METERS_PER_MILE;
  const climbPerMile = (w: ActivityWorkout) =>
    w.elevationGainMeters != null && miles(w) > 0.5 ? w.elevationGainMeters / miles(w) : 0;

  const runMiles = runs.reduce((sum, w) => sum + miles(w), 0);
  const trail = runs.filter((w) => climbPerMile(w) >= TRAIL_CLIMB_PER_MILE);
  const mountain = trail.filter((w) => climbPerMile(w) >= MOUNTAIN_CLIMB_PER_MILE);
  const stepDays = steps.filter((d) => d.steps > 0);

  return {
    workoutsAvailable,
    distanceComplete: runs.length > 0 && runs.every(w => w.distanceMeters != null),
    indoorComplete: runs.length > 0 && runs.every(w => w.indoor != null),
    elevationComplete: runs.length > 0 && runs.every(w => w.elevationGainMeters != null),
    days,
    runs: runs.length,
    runMiles,
    weeklyRunMiles: runMiles / (days / 7),
    longestRunMiles: runs.reduce((max, w) => Math.max(max, miles(w)), 0),
    trailRuns: trail.length,
    mountainShare: trail.length ? mountain.length / trail.length : 0,
    treadmillShare: runs.length ? runs.filter((w) => w.indoor).length / runs.length : 0,
    walks: workouts.filter((w) => w.kind === 'walk').length,
    hikes: workouts.filter((w) => w.kind === 'hike').length,
    avgDailySteps:
      stepDays.length >= MIN_STEP_DAYS
        ? stepDays.reduce((sum, d) => sum + d.steps, 0) / stepDays.length
        : null,
  };
}

export function formatMiles(miles: number, digits = 0): string {
  return miles.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatSteps(steps: number): string {
  // Rounded to the hundred: a daily average is not precise to the step.
  return (Math.round(steps / 100) * 100).toLocaleString('en-US');
}
