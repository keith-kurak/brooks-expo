import { describe, expect, test } from 'bun:test';

import { exampleHealth, formatDuration, summarizeHealth } from '../../../src/screens/health-data/summary';
import type { ActivityWorkout } from '../../../modules/brooks-activity/src/BrooksActivity.types';

const now = new Date(2026, 9, 13, 12);
const date = (day: number, hour = 0) => new Date(2026, 9, day, hour).getTime();
const workout = (start: number, overrides: Partial<ActivityWorkout> = {}): ActivityWorkout => ({
  kind: 'run', start, durationMinutes: 30, distanceMeters: 5000, elevationGainMeters: 40, indoor: false, ...overrides,
});

describe('health summary', () => {
  test('uses seven local calendar days, including today, and sorts newest first', () => {
    const result = summarizeHealth([workout(date(6, 23)), workout(date(7)), workout(date(13, 9)), workout(date(14))],
      [{ date: date(6), steps: 99000 }, { date: date(7), steps: 7000 }, { date: date(13), steps: 7000 }, { date: date(14), steps: 99000 }], now);
    expect(result.workouts.map(item => item.start)).toEqual([date(13, 9), date(7)]);
    expect(result.distanceMeters).toBe(10000);
    expect(result.durationMinutes).toBe(60);
    expect(result.elevationGainMeters).toBe(80);
    expect(result.dailySteps).toBe(2000);
  });

  test('never presents a partial distance or elevation as a full total', () => {
    const result = summarizeHealth([workout(date(12)), workout(date(11), { distanceMeters: null, elevationGainMeters: null })], null, now);
    expect(result.distanceMeters).toBeNull();
    expect(result.elevationGainMeters).toBeNull();
    expect(result.durationMinutes).toBe(60);
    expect(result.dailySteps).toBeNull();
    expect(result.hasData).toBe(true);
  });

  test('preserves recorded zero measurements while empty or unshared data stays unavailable', () => {
    const recorded = summarizeHealth([workout(date(12), { distanceMeters: 0, elevationGainMeters: 0 })], [], now);
    expect(recorded.distanceMeters).toBe(0);
    expect(recorded.elevationGainMeters).toBe(0);
    const empty = summarizeHealth([], [{ date: date(12), steps: 0 }], now);
    expect(empty.hasData).toBe(false);
    expect(empty.distanceMeters).toBeNull();
    expect(empty.dailySteps).toBeNull();
    const stepsOnly = summarizeHealth(null, [{ date: date(12), steps: 7000 }], now);
    expect(stepsOnly.hasData).toBe(true);
    expect(stepsOnly.workouts).toEqual([]);
    expect(stepsOnly.distanceMeters).toBeNull();
    expect(stepsOnly.dailySteps).toBe(1000);
  });

  test('example totals agree with the example workouts', () => {
    const example = exampleHealth(now);
    const actual = summarizeHealth(example.workouts, null, now);
    expect(actual.distanceMeters).toBeCloseTo(example.distanceMeters!, 5);
    expect(actual.durationMinutes).toBe(example.durationMinutes);
    expect(actual.elevationGainMeters).toBe(example.elevationGainMeters);
  });

  test('rounds duration before carrying minutes into hours', () => {
    expect(formatDuration(59.8)).toBe('1h');
    expect(formatDuration(74)).toBe('1h 14m');
    expect(formatDuration(43)).toBe('43 min');
  });
});
