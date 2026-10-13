import ExpoModulesCore
import HealthKit
import OSLog
import WidgetKit

let shoeMileageUpdated = Notification.Name("BrooksShoeMileageUpdated")

// Registered before React Native starts, so a HealthKit wake can finish with
// no JS runtime. @ref LLP 0006#background-health-sync
public class BrooksHealthSyncSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    BrooksHealthSync.shared.updateObservers()
    return false
  }

}

final class BrooksHealthSync: @unchecked Sendable {
  static let shared = BrooksHealthSync()
  private static let health = HKHealthStore()
  private static let logger = Logger(subsystem: "com.brooks.activity", category: "MileageSync")
  static var isFullApp: Bool { Bundle.main.object(forInfoDictionaryKey: "NSAppClip") == nil }
  private let enabledKey = "brooks.shoes.background-enabled.v1"
  private let lock = NSLock()
  private var observers: [HKObserverQuery] = []
  private var unlockObserver: NSObjectProtocol?
  let sync: ShoeMileageSync

  private init() {
    sync = ShoeMileageSync(
      read: Self.readWorkouts,
      publish: MileageWidgetPublisher.publish,
      changed: { NotificationCenter.default.post(name: shoeMileageUpdated, object: nil) }
    )
    unlockObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.protectedDataDidBecomeAvailableNotification, object: nil, queue: nil
    ) { [weak self] _ in self?.retryAfterUnlock() }
  }

  // Called only after the Health authorization sheet has been answered. Read
  // denial is deliberately indistinguishable from an empty Health store.
  func enable() {
    guard Self.isFullApp else { return }
    UserDefaults.standard.set(true, forKey: enabledKey)
    updateObservers(retryRegistration: true)
  }

  func updateObservers(retryRegistration: Bool = false) {
    guard Self.isFullApp, HKHealthStore.isHealthDataAvailable() else { return }
    lock.lock()
    defer { lock.unlock() }
    let shouldObserve = UserDefaults.standard.bool(forKey: enabledKey) && sync.hasActiveShoes
    let types: [(HKSampleType, HKUpdateFrequency)] = [
      (HKObjectType.workoutType(), .immediate),
      // A watch can sync distance samples after its workout record arrives.
      (HKQuantityType(.distanceWalkingRunning), .hourly),
    ]
    guard shouldObserve else {
      if !observers.isEmpty {
        observers.forEach { Self.health.stop($0) }
        observers.removeAll()
        for (type, _) in types { Self.health.disableBackgroundDelivery(for: type) { _, _ in } }
      }
      return
    }
    if !observers.isEmpty && !retryRegistration { return }
    if observers.isEmpty {
      for (type, _) in types {
        let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
          guard error == nil else {
            Self.logger.error("Health observer failed; retaining cached mileage")
            completion()
            return
          }
          self.sync.refresh { result in
            if case .failure = result {
              Self.logger.error("Health refresh failed; retaining cached mileage until the next delivery or unlock")
            }
            // Includes timeout and error paths. Never wait for React Native.
            completion()
          }
        }
        observers.append(query)
        Self.health.execute(query)
      }
    }
    // Retry registration on foreground refresh too, after a transient failure.
    for (type, frequency) in types {
      Self.health.enableBackgroundDelivery(for: type, frequency: frequency) { success, _ in
        if !success { Self.logger.error("Health background delivery registration failed") }
      }
    }
  }

  func retryAfterUnlock() {
    guard Self.isFullApp, UserDefaults.standard.bool(forKey: enabledKey), sync.hasActiveShoes else { return }
    sync.refresh { _ in }
  }

  private static func readWorkouts(
    start: Date,
    completion: @escaping (Result<[MileageWorkout], Error>) -> Void
  ) -> (() -> Void) {
    let kinds: [HKWorkoutActivityType: String] = [.running: "run", .walking: "walk", .hiking: "hike"]
    let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
      HKQuery.predicateForSamples(withStart: start, end: Date()),
      NSCompoundPredicate(orPredicateWithSubpredicates: kinds.keys.map { HKQuery.predicateForWorkouts(with: $0) }),
    ])
    let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
      if let error { completion(.failure(error)); return }
      let workouts = (samples as? [HKWorkout] ?? []).map {
        MileageWorkout(
          kind: kinds[$0.workoutActivityType] ?? "other",
          start: $0.startDate.timeIntervalSince1970 * 1000,
          distanceMeters: $0.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity()?.doubleValue(for: .meter())
        )
      }
      completion(.success(workouts))
    }
    health.execute(query)
    return { health.stop(query) }
  }
}

enum MileageWidgetPublisher {
  // expo-widgets 57.0.23's WidgetObject.updateTimeline storage contract.
  // Its Swift writer is internal, so this small adapter is covered by a
  // contract test. @ref LLP 0006#native-widget-publishing
  static func publish(configuration: MileageConfiguration, snapshot: MileageSnapshot) {
    guard BrooksHealthSync.isFullApp,
          let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
          let defaults = UserDefaults(suiteName: group),
          defaults.string(forKey: "__expo_widgets_ShoeMileage_layout") != nil else { return }
    let props = ShoeMileageModel.widgetProps(configuration, snapshot: snapshot)
    let key = "__expo_widgets_ShoeMileage_timeline"
    let existing = (defaults.array(forKey: key)?.first as? [String: Any])?["props"] as? NSDictionary
    guard existing != (props as NSDictionary) else { return }
    defaults.set([["timestamp": Int(Date().timeIntervalSince1970 * 1000), "props": props]], forKey: key)
    WidgetCenter.shared.reloadTimelines(ofKind: "ShoeMileage")
  }
}
