import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
import type { ActivityAccess } from '../../modules/brooks-activity/src/BrooksActivity.types';

export const HEALTH_NAME = process.env.EXPO_OS === 'android' ? 'Health Connect' : 'Apple Health';
export const IS_HEALTH_CONNECT = process.env.EXPO_OS === 'android';

export function healthAvailability(): ActivityAccess['status'] {
  return BrooksActivity?.getAvailability?.() ?? (BrooksActivity?.isAvailable() ? 'available' : 'unavailable');
}

function emptyAccess(): ActivityAccess {
  return {
    status: healthAvailability(), workouts: false, distance: false, steps: false, elevation: false,
    historyAvailable: false, backgroundAvailable: false, background: false, maxReadDays: null,
  };
}

/** Android grants are explicit; HealthKit can only disclose whether it already asked.
 * @ref LLP 0005#android — Permission loss and limited history must not become zero mileage.
 */
export async function getActivityAccess(): Promise<ActivityAccess> {
  if (BrooksActivity?.getAccessAsync) return BrooksActivity.getAccessAsync();
  const access = emptyAccess();
  if (access.status !== 'available' || !BrooksActivity) return access;
  const requested = !(await BrooksActivity.shouldRequestAccessAsync());
  return { ...access, workouts: requested, distance: requested, steps: requested, elevation: requested,
    historyAvailable: true, backgroundAvailable: true, background: requested };
}

export async function openHealthSettings(): Promise<void> {
  try {
    await BrooksActivity?.openSettingsAsync?.();
  } catch {
    Alert.alert('Health Connect could not be opened', 'Open Health Connect in Android Settings to manage Brooks access.');
  }
}

export function healthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Allow earlier history')) return 'Allow earlier history in Health Connect to count from this start date. Your saved miles are unchanged.';
  if (message.includes('Some recorded workouts')) return message;
  return 'Activity could not be read. Your saved miles are unchanged. Try again or check health access.';
}

/** Installation and permissions can change without restarting Brooks. */
export function useHealthAccess() {
  const [access, setAccess] = useState(emptyAccess);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await getActivityAccess();
      if (current === sequence.current) setAccess(next);
      return next;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    void reload();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void reload();
    });
    return () => { sequence.current++; subscription.remove(); };
  }, [reload]);
  return { access, reload };
}
