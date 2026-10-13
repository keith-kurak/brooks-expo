import Foundation

func check(_ condition: Bool, _ message: String) {
  if !condition { fatalError(message) }
}

func wait(_ semaphore: DispatchSemaphore) {
  check(semaphore.wait(timeout: .now() + 3) == .success, "Timed out waiting for sync")
}

final class Reader: @unchecked Sendable {
  let ready = DispatchSemaphore(value: 0)
  let lock = NSLock()
  var pending: [(Date, (Result<[MileageWorkout], Error>) -> Void)] = []
  var cancelled = false
  func read(_ date: Date, _ completion: @escaping (Result<[MileageWorkout], Error>) -> Void) -> (() -> Void) {
    lock.lock()
    pending.append((date, completion))
    lock.unlock()
    ready.signal()
    return { self.lock.lock(); self.cancelled = true; self.lock.unlock() }
  }
  func next() -> (Date, (Result<[MileageWorkout], Error>) -> Void) {
    wait(ready)
    lock.lock()
    defer { lock.unlock() }
    return pending.removeFirst()
  }
}

let suite = "BrooksMileageTests.\(UUID().uuidString)"
let defaults = UserDefaults(suiteName: suite)!
defer { defaults.removePersistentDomain(forName: suite) }
let at = 1_800_000_000_000.0
let shoe = MileageShoe(id: "one", name: "Ghost", startedAt: at - 40 * ShoeMileageModel.day,
                       startMiles: 200, limitMiles: 300, kinds: ["run"], retiredAt: nil, image: "")
let config = MileageConfiguration(shoes: [shoe], url: "ecomdemo://shoes")
let seed = MileageSnapshot(byShoe: ["one": ShoeHealthMiles(miles: 50, workouts: 10, weeklyMiles: 12)], readAt: at - 1000)
let reader = Reader()
let published = DispatchSemaphore(value: 0)
let sync = ShoeMileageSync(defaults: defaults, now: { Date(timeIntervalSince1970: at / 1000) },
                           read: reader.read, publish: { _, _ in published.signal() }, changed: {})
_ = try sync.configure(config, initial: seed)
func current(_ engine: ShoeMileageSync = sync) throws -> MileageSnapshot {
  try JSONDecoder().decode(MileageSnapshot.self, from: Data(engine.snapshotJSON().utf8))
}

// Health errors preserve the last good result and still complete the delivery.
let failed = DispatchSemaphore(value: 0)
sync.refresh { result in
  if case .success = result { fatalError("Expected failure") }
  failed.signal()
}
reader.next().1(.failure(NSError(domain: "LockedHealthStore", code: 1)))
wait(failed)
check(try current().byShoe["one"]?.miles == 50, "Error erased cached miles")
check(try current().readAt == seed.readAt, "Error advanced freshness")

// Overlapping deliveries get one fresh recomputation, never additive deltas.
let finished = DispatchSemaphore(value: 0)
sync.refresh { _ in finished.signal() }
let first = reader.next()
sync.refresh { _ in finished.signal() }
_ = try sync.snapshotJSON() // queue barrier after the second request
first.1(.success([MileageWorkout(kind: "run", start: at - 100, distanceMeters: 500 * 1609.344)]))
let latest = reader.next()
latest.1(.success([MileageWorkout(kind: "run", start: at - 100, distanceMeters: 5 * 1609.344)]))
wait(finished)
wait(finished)
check(try current().byShoe["one"]?.miles == 5, "Coalesced delivery used an older read")

// A cold JS launch supplies stale SQLite totals; the persisted native value wins.
let restarted = ShoeMileageSync(defaults: defaults, read: reader.read, publish: { _, _ in }, changed: {})
_ = try restarted.configure(config, initial: seed)
check(try current(restarted).byShoe["one"]?.miles == 5, "Cold launch overwrote background miles")

// Removing all shoes while a read is pending cannot republish the old pair.
sync.refresh { _ in finished.signal() }
let outdated = reader.next()
_ = try sync.configure(MileageConfiguration(shoes: [], url: config.url), initial: seed)
outdated.1(.success([MileageWorkout(kind: "run", start: at - 100, distanceMeters: 900 * 1609.344)]))
wait(finished)
check(try current().byShoe.isEmpty, "Removed shoe resurrected")

// A deleted workout lowers the total on the next read.
_ = try sync.configure(config, initial: seed)
sync.refresh { _ in finished.signal() }
reader.next().1(.success([]))
wait(finished)
check(try current().byShoe["one"]?.miles == 0, "Deleted workout still counted")

// A stuck Health query is cancelled and its later callback cannot commit.
let slow = Reader()
let timeoutSync = ShoeMileageSync(defaults: defaults, timeout: 0.02, read: slow.read, publish: { _, _ in }, changed: {})
_ = try timeoutSync.configure(config, initial: seed)
timeoutSync.refresh { result in
  if case .success = result { fatalError("Expected timeout") }
  finished.signal()
}
let late = slow.next()
wait(finished)
late.1(.success([MileageWorkout(kind: "run", start: at - 100, distanceMeters: 99 * 1609.344)]))
check(try current(timeoutSync).byShoe["one"]?.miles == 0, "Late callback overwrote persisted result")
check(slow.cancelled, "Timed-out query was not cancelled")

// Return native calculations for the same fixtures the Bun test feeds to TS.
struct Fixture: Decodable {
  let shoes: [MileageShoe]
  let workouts: [MileageWorkout]
  let now: Double
}
let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let fixtures = try JSONDecoder().decode([Fixture].self, from: input)
let output: [[String: Any]] = try fixtures.map { fixture in
  let snapshot = MileageSnapshot(byShoe: Dictionary(uniqueKeysWithValues: fixture.shoes.map {
    ($0.id, ShoeMileageModel.sum($0, workouts: fixture.workouts, now: fixture.now))
  }), readAt: fixture.now)
  let snapshotObject = try JSONSerialization.jsonObject(with: JSONEncoder().encode(snapshot))
  return ["snapshot": snapshotObject,
          "widget": ShoeMileageModel.widgetProps(MileageConfiguration(shoes: fixture.shoes, url: config.url), snapshot: snapshot)]
}
try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
  .write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
