export type WorkoutKind = 'run' | 'walk' | 'hike';

/** One workout, as the native module reports it. */
export interface ActivityWorkout {
  /** HealthKit UUID; optional for compatibility with earlier native builds. */
  id?: string;
  kind: WorkoutKind;
  /** Milliseconds since the epoch. */
  start: number;
  durationMinutes: number;
  /** Missing when the recording app saved no distance, e.g. some treadmill runs. */
  distanceMeters: number | null;
  /** Missing when the recording app saved no elevation. */
  elevationGainMeters: number | null;
  /** A treadmill run or an indoor walk. */
  indoor: boolean;
}

/** Steps for one local calendar day. */
export interface DailySteps {
  /** Local midnight that starts the day, in milliseconds since the epoch. */
  date: number;
  steps: number;
}
