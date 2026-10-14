import * as Linking from 'expo-linking';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import BrooksActivity from '../../modules/brooks-activity/src/BrooksActivityModule';
import { challengeProgress, challengeWeek, summarizeWeeklyRuns, type ChallengeWeek, type WeeklyRuns } from '../features/challenges/model';
import { isAppClip } from '../utils/app-clip';
import { storage } from '../utils/kv-storage';
import { updateWeeklyChallengeWidget } from '../widgets/weekly-challenge';
import { getMember, subscribeMember } from './member';

interface Enrollment {
  weekId: string;
  summary: WeeklyRuns;
  readAt: number;
}

export interface ChallengesState {
  owner: string | null;
  week: ChallengeWeek;
  enrolled: boolean;
  summary: WeeklyRuns | null;
  readAt: number | null;
  loading: boolean;
  error: string | null;
}

const KEY = 'brooks.challenges.v1';
let records = storage.get<Record<string, Enrollment>>(KEY, {});
const owner = () => getMember()?.email.trim().toLowerCase() ?? null;
const listeners = new Set<() => void>();

function snapshot(): ChallengesState {
  const email = owner();
  const week = challengeWeek();
  const record = email ? records[email] : null;
  const enrolled = record?.weekId === week.id;
  return { owner: email, week, enrolled, summary: enrolled ? record.summary : null,
    readAt: enrolled ? record.readAt : null, loading: false, error: null };
}

let state = snapshot();
let reading: Promise<boolean> = Promise.resolve(true);

export const isChallengeHealthAvailable = () => !isAppClip && (BrooksActivity?.isAvailable() ?? false);
export const getChallengesState = () => state;
export const hasEnrolledChallenge = () => {
  const email = owner();
  return email != null && records[email]?.weekId === challengeWeek().id;
};

export function subscribeChallenges(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function emit(next: ChallengesState) {
  state = next;
  publishWidget();
  listeners.forEach(listener => listener());
}

function publishWidget() {
  if (isAppClip) return;
  const progress = challengeProgress(state.summary);
  updateWeeklyChallengeWidget({
    phase: state.enrolled ? progress.complete ? 'complete' : 'progress' : 'invitation',
    distance: progress.distance, remaining: `${progress.remaining} km to go`, share: progress.share,
    runsLabel: `${state.summary?.runs ?? 0} ${state.summary?.runs === 1 ? 'run' : 'runs'}`,
    expiresAt: state.week.end,
    // Array-group qualification opens Profile's stack and preserves its back destination.
    url: Linking.createURL('/(tabs)/(account)/challenges'),
  });
}

/** @ref LLP 0008#weekly-challenge-implementation — Local, per-member enrollment and latest aggregate only. */
function save(email: string, week: ChallengeWeek, summary: WeeklyRuns) {
  records = { ...records, [email]: { weekId: week.id, summary, readAt: Date.now() } };
  storage.set(KEY, records);
  emit(snapshot());
}

function resetIfChanged() {
  if (state.owner !== owner() || state.week.id !== challengeWeek().id) emit(snapshot());
}

export async function needsChallengeHealthAccess(): Promise<boolean> {
  return isChallengeHealthAvailable() && await BrooksActivity!.shouldRequestAccessAsync();
}

/** The sole permission request is the Connect & join tap. Failed reads keep the sheet open. */
export function joinWeeklyChallenge(): Promise<boolean> {
  reading = reading.then(async () => {
    resetIfChanged();
    const email = owner();
    if (!email || !isChallengeHealthAvailable()) return false;
    const week = challengeWeek();
    emit({ ...state, loading: true, error: null });
    try {
      if (await BrooksActivity!.shouldRequestAccessAsync()) await BrooksActivity!.requestAccessAsync();
      const workouts = await BrooksActivity!.getWorkoutsAsync(8);
      if (email !== owner() || week.id !== challengeWeek().id) { resetIfChanged(); return false; }
      save(email, week, summarizeWeeklyRuns(workouts, week, Date.now()));
      return true;
    } catch {
      if (email === owner()) emit({ ...state, loading: false, error: 'Could not read your workouts. Please try again.' });
      return false;
    }
  });
  return reading;
}

/** Refreshes recompute totals; background and foreground never request authorization. */
export function refreshChallenges(): Promise<boolean> {
  reading = reading.then(async () => {
    resetIfChanged();
    const email = owner();
    if (!email || !hasEnrolledChallenge() || !isChallengeHealthAvailable()) return true;
    const week = challengeWeek();
    emit({ ...state, loading: true, error: null });
    try {
      if (await BrooksActivity!.shouldRequestAccessAsync()) {
        emit({ ...state, loading: false, error: 'Open Apple Health to review workout access for Brooks.' });
        return true;
      }
      const workouts = await BrooksActivity!.getWorkoutsAsync(8);
      if (email !== owner() || week.id !== challengeWeek().id) { resetIfChanged(); return true; }
      save(email, week, summarizeWeeklyRuns(workouts, week, Date.now()));
      return true;
    } catch {
      if (email === owner()) emit({ ...state, loading: false, error: 'Could not sync. Your last progress is saved. Pull down to retry.' });
      return false;
    }
  });
  return reading;
}

subscribeMember(() => { emit(snapshot()); void refreshChallenges(); });
publishWidget();

export function useChallenges() {
  return useSyncExternalStore(subscribeChallenges, getChallengesState, getChallengesState);
}

/** Reset at the local week boundary even while the screen stays open. */
export function useChallengeSync() {
  useEffect(() => {
    if (isAppClip) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void refreshChallenges(); schedule(); }, Math.max(1000, challengeWeek().end - Date.now() + 50));
    };
    void refreshChallenges();
    schedule();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') { void refreshChallenges(); schedule(); }
    });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
}
