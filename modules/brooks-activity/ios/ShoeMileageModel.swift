import Foundation

// @ref LLP 0006#background-health-sync — The native snapshot is shared by
// foreground reads and HealthKit deliveries, including when JS is suspended.
struct MileageShoe: Codable, Equatable {
  let id: String
  let name: String
  let startedAt: Double
  let startMiles: Double
  let limitMiles: Double
  let kinds: [String]
  let retiredAt: Double?
  let image: String
}

struct MileageConfiguration: Codable, Equatable {
  let shoes: [MileageShoe]
  let url: String
}

struct MileageWorkout: Codable {
  let kind: String
  let start: Double
  let distanceMeters: Double?
}

struct ShoeHealthMiles: Codable {
  let miles: Double
  let workouts: Int
  let weeklyMiles: Double?
}

struct MileageSnapshot: Codable {
  var byShoe: [String: ShoeHealthMiles] = [:]
  var readAt: Double?
}

struct PersistedMileage: Codable {
  var configuration: MileageConfiguration?
  var snapshot = MileageSnapshot()
}

enum ShoeMileageModel {
  static let day = 86_400_000.0

  // Same window and rules as src/data/mileage.ts; cross-language fixtures
  // exercise both implementations. Full recomputation handles Health deletions.
  static func queryStart(_ config: MileageConfiguration, now: Date) -> Date {
    let today = Calendar.current.startOfDay(for: now)
    let earliest = config.shoes.map(\.startedAt).min() ?? now.timeIntervalSince1970 * 1000
    let days = max(28, min(3 * 365, Int(((today.timeIntervalSince1970 * 1000 - earliest) / day).rounded()) + 1))
    return Calendar.current.date(byAdding: .day, value: -(days - 1), to: today) ?? today
  }

  static func sum(_ shoe: MileageShoe, workouts: [MileageWorkout], now: Double) -> ShoeHealthMiles {
    let mine = workouts.filter {
      shoe.kinds.contains($0.kind) && $0.start >= shoe.startedAt && $0.start < (shoe.retiredAt ?? .infinity)
    }
    let recentFrom = max(shoe.startedAt, now - 28 * day)
    let recent = mine.filter { $0.start >= recentFrom }
    let weeks = (now - recentFrom) / (7 * day)
    let miles: (MileageWorkout) -> Double = { ($0.distanceMeters ?? 0) / 1609.344 }
    return ShoeHealthMiles(
      miles: mine.reduce(0) { $0 + miles($1) },
      workouts: mine.count,
      weeklyMiles: shoe.retiredAt == nil && !recent.isEmpty && weeks >= 1
        ? recent.reduce(0) { $0 + miles($1) } / weeks : nil
    )
  }

  static func widgetProps(_ config: MileageConfiguration, snapshot: MileageSnapshot) -> [String: Any] {
    var props: [String: Any] = [
      "hasShoe": false, "name": "", "share": 0.0, "percent": "", "status": "",
      "miles": "", "milesShort": "", "limit": "", "pace": "", "replace": false,
      "url": config.url, "image": "",
    ]
    var selected: MileageShoe?
    var bestShare = -1.0
    for shoe in config.shoes where shoe.retiredAt == nil {
      let total = shoe.startMiles + (snapshot.byShoe[shoe.id]?.miles ?? 0)
      let share = shoe.limitMiles > 0 ? total / shoe.limitMiles : 0
      if share > bestShare {
        selected = shoe
        bestShare = share
      }
    }
    guard let shoe = selected else { return props }
    let health = snapshot.byShoe[shoe.id]
    let total = shoe.startMiles + (health?.miles ?? 0)
    let left = max(0, shoe.limitMiles - total)
    let replace = bestShare >= 0.7
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "en_US")
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    formatter.roundingMode = .halfUp
    let format: (Double) -> String = { formatter.string(from: NSNumber(value: $0)) ?? "0" }
    var pace = ""
    if let weekly = health?.weeklyMiles, weekly > 0, left > 0 {
      let weeks = max(1, Int((left / weekly).rounded()))
      pace = "About \(weeks) \(weeks == 1 ? "week" : "weeks") left"
    }
    props.merge([
      "hasShoe": true, "name": shoe.name, "share": min(1, bestShare),
      "percent": "\(Int(floor(bestShare * 100)))%",
      "status": replace ? "Time to replace" : "\(format(left)) mi left",
      "miles": "\(format(total)) of \(format(shoe.limitMiles)) mi",
      "milesShort": format(total), "limit": "\(format(shoe.limitMiles)) mi",
      "pace": pace, "replace": replace, "image": shoe.image,
    ]) { _, new in new }
    return props
  }
}
