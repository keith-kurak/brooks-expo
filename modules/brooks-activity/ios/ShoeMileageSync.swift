import Foundation

// All state and callbacks use this serial queue. A configuration change or a
// second delivery during a read forces another pass before completing callers.
// @ref LLP 0006#background-health-sync
final class ShoeMileageSync: @unchecked Sendable {
  typealias Completion = (Result<MileageSnapshot, Error>) -> Void
  typealias Reader = (Date, @escaping (Result<[MileageWorkout], Error>) -> Void) -> (() -> Void)
  private let queue = DispatchQueue(label: "com.brooks.shoe-mileage")
  private let defaults: UserDefaults
  private let read: Reader
  private let publish: (MileageConfiguration, MileageSnapshot) -> Void
  private let changed: () -> Void
  private let now: () -> Date
  private let timeout: TimeInterval
  private let storageKey = "brooks.shoes.native.v1"
  private var state: PersistedMileage
  private var revision = 0
  private var running: UUID?
  private var needsRead = false
  private var completions: [Completion] = []

  init(
    defaults: UserDefaults = .standard,
    timeout: TimeInterval = 20,
    now: @escaping () -> Date = Date.init,
    read: @escaping Reader,
    publish: @escaping (MileageConfiguration, MileageSnapshot) -> Void,
    changed: @escaping () -> Void
  ) {
    self.defaults = defaults
    self.timeout = timeout
    self.now = now
    self.read = read
    self.publish = publish
    self.changed = changed
    state = defaults.data(forKey: storageKey)
      .flatMap { try? JSONDecoder().decode(PersistedMileage.self, from: $0) } ?? PersistedMileage()
  }

  var hasActiveShoes: Bool {
    queue.sync { state.configuration?.shoes.contains { $0.retiredAt == nil } ?? false }
  }

  func snapshotJSON() throws -> String {
    try queue.sync { try json(state.snapshot) }
  }

  func configure(_ configuration: MileageConfiguration, initial: MileageSnapshot) throws -> String {
    try queue.sync {
      // Import the old SQLite totals only once. A JS cold start must never
      // replace a newer native result with its older cached copy.
      if state.configuration == nil { state.snapshot = initial }
      if state.configuration != configuration {
        revision += 1
        state.configuration = configuration
        let ids = Set(configuration.shoes.map(\.id))
        state.snapshot.byShoe = state.snapshot.byShoe.filter { ids.contains($0.key) }
        try persist()
      }
      publish(configuration, state.snapshot)
      return try json(state.snapshot)
    }
  }

  func refresh(completion: @escaping Completion) {
    queue.async {
      self.completions.append(completion)
      if self.running != nil {
        self.needsRead = true
      } else {
        self.beginRead()
      }
    }
  }

  private func beginRead() {
    guard let configuration = state.configuration, !configuration.shoes.isEmpty else {
      finish(.success(state.snapshot))
      return
    }
    let token = UUID()
    running = token
    needsRead = false
    let readRevision = revision
    let date = now()
    let cancel = read(ShoeMileageModel.queryStart(configuration, now: date)) { result in
      self.queue.async {
        guard self.running == token else { return }
        self.running = nil
        // Discard results whose window no longer covers the current shoes.
        if self.revision != readRevision || self.needsRead {
          self.beginRead()
          return
        }
        switch result {
        case .failure(let error):
          self.finish(.failure(error))
        case .success(let workouts):
          let at = date.timeIntervalSince1970 * 1000
          let snapshot = MileageSnapshot(
            byShoe: Dictionary(uniqueKeysWithValues: configuration.shoes.map {
              ($0.id, ShoeMileageModel.sum($0, workouts: workouts, now: at))
            }),
            readAt: at
          )
          let previous = self.state.snapshot
          self.state.snapshot = snapshot
          do {
            try self.persist()
            self.publish(configuration, snapshot)
            self.changed()
            self.finish(.success(snapshot))
          } catch {
            self.state.snapshot = previous
            self.finish(.failure(error))
          }
        }
      }
    }
    queue.asyncAfter(deadline: .now() + timeout) {
      guard self.running == token else { return }
      self.running = nil
      cancel()
      self.finish(.failure(NSError(domain: "BrooksMileage", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Health mileage read timed out",
      ])))
    }
  }

  private func finish(_ result: Result<MileageSnapshot, Error>) {
    let pending = completions
    completions.removeAll()
    for completion in pending { completion(result) }
  }

  private func persist() throws {
    defaults.set(try JSONEncoder().encode(state), forKey: storageKey)
  }

  private func json<T: Encodable>(_ value: T) throws -> String {
    String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
  }
}
