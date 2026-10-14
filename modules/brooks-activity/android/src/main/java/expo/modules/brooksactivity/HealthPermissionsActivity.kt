package expo.modules.brooksactivity

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Available from Health Connect even when React Native is not running. */
class HealthPermissionsActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Brooks health data privacy"
    val padding = (24 * resources.displayMetrics.density).toInt()
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
    }
    content.addView(TextView(this).apply {
      textSize = 18f
      text = "Your activity stays on your phone\n\n" +
        "Brooks reads runs, walks, hikes, distance and steps to count the miles on your shoes and answer Shoe Finder questions. Elevation helps identify trail running. Earlier history lets us read from a pair's start date. Background access lets mileage catch up while Brooks is closed.\n\n" +
        "Brooks does not write health data. Workouts and step records are held in memory while reading and are not saved or sent to a server. The Finder profile is discarded when you leave it. Only shoe mileage totals, workout counts, recent pace and the last read time are saved locally. Health data is not used for advertising or shared with others.\n\n" +
        "You control each permission in Health Connect. Declining background access keeps foreground refresh available. Revoking access stops new reads and preserves your existing shoe totals. Remove a pair in Brooks to delete its saved mileage, or clear the app's storage to delete all local app data."
    })
    content.addView(Button(this).apply { text = "Done"; setOnClickListener { finish() } })
    setContentView(ScrollView(this).apply { addView(content) })
  }
}
