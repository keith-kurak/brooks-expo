import { type NativeModule, requireOptionalNativeModule } from 'expo';

import type { ActivityAccess, ActivityWorkout, DailySteps } from './BrooksActivity.types';

declare class BrooksActivityModule extends NativeModule<{}> {
  /** Whether the device's health provider is ready. */
  isAvailable(): boolean;
  /** Android reports installation and separately observable read grants. */
  getAvailability?(): ActivityAccess['status'];
  getAccessAsync?(): Promise<ActivityAccess>;
  openSettingsAsync?(): Promise<void>;
  /** iOS has not asked yet, or Android's workout/distance grants are missing. */
  shouldRequestAccessAsync(): Promise<boolean>;
  /**
   * Requests read access after a tap. HealthKit keeps read denials private;
   * Android reports its granted permissions through getAccessAsync.
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
 * Null in Expo Go and on web. Older iOS binaries omit the Android access API.
 */
export default requireOptionalNativeModule<BrooksActivityModule>('BrooksActivity');
