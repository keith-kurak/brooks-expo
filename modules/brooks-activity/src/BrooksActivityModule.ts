import { type NativeModule, requireOptionalNativeModule } from 'expo';

import type { ActivityWorkout, DailySteps } from './BrooksActivity.types';

declare class BrooksActivityModule extends NativeModule<{}> {
  /** False on iPads without Health and on every non-iOS platform. */
  isAvailable(): boolean;
  /** True when the system sheet would still appear. */
  shouldRequestAccessAsync(): Promise<boolean>;
  /**
   * Shows the system sheet the first time. Resolves once the sheet closes, or
   * at once if the user has already answered it. It does not report whether
   * read access was granted: HealthKit keeps that private.
   */
  requestAccessAsync(): Promise<void>;
  /** Runs, walks and hikes that started in the last `days` days, newest first. */
  getWorkoutsAsync(days: number): Promise<ActivityWorkout[]>;
  /** One entry per day for the last `days` days, oldest first. */
  getDailyStepsAsync(days: number): Promise<DailySteps[]>;
  /**
   * Debug builds only; undefined in Release. Replaces this app's samples with
   * eight weeks of sample data.
   */
  seedSampleDataAsync?(): Promise<void>;
}

/**
 * Null where the module is not linked: Android and web today. Callers check
 * for null instead of the platform, so an Android implementation needs no JS
 * change here.
 */
export default requireOptionalNativeModule<BrooksActivityModule>('BrooksActivity');
