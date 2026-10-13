import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import BrooksActivity from '../../../modules/brooks-activity/src/BrooksActivityModule';
import type { ActivityAccess } from '../../../modules/brooks-activity/src/BrooksActivity.types';
import { getActivityAccess } from '@/utils/health';
import { HEALTH_DAYS, summarizeHealth, type HealthSummary } from './summary';

export type HealthState =
  | { status: 'loading' }
  | { status: 'unavailable' | 'install-required' | 'unlinked' }
  | { status: 'ready'; summary: HealthSummary; access: ActivityAccess }
  | { status: 'error' };

export function useHealthSummary() {
  const focused = useIsFocused();
  const [state, setState] = useState<HealthState>({ status: 'loading' });
  const mounted = useRef(true);
  const pending = useRef(false);
  const load = useCallback(async (requestAccess = false) => {
    if (pending.current) return;
    pending.current = true;
    setState({ status: 'loading' });
    try {
      let access = await getActivityAccess();
      let next: HealthState;
      if (access.status !== 'available' || !BrooksActivity) {
        next = { status: access.status === 'install-required' ? 'install-required' : 'unavailable' };
      } else {
        // @ref LLP 0005#profile-health-summary — Ask only after Connect; reuse existing access on entry.
        if (requestAccess) {
          await BrooksActivity.requestAccessAsync();
          access = await getActivityAccess();
        }
        if (!access.workouts && !access.steps) {
          next = { status: 'unlinked' };
        } else {
          const [workouts, steps] = await Promise.all([
            access.workouts ? BrooksActivity.getWorkoutsAsync(HEALTH_DAYS) : null,
            access.steps ? BrooksActivity.getDailyStepsAsync(HEALTH_DAYS) : null,
          ]);
          next = { status: 'ready', access, summary: summarizeHealth(workouts, steps) };
        }
      }
      if (mounted.current) setState(next);
    } catch {
      if (mounted.current) setState({ status: 'error' });
    } finally {
      pending.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!focused) return;
    void load();
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') void load();
    });
    return () => subscription.remove();
  }, [focused, load]);

  return { state, refresh: () => load(), connect: () => load(true) };
}
