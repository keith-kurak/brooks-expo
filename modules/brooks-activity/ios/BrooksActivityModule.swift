import ExpoModulesCore
import HealthKit

/**
 * Read-only access to the Apple Health data the Shoe Finder can use: running,
 * walking and hiking workouts, and daily step totals.
 *
 * @ref LLP 0005#native-returns-summaries-js-decides — Native code runs the
 * HealthKit queries and returns one small record per workout and one total per
 * day. It makes no judgment about what the numbers mean. The thresholds that
 * turn them into Finder answers live in TypeScript, so they can be tuned with
 * Fast Refresh instead of a native rebuild.
 */
public class BrooksActivityModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("BrooksActivity")

    Function("isAvailable") {
      return Bundle.main.object(forInfoDictionaryKey: "NSAppClip") == nil && HKHealthStore.isHealthDataAvailable()
    }

    // True when the system sheet would appear, false when the user has already
    // answered it. HealthKit never says *what* they answered for read access.
    AsyncFunction("shouldRequestAccessAsync") { () async throws -> Bool in
      try ensureAvailable()
      let status = try await store.statusForAuthorizationRequest(toShare: [], read: readTypes)
      return status == .shouldRequest
    }

    AsyncFunction("requestAccessAsync") { () async throws in
      try ensureAvailable()
      try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    AsyncFunction("getWorkoutsAsync") { (days: Int) async throws -> [WorkoutRecord] in
      try ensureAvailable()
      let kinds = Array(WORKOUT_KINDS.keys)
      let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
        windowPredicate(days: days),
        NSCompoundPredicate(orPredicateWithSubpredicates: kinds.map { HKQuery.predicateForWorkouts(with: $0) }),
      ])
      let query = HKSampleQueryDescriptor(
        predicates: [.workout(predicate)],
        sortDescriptors: [SortDescriptor(\.startDate, order: .reverse)]
      )
      return try await query.result(for: store).map(WorkoutRecord.init)
    }

    AsyncFunction("getDailyStepsAsync") { (days: Int) async throws -> [DailyStepsRecord] in
      try ensureAvailable()
      let (start, end) = window(days: days)
      // A statistics query, not a sample query: HealthKit merges overlapping
      // iPhone and Apple Watch step samples here, and a plain sum would count
      // the same walk twice.
      let query = HKStatisticsCollectionQueryDescriptor(
        predicate: .quantitySample(
          type: HKQuantityType(.stepCount),
          predicate: HKQuery.predicateForSamples(withStart: start, end: end)
        ),
        options: .cumulativeSum,
        anchorDate: start,
        intervalComponents: DateComponents(day: 1)
      )
      let collection = try await query.result(for: store)
      var result: [DailyStepsRecord] = []
      collection.enumerateStatistics(from: start, to: end) { stats, _ in
        let record = DailyStepsRecord()
        record.date = stats.startDate.timeIntervalSince1970 * 1000
        record.steps = stats.sumQuantity()?.doubleValue(for: .count()) ?? 0
        result.append(record)
      }
      return result
    }

    // Debug builds only. Writes eight weeks of plausible road-runner data so the
    // Finder can be exercised on a simulator, where Health starts empty.
    // @ref LLP 0005#read-only-by-default — Compiled out of Release, so the
    // store binary contains no HealthKit write calls at all.
    #if DEBUG
    AsyncFunction("seedSampleDataAsync") { () async throws in
      try ensureAvailable()
      try await seedSampleData()
    }
    #endif
  }

  // MARK: - Queries

  private var readTypes: Set<HKObjectType> {
    [HKObjectType.workoutType(), HKQuantityType(.stepCount), HKQuantityType(.distanceWalkingRunning)]
  }

  private func ensureAvailable() throws {
    guard Bundle.main.object(forInfoDictionaryKey: "NSAppClip") == nil, HKHealthStore.isHealthDataAvailable() else {
      throw HealthUnavailableException()
    }
  }

  /// Whole days ending now, starting at local midnight.
  private func window(days: Int) -> (Date, Date) {
    let end = Date()
    let today = Calendar.current.startOfDay(for: end)
    let start = Calendar.current.date(byAdding: .day, value: -(max(days, 1) - 1), to: today) ?? today
    return (start, end)
  }

  private func windowPredicate(days: Int) -> NSPredicate {
    let (start, end) = window(days: days)
    return HKQuery.predicateForSamples(withStart: start, end: end)
  }

  // MARK: - Sample data

  #if DEBUG
  private func seedSampleData() async throws {
    let workoutType = HKObjectType.workoutType()
    let steps = HKQuantityType(.stepCount)
    let distance = HKQuantityType(.distanceWalkingRunning)
    try await store.requestAuthorization(toShare: [workoutType, steps, distance], read: readTypes)

    // Replace, never append: only samples this app wrote are removed.
    let ours = HKQuery.predicateForObjects(from: HKSource.default())
    for type in [workoutType, steps, distance] as [HKObjectType] {
      _ = try? await store.deleteObjects(of: type, predicate: ours)
    }

    let calendar = Calendar.current
    let today = calendar.startOfDay(for: Date())
    let mile = 1609.344

    for daysAgo in 1...56 {
      guard let day = calendar.date(byAdding: .day, value: -daysAgo, to: today) else { continue }
      let week = daysAgo / 7
      let weekday = calendar.component(.weekday, from: day)

      // Tuesday and Thursday easy runs and a Sunday long run that builds
      // toward half-marathon distance: about 22 mi a week, all on road.
      var miles: Double?
      switch weekday {
      case 3: miles = 5
      case 5: miles = 6
      case 1: miles = 13.1 - Double(week) * 0.6
      default: miles = nil
      }
      if let miles {
        let start = calendar.date(byAdding: .hour, value: 7, to: day) ?? day
        let minutes = miles * 9.5
        try await saveWorkout(
          .running,
          start: start,
          minutes: minutes,
          meters: miles * mile,
          climbMeters: miles * 8
        )
      }

      if weekday == 7 {
        let start = calendar.date(byAdding: .hour, value: 10, to: day) ?? day
        try await saveWorkout(.walking, start: start, minutes: 45, meters: 2.5 * mile, climbMeters: 10)
      }

      let stepStart = calendar.date(byAdding: .hour, value: 8, to: day) ?? day
      let stepEnd = calendar.date(byAdding: .hour, value: 20, to: day) ?? day
      let count = 7200 + Double((daysAgo * 1373) % 4100)
      try await store.save(
        HKQuantitySample(
          type: steps,
          quantity: HKQuantity(unit: .count(), doubleValue: count),
          start: stepStart,
          end: stepEnd
        )
      )
    }
  }

  private func saveWorkout(
    _ type: HKWorkoutActivityType,
    start: Date,
    minutes: Double,
    meters: Double,
    climbMeters: Double
  ) async throws {
    let end = start.addingTimeInterval(minutes * 60)
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = type
    configuration.locationType = .outdoor

    // A builder rather than the deprecated HKWorkout initializer, so the saved
    // workout carries the per-type statistics the reader relies on.
    let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
    try await builder.beginCollection(at: start)
    try await builder.addSamples([
      HKQuantitySample(
        type: HKQuantityType(.distanceWalkingRunning),
        quantity: HKQuantity(unit: .meter(), doubleValue: meters),
        start: start,
        end: end
      ),
    ])
    try await builder.addMetadata([
      HKMetadataKeyIndoorWorkout: false,
      HKMetadataKeyElevationAscended: HKQuantity(unit: .meter(), doubleValue: climbMeters),
    ])
    try await builder.endCollection(at: end)
    _ = try await builder.finishWorkout()
  }
  #endif
}

