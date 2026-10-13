# Project Memory

## Project Environment

- Expo SDK 57 (`expo` and `expo-router` 57.0.x), React Native 0.86, React 19.2,
  New Architecture enabled; routes live in `src/app`.
- Bun 1.2.22 is the package manager (`bun.lock`). Use `bun run start`,
  `bun run ios`, `bun run android`, `bun run web`, and `bun run typecheck`.
- `react-native-keyboard-controller` is in `expo.install.exclude`: the project
  uses `^1.22.4`, and `expo install --fix` would downgrade it to SDK 57's
  `1.21.9`. If `expo-doctor` reports a duplicate that a clean reinstall does
  not clear, look for a stale nested key in `bun.lock` (for example
  `"expo-router/react-native-screens"`), delete it, and reinstall.
- Metro uses port 8081. `metro.config.js` excludes `tools/` from crawling.
- Native projects are generated and ignored by git; web uses Metro single
  output. `brand.config.js` owns both native identifiers:
  `com.exponathan.ecommercedemo`. The old `com.exponathan.brooks` identity and
  Android mismatch guidance are superseded.
- `bun run test:health-sync` runs Bun tests for Expo task registration, shared
  foreground/background reads, errors, deletions and concurrent shoe changes. TypeScript is checked with `bun run typecheck`;
  app UI is validated interactively with Argent. Existing visual
  baselines live under `.baselines/ios` and `.baselines/android`.
- iOS 27.x simulators crash dev builds at launch (no `UIApplicationSceneManifest`
  in the generated Info.plist). Verify on an iOS 26.5 simulator, which also has
  Liquid Glass.
- If the local `ios/` is older than `node_modules` (pod "differs from the
  version stored in Pods/Local Podspecs", or Swift errors in `AppDelegate.swift`),
  run `bunx expo prebuild --clean -p ios`; `ios/` is generated and gitignored.
- `expo run:ios --no-bundler` opens the dev client on 8081; to use another
  Metro port, open `exp+ecommerce-demo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A<port>`.

### Environment inspection, 2026-10-12

[observed] Argent environment inspector result, with version and identity
fields retained for subsequent native work:

```json
{
  "is_react_native": true,
  "is_native_ios": false,
  "is_native_android": false,
  "project_type": "Expo SDK 57 / React Native",
  "supported_platforms": ["ios", "android", "web"],
  "healthkit_platforms": ["ios"],
  "widget_platforms": ["ios"],
  "versions": {
    "expo": "~57.0.27", "react_native": "0.86.3", "react": "19.2.3",
    "expo_widgets": "~57.0.23", "node": "22.23.1", "bun": "1.2.22",
    "cocoapods": "1.16.2"
  },
  "commands": {
    "install": "bun install --frozen-lockfile",
    "start": "bun run start", "ios": "bun run ios",
    "android": "bun run android", "web": "bun run web",
    "typecheck": "bun run typecheck"
  },
  "metro": { "default_port": 8081, "excluded_directory": "tools/" },
  "dependencies": {
    "node_modules_present": true, "ios_pods_present": true,
    "has_ios_dir": true, "has_android_dir": false,
    "ios_workspace": "EcommerceDemo.xcworkspace"
  },
  "identity": {
    "source": "brand.config.js",
    "ios_bundle_identifier": "com.exponathan.ecommercedemo",
    "android_package": "com.exponathan.ecommercedemo",
    "app_group": "group.com.exponathan.ecommercedemo"
  },
  "gather_workspace_data": { "status": "succeeded", "required_argument": "workspacePath" }
}
```

[observed 2026-10-13] Shoe sync uses Expo BackgroundTask with a 60-minute
minimum interval, not HealthKit observer delivery. `index.ts` defines the task
before Router loads. Real scheduler execution needs an iPhone; simulator
checks cannot prove a background wake. Keep foreground catch-up. See LLP
0006#background-health-sync.
