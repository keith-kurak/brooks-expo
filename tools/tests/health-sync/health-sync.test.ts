import { afterAll, expect, mock, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

mock.module('../../../modules/brooks-activity/src/BrooksActivityModule', () => ({ default: null }));
const { sumFor, mileageOf, formatMileage } = await import('../../../src/data/mileage');

const temp = mkdtempSync(join(tmpdir(), 'brooks-health-tests-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const native = 'modules/brooks-activity/ios';
const executable = join(temp, 'health-sync-tests');
const now = 1_800_000_000_000;
const day = 86_400_000;
const base = {
  id: 'one', name: 'Ghost', productId: null, colorCode: null, addedAt: now,
  startedAt: now - 40 * day, startMiles: 200, limitMiles: 300,
  kinds: ['run'], retiredAt: null, image: '',
};
const workouts = [
  { kind: 'run', start: base.startedAt - 1, distanceMeters: 20 * 1609.344 },
  { kind: 'run', start: base.startedAt, distanceMeters: 5 * 1609.344 },
  { kind: 'run', start: now - 7 * day, distanceMeters: 7 * 1609.344 },
  { kind: 'walk', start: now - 3 * day, distanceMeters: 3 * 1609.344 },
  { kind: 'hike', start: now - 2 * day, distanceMeters: 4 * 1609.344 },
  { kind: 'run', start: now - day, distanceMeters: null },
];
const fixtures = [
  { shoes: [base], workouts, now },
  { shoes: [{ ...base, kinds: ['run', 'walk', 'hike'] }], workouts, now },
  { shoes: [{ ...base, retiredAt: now - 7 * day }], workouts, now },
  { shoes: [{ ...base, startedAt: now - 2 * day }], workouts, now },
  { shoes: [{ ...base, startMiles: 1200, limitMiles: 500 }], workouts: [], now },
  { shoes: [{ ...base, startMiles: 209.999, limitMiles: 300 }], workouts: [], now },
  { shoes: [{ ...base, startMiles: 210, limitMiles: 300 }], workouts: [], now },
  { shoes: [base, { ...base, id: 'two', startMiles: 350, limitMiles: 400, image: 'file:///shoe.png' }], workouts, now },
  { shoes: [], workouts, now },
];

test('native sync preserves data through errors, concurrent deliveries, relaunch, deletion and timeout', () => {
  const build = spawnSync('swiftc', [`${native}/ShoeMileageModel.swift`, `${native}/ShoeMileageSync.swift`,
    'tools/tests/health-sync/main.swift', '-o', executable], { encoding: 'utf8' });
  expect(build.status, build.stderr).toBe(0);
  const input = join(temp, 'fixtures.json');
  const output = join(temp, 'results.json');
  writeFileSync(input, JSON.stringify(fixtures));
  const run = spawnSync(executable, [input, output], { encoding: 'utf8', timeout: 15000 });
  expect(run.status, `${run.stderr}\n${run.stdout}\n${run.error ?? ''} ${run.signal ?? ''}`).toBe(0);
  const results = JSON.parse(readFileSync(output, 'utf8'));
  for (const [index, fixture] of fixtures.entries()) {
    let mostWorn = null;
    for (const shoe of fixture.shoes) {
      const expected = sumFor(shoe, fixture.workouts, fixture.now);
      const actual = results[index].snapshot.byShoe[shoe.id];
      expect(actual.miles).toBeCloseTo(expected.miles, 9);
      expect(actual.workouts).toBe(expected.workouts);
      if (expected.weeklyMiles == null) expect(actual.weeklyMiles ?? null).toBeNull();
      else expect(actual.weeklyMiles).toBeCloseTo(expected.weeklyMiles, 9);
      const mileage = mileageOf(shoe, expected);
      if (shoe.retiredAt == null && (!mostWorn || mileage.share > mostWorn.mileage.share)) mostWorn = { shoe, mileage };
    }
    const widget = results[index].widget;
    expect(widget.hasShoe).toBe(!!mostWorn);
    if (!mostWorn) continue;
    const { shoe, mileage: m } = mostWorn;
    expect(widget.name).toBe(shoe.name);
    expect(widget.image).toBe(shoe.image);
    expect(widget.miles).toBe(m.milesLabel);
    expect(widget.milesShort).toBe(formatMileage(m.totalMiles));
    expect(widget.share).toBeCloseTo(Math.min(1, m.share), 9);
    expect(widget.percent).toBe(`${m.percent}%`);
    expect(widget.replace).toBe(m.replace);
    expect(widget.status).toBe(m.replace ? 'Time to replace' : `${formatMileage(m.milesLeft)} mi left`);
    const weeks = m.weeksLeft == null || m.milesLeft <= 0 ? null : Math.max(1, Math.round(m.weeksLeft));
    expect(widget.pace).toBe(weeks == null ? '' : `About ${weeks} ${weeks === 1 ? 'week' : 'weeks'} left`);
  }
}, 30000);

test('native widget adapter matches the installed Expo Widgets timeline contract', () => {
  const root = resolve('node_modules/expo-widgets');
  const writer = readFileSync(join(root, 'ios/WidgetObject.swift'), 'utf8');
  const records = readFileSync(join(root, 'ios/WidgetsRecords.swift'), 'utf8');
  const storage = readFileSync(join(root, 'ios/WidgetsStorage.swift'), 'utf8');
  const parser = readFileSync(join(root, 'ios/Widgets/Utils.swift'), 'utf8');
  expect(writer).toContain('__expo_widgets_\\(name)_timeline');
  expect(writer).toContain('__expo_widgets_\\(name)_layout');
  expect(records).toContain('@Field var timestamp: Int');
  expect(records).toContain('@Field var props: [String: Any]');
  expect(storage).toContain('ExpoWidgetsAppGroupIdentifier');
  expect(storage).toContain('UserDefaults(suiteName: appGroupIdentifier)');
  expect(parser).toContain('Double(timestamp) / 1000');
});
