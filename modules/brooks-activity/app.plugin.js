/**
 * Config plugin for the local brooks-activity module.
 *
 * @ref LLP 0005#read-only-by-default — Adds the HealthKit entitlement and both
 * Health usage strings on iOS, without background delivery. Android sets the
 * minimum SDK for Health Connect; the library manifest owns its read permissions. App Store
 * Connect rejects a HealthKit app without `NSHealthUpdateUsageDescription`
 * (ITMS-90683) even when the store binary never writes, so the write string is
 * always present. The store binary stays read-only because the Swift write
 * code only compiles into Debug builds.
 */
const { withEntitlementsPlist, withInfoPlist, withGradleProperties } = require('expo/config-plugins');

// @ref LLP 0006#mileage-is-workout-distance — Shoe mileage reads the same
// workouts, so the string names both uses.
const SHARE_DESCRIPTION =
  'Brooks reads your runs, walks, hikes and steps to update your weekly running challenges, count the miles on the shoes you add, and answer some Shoe Finder questions. Your data stays on this device.';
const UPDATE_DESCRIPTION =
  'Brooks does not save your data to Apple Health. Only development builds add sample workouts, to test the Shoe Finder.';

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withBrooksActivity(config) {
  // Health Connect 1.1.0 requires API 26; its actual provider requires 28.
  // @ref LLP 0005#android — Stable SDK compatible with Expo's Android toolchain.
  config = withGradleProperties(config, config => {
    const properties = config.modResults;
    const existing = properties.find(p => p.type === 'property' && p.key === 'android.minSdkVersion');
    const value = String(Math.max(26, Number(existing?.value) || 0));
    if (existing) existing.value = value;
    else properties.push({ type: 'property', key: 'android.minSdkVersion', value });
    return config;
  });
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.healthkit'] = true;
    // Remove the previous observer implementation's entitlement on incremental prebuild.
    delete config.modResults['com.apple.developer.healthkit.background-delivery'];
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSHealthShareUsageDescription = SHARE_DESCRIPTION;
    config.modResults.NSHealthUpdateUsageDescription = UPDATE_DESCRIPTION;
    return config;
  });

  return config;
};