// MARK: - Records

private let WORKOUT_KINDS: [HKWorkoutActivityType: String] = [
  .running: "run",
  .walking: "walk",
  .hiking: "hike",
]

struct WorkoutRecord: Record {
  // @ref LLP 0008#weekly-challenge-implementation — Stable identity prevents counting a workout twice.
  @Field var id: String = ""
  /// "run", "walk" or "hike".
  @Field var kind: String = ""
  /// Milliseconds since the epoch, so JS can hand it straight to `new Date()`.
  @Field var start: Double = 0
  @Field var durationMinutes: Double = 0
  @Field var distanceMeters: Double? = nil
  @Field var elevationGainMeters: Double? = nil
  /// True for a treadmill run or an indoor walk.
  @Field var indoor: Bool = false

  init() {}

  init(_ workout: HKWorkout) {
    id = workout.uuid.uuidString
    kind = WORKOUT_KINDS[workout.workoutActivityType] ?? "other"
    start = workout.startDate.timeIntervalSince1970 * 1000
    durationMinutes = workout.duration / 60
    // `totalDistance` is deprecated from iOS 18; the per-type statistics are
    // what the Workout app and HKWorkoutBuilder write now.
    distanceMeters = workout.statistics(for: HKQuantityType(.distanceWalkingRunning))?
      .sumQuantity()?
      .doubleValue(for: .meter())
    let metadata = workout.metadata ?? [:]
    elevationGainMeters = (metadata[HKMetadataKeyElevationAscended] as? HKQuantity)?.doubleValue(for: .meter())
    indoor = (metadata[HKMetadataKeyIndoorWorkout] as? NSNumber)?.boolValue ?? false
  }
}

struct DailyStepsRecord: Record {
  /// Local midnight that starts the day, in milliseconds since the epoch.
  @Field var date: Double = 0
  @Field var steps: Double = 0

  init() {}
}

// MARK: - Exceptions

final class HealthUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "Health data is not available on this device"
  }
}
