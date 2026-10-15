import type { ActivityWorkout } from '../../../modules/brooks-activity/src/BrooksActivity.types';

export const WEEKLY_GOAL_METERS = 10000;

const goalKm = WEEKLY_GOAL_METERS / 1000;
/** @ref LLP 0008#the-goal-is-javascript-only — Every label derives from the goal, so a new distance ships by EAS Update. */
export const WEEKLY_GOAL = {
  km: goalKm,
  badge: `${goalKm}K`,
  title: `Weekly ${goalKm}K`,
  distance: `${goalKm} km`,
} as const;

export interface ChallengeWeek {
  id: string;
  start: number;
  end: number;
  days: number[];
  label: string;
}

export interface WeeklyRuns {
  weekId: string;
  distanceMeters: number;
  runs: number;
  countedDays: boolean[];
}

/** @ref LLP 0008#weekly-challenge-implementation — Calendar arithmetic survives 23/25-hour days. */
export function challengeWeek(now = Date.now()): ChallengeWeek {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    return day.getTime();
  });
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  const sunday = new Date(days[6]);
  const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    id: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`,
    start: monday.getTime(), end: end.getTime(), days,
    label: `${date(monday)}–${monday.getMonth() === sunday.getMonth() ? sunday.getDate() : date(sunday)}`,
  };
}

/** Recompute from the current query, so a refresh or deletion cannot accumulate phantom distance. */
export function summarizeWeeklyRuns(workouts: ActivityWorkout[], week: ChallengeWeek, now: number): WeeklyRuns {
  const result: WeeklyRuns = { weekId: week.id, distanceMeters: 0, runs: 0, countedDays: Array(7).fill(false) };
  const seen = new Set<string>();
  for (const workout of workouts) {
    const distance = workout.distanceMeters;
    if (workout.kind !== 'run' || !Number.isFinite(workout.start) || workout.start < week.start ||
        workout.start >= week.end || workout.start > now || distance == null || !Number.isFinite(distance) || distance <= 0) continue;
    // UUIDs are supplied by new native builds; old binaries retain a stable record fallback.
    const id = workout.id ?? `${workout.start}:${workout.durationMinutes}:${distance}:${workout.indoor}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.distanceMeters += distance;
    result.runs++;
    const day = week.days.findLastIndex(start => start <= workout.start);
    result.countedDays[day] = true;
  }
  return result;
}

export function challengeProgress(summary: WeeklyRuns | null) {
  const meters = summary?.distanceMeters ?? 0;
  return {
    complete: meters >= WEEKLY_GOAL_METERS,
    share: Math.min(1, meters / WEEKLY_GOAL_METERS),
    // Never round an unfinished 9.99 km up to a displayed 10 km goal.
    distance: (Math.floor(meters / 100) / 10).toFixed(1),
    remaining: (Math.ceil(Math.max(0, WEEKLY_GOAL_METERS - meters) / 100) / 10).toFixed(1),
  };
}
