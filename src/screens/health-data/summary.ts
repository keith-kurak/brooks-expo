import type { ActivityWorkout, DailySteps } from '../../../modules/brooks-activity/src/BrooksActivity.types';

export const HEALTH_DAYS = 7;
export const METERS_PER_MILE = 1609.344;

export interface HealthSummary {
  workouts: ActivityWorkout[];
  distanceMeters: number | null;
  durationMinutes: number | null;
  elevationGainMeters: number | null;
  dailySteps: number | null;
  hasData: boolean;
}

/** @ref LLP 0005#profile-health-summary — Missing measurements must not become zero or a partial total. */
export function summarizeHealth(
  workouts: ActivityWorkout[] | null,
  steps: DailySteps[] | null,
  now = new Date(),
): HealthSummary {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - HEALTH_DAYS + 1);
  const inWindow = (date: number) => date >= start.getTime() && date <= now.getTime();
  const recent = (workouts ?? []).filter(workout => inWindow(workout.start)).sort((a, b) => b.start - a.start);
  const total = (key: 'distanceMeters' | 'durationMinutes' | 'elevationGainMeters') => {
    if (!recent.length || recent.some(workout => workout[key] === null)) return null;
    return recent.reduce((sum, workout) => sum + workout[key]!, 0);
  };
  const stepTotal = (steps ?? []).filter(day => inWindow(day.date)).reduce((sum, day) => sum + day.steps, 0);
  return {
    workouts: recent,
    distanceMeters: total('distanceMeters'),
    durationMinutes: total('durationMinutes'),
    elevationGainMeters: total('elevationGainMeters'),
    dailySteps: stepTotal > 0 ? Math.round(stepTotal / HEALTH_DAYS) : null,
    hasData: recent.length > 0 || stepTotal > 0,
  };
}

export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const remainder = rounded % 60;
  return `${Math.floor(rounded / 60)}h${remainder ? ` ${remainder}m` : ''}`;
}

/** Preview records stay in memory and are never written to the health store. */
export function exampleHealth(now = new Date()): HealthSummary {
  const workout = (daysAgo: number, kind: ActivityWorkout['kind'], miles: number, minutes: number, climb: number): ActivityWorkout => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(7, 0, 0, 0);
    return { kind, start: date.getTime(), distanceMeters: miles * METERS_PER_MILE,
      durationMinutes: minutes, elevationGainMeters: climb, indoor: false };
  };
  return {
    workouts: [workout(1, 'run', 5.2, 43, 32), workout(3, 'walk', 2.1, 38, 16), workout(5, 'run', 8.4, 74, 85)],
    distanceMeters: 15.7 * METERS_PER_MILE,
    durationMinutes: 155,
    elevationGainMeters: 133,
    dailySteps: 8640,
    hasData: true,
  };
}
