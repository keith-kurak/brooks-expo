import { beforeEach, expect, mock, test } from 'bun:test';

const persisted = new Map<string, unknown>();
let permissionNeeded = true;
let registered = false;
let available = true;
let executor: (body: { error?: unknown }) => Promise<number>;
let props: any;
let workouts: any[] = [];
let accessOverride: Record<string, unknown> = {};
let exposeAndroidAccess = true;
const requestAccess = mock(async () => { permissionNeeded = false; });
const getWorkouts = mock(async () => workouts);
const getDailySteps = mock(async () => []);
const openSettings = mock(async () => {});
const showAlert = mock();
const register = mock(async (_name: string, _options: unknown) => { registered = true; });
const unregister = mock(async () => { registered = false; });

mock.module('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
mock.module('expo-linking', () => ({ createURL: (path: string) => `ecomdemo://${path}` }));
mock.module('react-native', () => ({ Alert: { alert: showAlert }, AppState: { addEventListener: () => ({ remove() {} }) } }));
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
  getDailyStepsAsync: getDailySteps,
  openSettingsAsync: openSettings,
  get getAccessAsync() { return exposeAndroidAccess ? async () => ({
    status: 'available', workouts: !permissionNeeded, distance: !permissionNeeded, steps: !permissionNeeded,
    elevation: !permissionNeeded, background: !permissionNeeded, historyAvailable: true,
    backgroundAvailable: true, maxReadDays: null, ...accessOverride,
  }) : undefined; },
} }));
mock.module('../../../src/utils/app-clip', () => ({ isAppClip: false }));
mock.module('../../../src/utils/kv-storage', () => ({ storage: {
  get: (key: string, fallback: unknown) => persisted.get(key) ?? fallback,
  set: (key: string, value: unknown) => persisted.set(key, value),
} }));
mock.module('../../../src/widgets/shoe-mileage', () => ({
  updateShoeMileageWidget: (value: unknown) => { props = value; },
  shoeImageFile: () => null,
}));
const shoes = await import('../../../src/store/shoes');
const pair = () => shoes.addShoe({
  name: 'Ghost', productId: null, colorCode: null, startedAt: Date.now() - 56 * 86_400_000,
  startMiles: 200, limitMiles: 300, kinds: ['run'],
});

beforeEach(async () => {
  for (const shoe of shoes.getShoesState().shoes) shoes.removeShoe(shoe.id);
  await shoes.reconcileBackgroundSync();
  permissionNeeded = true;
  accessOverride = {};
  exposeAndroidAccess = true;
  available = true;
  registered = false;
  workouts = [];
  requestAccess.mockClear();
  register.mockClear();
  unregister.mockClear();
  getWorkouts.mockReset();
  getWorkouts.mockImplementation(async () => workouts);
  openSettings.mockReset();
  openSettings.mockImplementation(async () => {});
  showAlert.mockClear();
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
  expect(shoes.getShoesState().byShoe).toBe(previous.byShoe);
  expect(shoes.getShoesState().readAt).toBe(previous.readAt);
  expect(await executor({ error: new Error('task failed') })).toBe(2);
  expect(requestAccess).not.toHaveBeenCalled();
});

test('Android foreground sync works without a background grant; scheduled reads never run or prompt', async () => {
  const shoe = pair();
  permissionNeeded = false;
  accessOverride = { background: false };
  workouts = [{ kind: 'run', start: Date.now() - 86_400_000, distanceMeters: 5 * 1609.344 }];
  expect(await shoes.refreshMileage()).toBe(true);
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBeCloseTo(5);
  await shoes.reconcileBackgroundSync();
  expect(register).not.toHaveBeenCalled();
  getWorkouts.mockClear();
  expect(await executor({})).toBe(1);
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(requestAccess).not.toHaveBeenCalled();
});

test('older iOS binaries still use the HealthKit sheet-answered contract', async () => {
  exposeAndroidAccess = false;
  const shoe = pair();
  expect(await shoes.refreshMileage()).toBe(true);
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(requestAccess).not.toHaveBeenCalled();
  workouts = [{ kind: 'run', start: Date.now() - 86_400_000, distanceMeters: 1609.344 }];
  expect(await shoes.refreshMileage({ ask: true })).toBe(true);
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBeCloseTo(1);
  await shoes.reconcileBackgroundSync();
  expect(register).toHaveBeenCalledTimes(1);
});

