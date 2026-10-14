/**
 * The app's shippable identity, in one place.
 *
 * Everything a store listing or a build keys off — display name, bundle
 * identifier, Android package, deep-link scheme, Expo slug — lives here and
 * nowhere else, so swapping the app's identity is a single-file edit rather
 * than a hunt through `app.json`, the native projects, and the router.
 *
 * Plain CommonJS on purpose: `app.config.ts` runs in Node and Metro bundles
 * this same file for the app, and CJS is the one module format both read
 * without a loader (`tsx`) in between.
 *
 * The bundle identifier cannot be changed once a build is uploaded to App
 * Store Connect, so it is fixed up front and deliberately says nothing about
 * whose catalog the app shows.
 *
 * `slug` must match the EAS project it is linked to (`extra.eas.projectId` in
 * app.json resolves to `@exponathan/<slug>`). Changing it here without
 * renaming that project in the Expo dashboard makes `eas build` fail.
 *
 * `domain` is the website the App Clip and universal links belong to. Its
 * `/.well-known/apple-app-site-association` names `appleTeamId` plus each
 * bundle identifier, so the three change together. @ref LLP 0007#the-domain
 */

/** @typedef {{ name: string, bundleIdentifier: string, androidPackage: string, scheme: string, slug: string, appleTeamId: string, domain: string }} Brand */

/** @type {Brand} */
const brand = {
  name: 'Ecommerce Demo',
  bundleIdentifier: 'com.keithkurak.ecommercedemo',
  androidPackage: 'com.keithkurak.ecommercedemo',
  scheme: 'ecomdemo',
  slug: 'ecommerce-demo',
  appleTeamId: 'PH3XBLZS8A',
  domain: 'ecommerce-demo.expo.app',
};

/**
 * The App Group the app, its widget, and its App Clip share. The store code
 * reads it too, so it is derived here rather than spelled out in each place.
 * @ref LLP 0007#the-bag-lives-in-the-app-group
 */
const appGroup = `group.${brand.bundleIdentifier}`;

module.exports = { brand, appGroup };
