import { beforeEach, expect, mock, test } from 'bun:test';

const persisted = new Map<string, unknown>();
let permissionNeeded = true;
let registered = false;
let available = true;
let executor: (body: { error?: unknown }) => Promise<number>;
let props: any;
let challengeProps: any;
let workouts: any[] = [];
const requestAccess = mock(async () => { permissionNeeded = false; });
const getWorkouts = mock(async () => workouts);
const register = mock(async (_name: string, _options: unknown) => { registered = true; });
const unregister = mock(async () => { registered = false; });

mock.module('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
mock.module('expo-linking', () => ({ createURL: (path: string) => `ecomdemo://${path}` }));
mock.module('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
mock.module('expo-task-manager', () => ({
  defineTask: (_name: string, callback: typeof executor) => { executor = callback; },
  isAvailableAsync: async () => true,
  isTaskRegisteredAsync: async () => registered,
}));
mock.module('expo-background-task', () => ({
  BackgroundTaskStatus: { Available: 2, Restricted: 1 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: async () => available ? 2 : 1,
  registerTaskAsync: register,
  unregisterTaskAsync: unregister,
}));
mock.module('../../../modules/brooks-activity/src/BrooksActivityModule', () => ({ default: {
  isAvailable: () => true,
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
mock.module('../../../src/widgets/shoe-mileage', () => ({
  updateShoeMileageWidget: (value: unknown) => { props = value; },
  shoeImageFile: () => null,
}));
mock.module('../../../src/widgets/weekly-challenge', () => ({
  updateWeeklyChallengeWidget: (value: unknown) => { challengeProps = value; },
}));
const shoes = await import('../../../src/store/shoes');
const member = await import('../../../src/store/member');
const challenges = await import('../../../src/store/challenges');
const pair = () => shoes.addShoe({
  name: 'Ghost', productId: null, colorCode: null, startedAt: Date.now() - 56 * 86_400_000,
  startMiles: 200, limitMiles: 300, kinds: ['run'],
});

beforeEach(async () => {
  member.leave();
  await challenges.refreshChallenges();
  for (const shoe of shoes.getShoesState().shoes) shoes.removeShoe(shoe.id);
  await shoes.reconcileBackgroundSync();
  permissionNeeded = true;
  available = true;
  registered = false;
  workouts = [];
  requestAccess.mockClear();
  register.mockClear();
  unregister.mockClear();
  getWorkouts.mockReset();
  getWorkouts.mockImplementation(async () => workouts);
});

test('registers only after authorization, once; removes the job after the last pair retires', async () => {
  const shoe = pair();
  await shoes.reconcileBackgroundSync();
  expect(register).not.toHaveBeenCalled();
  expect(requestAccess).not.toHaveBeenCalled();
  await shoes.refreshMileage({ ask: true });
  await shoes.reconcileBackgroundSync();
  expect(register).toHaveBeenCalledWith('brooks.shoe-mileage', { minimumInterval: 60 });
  expect(requestAccess).toHaveBeenCalledTimes(1);
  await shoes.refreshMileage();
  await shoes.reconcileBackgroundSync();
  expect(register).toHaveBeenCalledTimes(1);
  shoes.retireShoe(shoe.id);
  await shoes.reconcileBackgroundSync();
  expect(unregister).toHaveBeenCalledTimes(1);
});

test('headless task publishes recomputed mileage, handles deletions and preserves cache on failure', async () => {
  const shoe = pair();
  permissionNeeded = false;
  workouts = [{ kind: 'run', start: Date.now() - 86_400_000, distanceMeters: 10 * 1609.344 }];
  expect(await executor({})).toBe(1);
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBeCloseTo(10);
  expect(props.miles).toBe('210 of 300 mi');
  expect(persisted.get('brooks.shoes.miles.v1')).toEqual({
    byShoe: shoes.getShoesState().byShoe, readAt: shoes.getShoesState().readAt,
  });
  expect(await executor({})).toBe(1);
  expect(props.miles).toBe('210 of 300 mi');
  workouts = [];
  expect(await executor({})).toBe(1);
  expect(props.miles).toBe('200 of 300 mi');
  const previous = shoes.getShoesState();
  getWorkouts.mockRejectedValueOnce(new Error('Health data locked'));
  expect(await executor({})).toBe(2);
  expect(shoes.getShoesState()).toBe(previous);
  expect(await executor({ error: new Error('task failed') })).toBe(2);
  expect(requestAccess).not.toHaveBeenCalled();
});

test('rereads after a shoe is removed during an in-flight query', async () => {
  const shoe = pair();
  permissionNeeded = false;
  let finish!: (value: any[]) => void;
  getWorkouts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const read = shoes.refreshMileage();
  await new Promise(resolve => setTimeout(resolve, 0));
  shoes.removeShoe(shoe.id);
  finish([{ kind: 'run', start: Date.now(), distanceMeters: 1609.344 }]);
  expect(await read).toBe(true);
  expect(shoes.getShoesState().byShoe[shoe.id]).toBeUndefined();
  expect(props.hasShoe).toBe(false);
});

test('restricted scheduling leaves foreground reads working and background never requests permission', async () => {
  const shoe = pair();
  available = false;
  expect(await executor({})).toBe(1);
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(requestAccess).not.toHaveBeenCalled();
  permissionNeeded = false;
  expect(await shoes.refreshMileage()).toBe(true);
  await shoes.reconcileBackgroundSync();
  expect(register).not.toHaveBeenCalled();
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBe(0);
});

test('the same scheduled job serves an enrolled challenge without shoes and is removed on sign-out', async () => {
  member.join({ email: 'challenge-only@example.com', firstName: 'Alex' });
  workouts = [{ id: 'run-a', kind: 'run', start: Date.now(), distanceMeters: 5400, durationMinutes: 30, indoor: false }];
  await challenges.joinWeeklyChallenge();
  await shoes.reconcileBackgroundSync();
  expect(register).toHaveBeenCalledWith('brooks.shoe-mileage', { minimumInterval: 60 });
  expect(challengeProps.phase).toBe('complete');
  expect(await executor({})).toBe(1);
  expect(challengeProps.distance).toBe('5.4');
  getWorkouts.mockRejectedValueOnce(new Error('Health locked'));
  expect(await executor({})).toBe(2);
  expect(challengeProps.distance).toBe('5.4');
  expect(requestAccess).toHaveBeenCalledTimes(1);
  member.leave();
  await shoes.reconcileBackgroundSync();
  expect(challengeProps.phase).toBe('invitation');
  expect(unregister).toHaveBeenCalledTimes(1);
});
