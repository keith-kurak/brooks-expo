package expo.modules.brooksactivity

import java.time.Duration
import java.time.Instant

internal data class WorkoutSummary(
  val kind: String,
  val start: Instant,
  val end: Instant,
  val source: String,
  val id: String,
  val distanceMeters: Double?,
  val elevationGainMeters: Double? = null,
  val indoor: Boolean? = null
) {
  fun record(): Map<String, Any?> = mapOf(
    "kind" to kind, "start" to start.toEpochMilli().toDouble(),
    // Health Connect sessions expose elapsed time. Mileage does not use duration.
    "durationMinutes" to Duration.between(start, end).toMillis() / 60000.0,
    "distanceMeters" to distanceMeters, "elevationGainMeters" to elevationGainMeters, "indoor" to indoor
  )
}

/** Prefer a complete recording to its imported copy, then use stable source ordering.
 * Session lists are not deduped by aggregate(). @ref LLP 0005#android
 */
internal fun selectWorkouts(candidates: List<WorkoutSummary>): List<WorkoutSummary> {
  val selected = mutableListOf<WorkoutSummary>()
  val ordered = candidates.sortedWith(compareByDescending<WorkoutSummary> { it.distanceMeters != null }
    .thenByDescending { it.elevationGainMeters != null }.thenBy { it.source }.thenBy { it.id })
  for (session in ordered) {
    val duplicate = selected.any { prior ->
      if (prior.kind != session.kind || prior.source == session.source) false
      else {
        val overlap = Duration.between(maxOf(prior.start, session.start), minOf(prior.end, session.end)).toMillis()
        val longer = maxOf(Duration.between(prior.start, prior.end).toMillis(), Duration.between(session.start, session.end).toMillis())
        longer > 0 && overlap >= longer * 0.8
      }
    }
    if (!duplicate) selected.add(session)
  }
  return selected.sortedByDescending { it.start }
}
