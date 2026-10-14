import { afterEach, beforeEach, expect, mock, setSystemTime, test } from 'bun:test';

const persisted = new Map<string, unknown>();
let permissionNeeded = true;
let available = true;
let workouts: any[] = [];
let props: any;
let memberNumber = 0;
const requestAccess = mock(async () => { permissionNeeded = false; });
const getWorkouts = mock(async () => workouts);
mock.module('expo-linking', () => ({ createURL: (path: string) => `ecomdemo://${path}` }));
mock.module('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
mock.module('../../../modules/brooks-activity/src/BrooksActivityModule', () => ({ default: {
  isAvailable: () => available,
  shouldRequestAccessAsync: async () => permissionNeeded,
  requestAccessAsync: requestAccess,
  getWorkoutsAsync: getWorkouts,
} }));
mock.module('../../../src/utils/app-clip', () => ({ isAppClip: false }));
mock.module('../../../src/utils/kv-storage', () => ({ storage: {
  get: (key: string, fallback: unknown) => persisted.get(key) ?? fallback,
  set: (key: string, value: unknown) => persisted.set(key, value),
  remove: (key: string) => persisted.delete(key),
} }));
mock.module('../../../src/widgets/weekly-challenge', () => ({ updateWeeklyChallengeWidget: (value: unknown) => { props = value; } }));
const member = await import('../../../src/store/member');
const challenges = await import('../../../src/store/challenges');
const { challengeProgress } = await import('../../../src/features/challenges/model');

beforeEach(async () => {
  setSystemTime(new Date('2026-10-16T12:00:00-04:00'));
  member.leave();
  await challenges.refreshChallenges();
  permissionNeeded = true;
  available = true;
  workouts = [{ id: 'a', kind: 'run', start: Date.now() - 86400000, distanceMeters: 3200, durationMinutes: 25, indoor: false }];
  requestAccess.mockClear();
  getWorkouts.mockReset();
  getWorkouts.mockImplementation(async () => workouts);
  member.join({ email: `runner${++memberNumber}@example.com`, firstName: 'Alex' });
  await challenges.refreshChallenges();
});
afterEach(() => { setSystemTime(); });

test('launch never prompts; explicit join requests once and repeated reads share the same distance with the widget', async () => {
  expect(requestAccess).not.toHaveBeenCalled();
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(await challenges.joinWeeklyChallenge()).toBe(true);
  expect(requestAccess).toHaveBeenCalledTimes(1);
  expect(challenges.getChallengesState().summary?.distanceMeters).toBe(3200);
  expect(props.distance).toBe('3.2');
  expect(props.share).toBe(0.64);
  expect(props.url).toBe('ecomdemo:///(tabs)/(account)/challenges');
  await challenges.refreshChallenges();
  expect(challenges.getChallengesState().summary?.distanceMeters).toBe(3200);
  expect(requestAccess).toHaveBeenCalledTimes(1);
});

test('completed and deleted workouts update the widget; failed reads retain the cache and recover', async () => {
  await challenges.joinWeeklyChallenge();
  workouts.push({ ...workouts[0], id: 'b', distanceMeters: 2200 });
  await challenges.refreshChallenges();
  expect(props.phase).toBe('complete');
  expect(props.distance).toBe('5.4');
  const saved = challenges.getChallengesState();
  getWorkouts.mockRejectedValueOnce(new Error('Health locked'));
  expect(await challenges.refreshChallenges()).toBe(false);
  expect(challenges.getChallengesState().summary).toBe(saved.summary);
  expect(challenges.getChallengesState().readAt).toBe(saved.readAt);
  expect(challenges.getChallengesState().error).toContain('last progress is saved');
  workouts = [];
  expect(await challenges.refreshChallenges()).toBe(true);
  expect(challenges.getChallengesState().error).toBeNull();
  expect(challengeProgress(challenges.getChallengesState().summary).complete).toBe(false);
  expect(props.phase).toBe('progress');
});

test('midnight rolls to an invitation; it never copies last week into the new week', async () => {
  await challenges.joinWeeklyChallenge();
  const nextWeek = challenges.getChallengesState().week.end;
  setSystemTime(new Date(nextWeek));
  await challenges.refreshChallenges();
  expect(challenges.hasEnrolledChallenge()).toBe(false);
  expect(challenges.getChallengesState().summary).toBeNull();
  expect(props.phase).toBe('invitation');
  expect(requestAccess).toHaveBeenCalledTimes(1);
});

test('switching members while joining discards the previous member query and clears the widget', async () => {
  let finish!: (result: any[]) => void;
  getWorkouts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const joining = challenges.joinWeeklyChallenge();
  await new Promise(resolve => setTimeout(resolve, 0));
  member.join({ email: 'another@example.com', firstName: 'Sam' });
  finish(workouts);
  expect(await joining).toBe(false);
  await challenges.refreshChallenges();
  expect(challenges.getChallengesState().owner).toBe('another@example.com');
  expect(challenges.getChallengesState().enrolled).toBe(false);
  expect(props.phase).toBe('invitation');
  member.leave();
  expect(props.distance).toBe('0.0');
  expect(challenges.getChallengesState().summary).toBeNull();
});

test('unavailable Health never joins or invents progress; a failed join can be retried', async () => {
  available = false;
  expect(await challenges.joinWeeklyChallenge()).toBe(false);
  expect(getWorkouts).not.toHaveBeenCalled();
  available = true;
  getWorkouts.mockRejectedValueOnce(new Error('query failed'));
  expect(await challenges.joinWeeklyChallenge()).toBe(false);
  expect(challenges.getChallengesState().enrolled).toBe(false);
  expect(challenges.getChallengesState().error).toContain('try again');
  expect(await challenges.joinWeeklyChallenge()).toBe(true);
});
