import type { ConfigContext, ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { brand, appGroup } = require('./brand.config.js');

/**
 * Dynamic app config.
 *
 * `app.json` still holds everything that is not identity. Expo reads it first
 * and passes it in as `config`, so this file only has to overlay the fields
 * that decide which app this is. Keeping the split means a brand swap touches
 * `brand.config.js` alone and never produces a conflicting second copy of the
 * bundle identifier or the slug.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: brand.bundleIdentifier,
    appleTeamId: brand.appleTeamId,
    // `applinks:` opens the full app from a link on the domain; `appclips:`
    // lets the same link launch the App Clip before the app is installed.
    // @ref LLP 0007#the-domain
    associatedDomains: [`applinks:${brand.domain}`, `appclips:${brand.domain}`],
  },
  android: {
    ...config.android,
    package: brand.androidPackage,
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-asset',
    // Scheduled Health reads. @ref LLP 0006#background-health-sync
    'expo-background-task',
    // HealthKit entitlement and usage strings. @ref LLP 0005#read-only-by-default
    './modules/brooks-activity/app.plugin.js',
    // The shoe mileage widget. The App Group is named here, not left to the
    // plugin's fallback, because the store code and the Apple Developer portal
    // both have to agree on it. @ref LLP 0006#the-widget-reads-the-app-group
    [
      'expo-widgets',
      {
        groupIdentifier: appGroup,
        widgets: [
          {
            name: 'WeeklyChallenge',
            displayName: 'Weekly Challenge',
            description: 'Your weekly running goal, progress and earned challenge badge.',
            ios: { supportedFamilies: ['systemMedium'] },
          },
          {
            name: 'ShoeMileage',
            displayName: 'Shoe Mileage',
            description: 'How far your running shoes have gone, and when to replace them.',
            ios: {
              supportedFamilies: [
                'systemSmall',
                'systemMedium',
                'accessoryCircular',
                'accessoryRectangular',
                'accessoryInline',
              ],
            },
          },
        ],
      },
    ],
    // The App Clip in `targets/clip`: the PDP and the bag, launched from a link
    // before the app is installed. @ref LLP 0007#what-the-clip-is
    '@bacons/apple-targets',
    // The widget and the Clip take the app's build number at build time.
    // @ref LLP 0007#build-numbers
    './plugins/with-target-versions.js',
    './plugins/with-challenge-widget-fonts.js',
  ],
});