test('settings failure gives a recovery message instead of an unhandled rejection', async () => {
  const { openHealthSettings } = await import('../../../src/utils/health');
  openSettings.mockRejectedValueOnce(new Error('Settings unavailable'));
  await openHealthSettings();
  expect(showAlert).toHaveBeenCalledWith('Health Connect could not be opened',
    'Open Health Connect in Android Settings to manage Brooks access.');
});

test('revoking distance or history preserves the last complete mileage and read time', async () => {
  const shoe = pair();
  permissionNeeded = false;
  workouts = [{ kind: 'run', start: Date.now() - 86_400_000, distanceMeters: 12 * 1609.344 }];
  await shoes.refreshMileage();
  const previous = shoes.getShoesState();
  accessOverride = { distance: false };
  workouts = [];
  getWorkouts.mockClear();
  expect(await shoes.refreshMileage()).toBe(true);
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(shoes.getShoesState().byShoe).toBe(previous.byShoe);
  accessOverride = { maxReadDays: 28 };
  await shoes.reconcileBackgroundSync();
  expect(registered).toBe(false);
  expect(await shoes.refreshMileage()).toBe(false);
  expect(getWorkouts).not.toHaveBeenCalled();
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBeCloseTo(12);
  expect(shoes.getShoesState().readAt).toBe(previous.readAt);
  expect(shoes.getShoesState().syncError).toContain('earlier history');
  accessOverride = {};
  expect(await shoes.refreshMileage()).toBe(true);
  expect(shoes.getShoesState().byShoe[shoe.id].miles).toBe(0);
  expect(shoes.getShoesState().syncError).toBeNull();
});

test('a workout with no distance cannot erase previously counted mileage', async () => {
  const shoe = pair();
  permissionNeeded = false;
  workouts = [{ kind: 'run', start: Date.now() - 86_400_000, distanceMeters: 1609.344 }];
  await shoes.refreshMileage();
  const previous = shoes.getShoesState();
  workouts[0].distanceMeters = null;
  expect(await shoes.refreshMileage()).toBe(false);
  expect(shoes.getShoesState().byShoe).toBe(previous.byShoe);
  expect(shoes.getShoesState().readAt).toBe(previous.readAt);
});

test('limited Finder history uses four-week averages and unknown distance never fills mileage answers', async () => {
  const activity = await import('../../../src/data/activity');
  const { answersFromActivity } = await import('../../../src/screens/finder/from-activity');
  accessOverride = { maxReadDays: 28, steps: false };
  workouts = Array.from({ length: 4 }, (_, index) => ({
    kind: 'run', start: Date.now() - (index + 1) * 86_400_000,
    distanceMeters: 7 * 1609.344, elevationGainMeters: null, indoor: null,
  }));
  const profile = (await activity.readActivityProfile())!;
  expect(getWorkouts).toHaveBeenLastCalledWith(28);
  expect(profile.days).toBe(28);
  expect(profile.weeklyRunMiles).toBeCloseTo(7);
  expect(answersFromActivity(profile).answers.use).toBeUndefined();
  expect(answersFromActivity(profile).answers.rundistance).toEqual(['rundistance1']);
  const missing = activity.summarizeActivity(workouts.map(w => ({ ...w, distanceMeters: null })), [], 28);
  expect(answersFromActivity(missing).answers.rundistance).toBeUndefined();
  expect(answersFromActivity(missing).answers.training).toBeUndefined();
  const elevationOnly = activity.summarizeActivity(workouts.map(w => ({ ...w, distanceMeters: null, elevationGainMeters: 50 })), [], 28);
  expect(answersFromActivity(elevationOnly).answers.use).toBeUndefined();
  const stepsOnly = activity.summarizeActivity([], Array.from({ length: 7 }, (_, date) => ({ date, steps: 10000 })), 28, false);
  expect(answersFromActivity(stepsOnly).answers.use).toBeUndefined();
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
