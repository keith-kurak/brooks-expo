package expo.modules.brooksactivity

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private const val PROVIDER = "com.google.android.apps.healthdata"
private const val HISTORY = HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY
private const val BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
private val EXERCISE = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
private val DISTANCE = HealthPermission.getReadPermission(DistanceRecord::class)
private val STEPS = HealthPermission.getReadPermission(StepsRecord::class)
private val ELEVATION = HealthPermission.getReadPermission(ElevationGainedRecord::class)

/** Read-only summaries; interpretation and storage stay in JS. @ref LLP 0005#android */
class BrooksActivityModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  private val permissionMutex = Mutex()
  private lateinit var launcher: AppContextActivityResultLauncher<ArrayList<String>, Set<String>>

  override fun definition() = ModuleDefinition {
    Name("BrooksActivity")
    if (Build.VERSION.SDK_INT < 34) {
      RegisterActivityContracts { launcher = registerForActivityResult(HealthPermissionsContract()) }
    }
    Function("isAvailable") { availability() == "available" }
    Function("getAvailability") { availability() }
    AsyncFunction("getAccessAsync").SuspendBody<Map<String, Any?>> { access() }
    AsyncFunction("shouldRequestAccessAsync").SuspendBody<Boolean> {
      !client().permissionController.getGrantedPermissions().containsAll(setOf(EXERCISE, DISTANCE))
    }
    AsyncFunction("requestAccessAsync").SuspendBody<Unit> {
      permissionMutex.withLock {
        val health = client()
        val requested = mutableSetOf(EXERCISE, DISTANCE, STEPS, ELEVATION)
        if (feature(health, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)) requested.add(HISTORY)
        if (feature(health, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)) requested.add(BACKGROUND)
        if (!health.permissionController.getGrantedPermissions().containsAll(requested)) {
          check(appContext.currentActivity != null) { "Open Brooks to connect Health Connect." }
          withContext(Dispatchers.Main) {
            if (Build.VERSION.SDK_INT >= 34) {
              // The modern Health Connect contract requests runtime permissions,
              // whose result goes through onRequestPermissionsResult, not an
              // activity result. Use Expo's permission service. @ref LLP 0005#android
              val permissions = requireNotNull(appContext.permissions)
              suspendCancellableCoroutine<Unit> { continuation ->
                permissions.askForPermissions({
                  if (continuation.isActive) continuation.resume(Unit)
                }, *requested.toTypedArray())
              }
            } else {
              launcher.launch(ArrayList(requested))
            }
          }
        }
      }
    }
    AsyncFunction("openSettingsAsync").SuspendBody<Unit> {
      val intent = if (availability() == "install-required") {
        Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER"))
      } else Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
      withContext(Dispatchers.Main) { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    AsyncFunction("getWorkoutsAsync") Coroutine { days: Int -> readWorkouts(days) }
    AsyncFunction("getDailyStepsAsync") Coroutine { days: Int -> readSteps(days) }
  }

  private fun availability(): String {
    if (Build.VERSION.SDK_INT < 28) return "unavailable"
    return when (HealthConnectClient.getSdkStatus(context)) {
      HealthConnectClient.SDK_AVAILABLE -> "available"
      HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "install-required"
      else -> "unavailable"
    }
  }
  private fun client(): HealthConnectClient {
    check(availability() == "available") { "Install or update Health Connect to connect your activity." }
    return HealthConnectClient.getOrCreate(context)
  }
  private fun feature(health: HealthConnectClient, value: Int) =
    health.features.getFeatureStatus(value) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

  private suspend fun access(): Map<String, Any?> {
    val status = availability()
    val health = if (status == "available") client() else null
    val granted = health?.permissionController?.getGrantedPermissions() ?: emptySet()
    return mapOf(
      "status" to status,
      "workouts" to granted.contains(EXERCISE), "distance" to granted.contains(DISTANCE),
      "steps" to granted.contains(STEPS), "elevation" to granted.contains(ELEVATION),
      "historyAvailable" to (health != null && feature(health, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)),
      "backgroundAvailable" to (health != null && feature(health, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)),
      "background" to granted.contains(BACKGROUND),
      // Conservative window without storing a guessed first-grant date.
      // History loss must never silently truncate mileage. @ref LLP 0005#android
      "maxReadDays" to if (granted.contains(HISTORY)) null else 28
    )
  }
  private suspend fun checkedClient(days: Int, required: Set<String>): HealthConnectClient {
    val health = client()
    val granted = health.permissionController.getGrantedPermissions()
    check(granted.containsAll(required)) { "Allow the requested activity permissions in Health Connect to read your data." }
    check(days <= 28 || granted.contains(HISTORY)) { "Allow earlier history in Health Connect to count from this start date. Your saved miles are unchanged." }
    return health
  }
  private fun start(days: Int): Instant = LocalDate.now().minusDays((days.coerceAtLeast(1) - 1).toLong())
    .atStartOfDay(ZoneId.systemDefault()).toInstant()

  private suspend fun readWorkouts(days: Int): List<Map<String, Any?>> {
    val health = checkedClient(days, setOf(EXERCISE))
    val granted = health.permissionController.getGrantedPermissions()
    val sessions = mutableListOf<ExerciseSessionRecord>()
    val from = start(days)
    var token: String? = null
    do {
      val page = health.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class,
        timeRangeFilter = TimeRangeFilter.between(from, Instant.now()), pageToken = token))
      sessions.addAll(page.records.filter { kind(it) != null && it.startTime >= from })
      token = page.pageToken
    } while (!token.isNullOrEmpty())

    val summaries = sessions.map { session ->
      val metrics = buildSet {
        if (granted.contains(DISTANCE)) add(DistanceRecord.DISTANCE_TOTAL)
        if (granted.contains(ELEVATION)) add(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)
      }
      val totals = if (metrics.isEmpty()) null else health.aggregate(AggregateRequest(
        metrics, TimeRangeFilter.between(session.startTime, session.endTime), setOf(session.metadata.dataOrigin)))
      WorkoutSummary(
        kind = requireNotNull(kind(session)), start = session.startTime, end = session.endTime,
        source = session.metadata.dataOrigin.packageName, id = session.metadata.id,
        distanceMeters = if (granted.contains(DISTANCE)) totals?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters else null,
        elevationGainMeters = if (granted.contains(ELEVATION)) totals?.get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)?.inMeters else null,
        indoor = if (session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL) true else null
      )
    }
    return selectWorkouts(summaries).map { it.record() }
  }

  private fun kind(session: ExerciseSessionRecord): String? = when (session.exerciseType) {
    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "run"
    ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walk"
    ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hike"
    else -> null
  }
  private suspend fun readSteps(days: Int): List<Map<String, Any>> {
    val health = checkedClient(days, setOf(STEPS))
    val today = LocalDate.now()
    val zone = ZoneId.systemDefault()
    return (0 until days.coerceAtLeast(1)).map { index ->
      val date = today.minusDays((days.coerceAtLeast(1) - 1 - index).toLong())
      val from = date.atStartOfDay(zone).toInstant()
      val to = minOf(date.plusDays(1).atStartOfDay(zone).toInstant(), Instant.now())
      // Unfiltered aggregates include phone steps and apply user source priorities.
      val totals = health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(from, to)))
      mapOf("date" to from.toEpochMilli().toDouble(), "steps" to (totals[StepsRecord.COUNT_TOTAL] ?: 0L).toDouble())
    }
  }
}

private class HealthPermissionsContract : AppContextActivityResultContract<ArrayList<String>, Set<String>> {
  private val contract = PermissionController.createRequestPermissionResultContract()
  override fun createIntent(context: Context, input: ArrayList<String>) = contract.createIntent(context, input.toSet())
  override fun parseResult(input: ArrayList<String>, resultCode: Int, intent: Intent?) = contract.parseResult(resultCode, intent)
}
