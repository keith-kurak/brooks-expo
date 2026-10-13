package expo.modules.brooksactivity

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class WorkoutSummaryTest {
  private fun workout(source: String, minutes: Long = 60, start: Long = 0, distance: Double? = 10000.0, kind: String = "run") =
    WorkoutSummary(kind, Instant.ofEpochSecond(start * 60), Instant.ofEpochSecond((start + minutes) * 60), source, source, distance)

  @Test fun importedSessionCountsOnceAndPrefersRecordedDistance() {
    val imported = workout("a.import", distance = null)
    val recorded = workout("b.watch")
    assertEquals(listOf(recorded), selectWorkouts(listOf(imported, recorded)))
    assertEquals(listOf(recorded), selectWorkouts(listOf(recorded, imported)))
  }
  @Test fun independentAndNestedWorkoutsRemainDistinct() {
    assertEquals(2, selectWorkouts(listOf(workout("a"), workout("b", start = 120))).size)
    assertEquals(2, selectWorkouts(listOf(workout("a"), workout("b", minutes = 10, start = 5))).size)
    assertEquals(2, selectWorkouts(listOf(workout("a"), workout("b", kind = "walk"))).size)
  }
  @Test fun slightlyShiftedCopiesHaveDeterministicSelection() {
    val first = workout("a")
    val shifted = workout("b", start = 5)
    assertEquals(listOf(first), selectWorkouts(listOf(shifted, first)))
  }
  @Test fun missingDataStaysUnknown() {
    val record = workout("a", distance = null).record()
    assertNull(record["distanceMeters"])
    assertNull(record["elevationGainMeters"])
    assertNull(record["indoor"])
    assertEquals(60.0, record["durationMinutes"])
  }
}
