export type WorkoutKind = 'run' | 'walk' | 'hike';

/** One workout, as the native module reports it. */
export interface ActivityWorkout {
  kind: WorkoutKind;
  /** Milliseconds since the epoch. */
  start: number;
  /** Active workout time on iOS, elapsed session time on Android. */
  durationMinutes: number;
  /** Missing when the recording app saved no distance, e.g. some treadmill runs. */
  distanceMeters: number | null;
  /** Missing when the recording app saved no elevation. */
  elevationGainMeters: number | null;
  /** A treadmill run or an indoor walk. */
  indoor: boolean | null;
}

export interface ActivityAccess {
  status: 'available' | 'install-required' | 'unavailable';
  workouts: boolean;
  distance: boolean;
  steps: boolean;
  elevation: boolean;
  historyAvailable: boolean;
  backgroundAvailable: boolean;
  background: boolean;
  /** null means earlier history is readable; otherwise a conservative safe window. */
  maxReadDays: number | null;
}

/** Steps for one local calendar day. */
export interface DailySteps {
  /** Local midnight that starts the day, in milliseconds since the epoch. */
  date: number;
  steps: number;
}
