package com.adsup.mobile

import android.os.Process
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

class AdsupRuntimeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var dashboardNavigationStartedAtUptimeMs: Long? = null
  private var sequence = 0

  override fun getName(): String = NAME

  override fun getConstants(): Map<String, Any> = mapOf(
    "processStartUptimeMs" to Process.getStartUptimeMillis().toDouble(),
    "testApiBaseUrl" to BuildConfig.ADSUP_TEST_API_BASE_URL,
    "googleForceReal" to BuildConfig.ADSUP_GOOGLE_FORCE_REAL,
  )

  // Detox nests non-reserved launchArgs into a single "launchArgs" intent Bundle
  // (com.wix.detox.ActivityLaunchHelper), so extras must be looked up in both places.
  private fun getLaunchArg(name: String): String? {
    val intent = reactContext.currentActivity?.intent ?: return null
    return intent.getStringExtra(name) ?: intent.getBundleExtra("launchArgs")?.getString(name)
  }

  private fun isSc003MeasurementEnabled(): Boolean =
    BuildConfig.ADSUP_SC003_METRICS_ENABLED || getLaunchArg("ui-test-profile") == "SC-003"

  @ReactMethod
  fun getE2eGoogleSubject(promise: Promise) {
    promise.resolve(getLaunchArg("ui-test-google-subject") ?: BuildConfig.ADSUP_E2E_GOOGLE_SUBJECT)
  }

  @ReactMethod
  fun markSignInActionable(promise: Promise) {
    if (getLaunchArg("ui-test-metric") != "CR-005") {
      promise.resolve(null)
      return
    }

    val endedAtUptimeMs = SystemClock.uptimeMillis()
    val startedAtUptimeMs = Process.getStartUptimeMillis()
    val durationMs = (endedAtUptimeMs - startedAtUptimeMs).coerceAtLeast(0)
    Log.i(LOG_TAG, "ADSUP_CR005 {\"durationMs\":$durationMs,\"startedAtUptimeMs\":$startedAtUptimeMs,\"endedAtUptimeMs\":$endedAtUptimeMs}")
    promise.resolve(
      Arguments.createMap().apply {
        putDouble("durationMs", durationMs.toDouble())
        putDouble("startedAtUptimeMs", startedAtUptimeMs.toDouble())
        putDouble("endedAtUptimeMs", endedAtUptimeMs.toDouble())
      }
    )
  }

  @ReactMethod
  fun startDashboardNavigationMeasurement() {
    if (!isSc003MeasurementEnabled()) return
    synchronized(this) {
      dashboardNavigationStartedAtUptimeMs = SystemClock.uptimeMillis()
      sequence += 1
    }
  }

  @ReactMethod
  fun markDashboardActionable(promise: Promise) {
    if (!isSc003MeasurementEnabled()) {
      promise.resolve(null)
      return
    }

    val endedAtUptimeMs = SystemClock.uptimeMillis()
    val measurement = synchronized(this) {
      val navigationStartedAt = dashboardNavigationStartedAtUptimeMs
      val source = if (navigationStartedAt == null) "process" else "navigation"
      val startedAtUptimeMs = navigationStartedAt ?: Process.getStartUptimeMillis()
      if (navigationStartedAt == null) sequence += 1
      dashboardNavigationStartedAtUptimeMs = null

      val durationMs = (endedAtUptimeMs - startedAtUptimeMs).coerceAtLeast(0)
      Arguments.createMap().apply {
        putDouble("durationMs", durationMs.toDouble())
        putDouble("endedAtUptimeMs", endedAtUptimeMs.toDouble())
        putInt("sequence", sequence)
        putString("source", source)
        putDouble("startedAtUptimeMs", startedAtUptimeMs.toDouble())
      } to JSONObject().apply {
        put("durationMs", durationMs)
        put("endedAtUptimeMs", endedAtUptimeMs)
        put("sequence", sequence)
        put("source", source)
        put("startedAtUptimeMs", startedAtUptimeMs)
      }
    }

    Log.i(LOG_TAG, "$LOG_PREFIX${measurement.second}")
    promise.resolve(measurement.first)
  }

  companion object {
    const val NAME = "AdsupRuntime"
    private const val LOG_TAG = "AdsupStartupMetrics"
    private const val LOG_PREFIX = "ADSUP_SC003 "
  }
}
