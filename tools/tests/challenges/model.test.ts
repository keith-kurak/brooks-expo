import { expect, test } from 'bun:test';
import { challengeProgress, challengeWeek, summarizeWeeklyRuns } from '../../../src/features/challenges/model';
import type { ActivityWorkout } from '../../../modules/brooks-activity/src/BrooksActivity.types';

process.env.TZ = 'America/Toronto';
const now = new Date('2026-10-16T12:00:00-04:00').getTime();
const week = challengeWeek(now);
const run = (id: string, day: number, distanceMeters: number | null): ActivityWorkout => ({
  id, kind: 'run', start: week.days[day] + 3600000, durationMinutes: 20, distanceMeters, elevationGainMeters: null, indoor: false,
});

test('calendar weeks use Monday local midnight and survive both DST transitions', () => {
  expect(week.id).toBe('2026-10-12');
  expect(new Date(week.end).getDay()).toBe(1);
  expect(week.label).toBe('Oct 12–18');
  const fall = challengeWeek(new Date('2026-11-01T12:00:00-05:00').getTime());
  expect((fall.end - fall.start) / 3600000).toBe(169);
  const spring = challengeWeek(new Date('2026-03-08T12:00:00-04:00').getTime());
  expect((spring.end - spring.start) / 3600000).toBe(167);
  expect(challengeWeek(week.end - 1).id).toBe(week.id);
  expect(challengeWeek(week.end).id).toBe('2026-10-19');
});

test('counts each identified running workout once, including earlier runs, and marks contributing days', () => {
  const first = run('first', 0, 1800);
  const workouts = [first, { ...first }, run('second', 1, 1400),
    { ...run('walk', 2, 10000), kind: 'walk' as const }, run('no-distance', 3, null),
    run('invalid', 3, NaN), run('negative', 3, -20),
    { ...run('previous', 0, 5000), start: week.start - 1 },
    { ...run('next', 0, 5000), start: week.end }, run('future', 6, 5000)];
  const result = summarizeWeeklyRuns(workouts, week, now);
  expect(result.distanceMeters).toBe(3200);
  expect(result.runs).toBe(2);
  expect(result.countedDays).toEqual([true, true, false, false, false, false, false]);
  expect(challengeProgress(result)).toEqual({ complete: false, share: 0.64, distance: '3.2', remaining: '1.8' });
  expect(summarizeWeeklyRuns(workouts, week, now)).toEqual(result);
});

test('deletions and corrected distances replace totals; completion and its one entry are derived from valid distance', () => {
  const complete = summarizeWeeklyRuns([run('a', 0, 3200), run('b', 3, 2200)], week, now);
  expect(challengeProgress(complete)).toEqual({ complete: true, share: 1, distance: '5.4', remaining: '0.0' });
  const corrected = summarizeWeeklyRuns([run('a', 0, 4999)], week, now);
  expect(challengeProgress(corrected)).toEqual({ complete: false, share: 0.9998, distance: '4.9', remaining: '0.1' });
  expect(challengeProgress(summarizeWeeklyRuns([], week, now)).complete).toBe(false);
});

test('old native records without UUIDs retain a duplicate fallback', () => {
  const { id, ...old } = run('a', 0, 2000);
  expect(summarizeWeeklyRuns([old, { ...old }], week, now).distanceMeters).toBe(2000);
});
