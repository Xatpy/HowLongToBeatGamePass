# Capacitor Setup

## Current Shape

Beatable uses Capacitor without changing the core frontend architecture.

The model is:

- the UI remains a static HTML/CSS/JS app
- the native app bundles that UI locally
- user-specific state is stored locally on-device
- remote network access is limited to:
  - game cover images
  - the shared catalog manifest and dataset

The canonical remote manifest is:

```text
https://xatpy.github.io/beatable/data/catalog-manifest.json
```

The browser and future mobile apps both use the same manifest-driven data contract.

## Available Commands

Prepare the mobile web bundle:

```bash
npm run cap:prepare
```

Sync the current static app into Capacitor:

```bash
npm run cap:sync
```

Add native platforms:

```bash
npm run cap:add:ios
npm run cap:add:android
```

Open native projects:

```bash
npm run cap:open:ios
npm run cap:open:android
```

Reapply iOS-native branding from repo state:

```bash
npm run cap:ios:sync-branding
```

Reapply Android-native branding from repo state:

```bash
npm run cap:android:sync-branding
```

## What `cap:prepare` Does

It copies the static app into `capacitor-www/` with only the files the mobile shell needs:

- `index.html`
- `manifest.json`
- `sw.js`
- `robots.txt`
- `css/`
- `js/`
- `icons/`
- `assets/`
- `data/catalog-manifest.json`
- `data/catalog.json`
- `data/catalogs/`
- `data/list.csv`
- `data/metadata.json`

This keeps the Capacitor bundle focused and avoids pointing the native app at the entire repo root.

## Mobile Runtime Behavior

The client does a few runtime-specific things for Capacitor builds:

- resolves dataset URLs relative to the manifest URL instead of assuming the current origin
- prefers the remote manifest at `https://xatpy.github.io/beatable/` when running in a bundled runtime
- caches the last good dataset in local storage for offline startup resilience
- prefers newer bundled catalog data over stale cached catalog data after native app updates
- skips service worker registration in bundled runtimes

## Local-First App State

Beatable now stores personal app state locally, without accounts or backend sync.

The current on-device state includes:

- saved backlog/list status per game
- favorites
- hidden games
- persisted browse filters and search state

This data is stored in `localStorage`, which works in both:

- the browser build
- the Capacitor WebView runtime

That means:

- user state survives app restarts
- user state survives offline usage
- the mobile app behaves like a personal tool, not a thin content wrapper

## Why The Capacitor App Is Now More Than A Wrapped Website

The mobile app is still built from the same static frontend, but the product behavior is now meaningfully app-like:

- it has a first-class `My Library` tab
- it stores user-managed personal data locally
- it has game detail views and action sheets
- it supports local backlog management, favorites, and dismissals
- it restores the user’s last browse context after relaunch

That is the practical reason the Capacitor shell is now justified: the app has persistent, user-specific value on-device.

## Platform App IDs

Capacitor has one default `appId`, but this repo now supports platform-specific native ids through custom config fields in `capacitor.config.json`.

Current values:

- default/shared app id: `com.xatpy.beatable`
- iOS bundle id override: `com.chapiware.beatable`
- Android app id override: `com.xatpy.beatable`

That means:

- a fresh Android project should use `com.xatpy.beatable`
- the existing iOS project keeps `com.chapiware.beatable`

## iOS Project Setup

### Bundle Identifier

Changing `appId` in `capacitor.config.json` does not reliably rename every native setting in an already-created Xcode project unless you also sync the native project. The safe rule is:

- `appId` is used when the platform is first created
- after that, the native project is the source of truth

In this repo, the iOS branding sync script now updates the native project from repo state:

- bundle identifier from `capacitor.config.json`
- display name from `capacitor.config.json`
- iOS app icon generated from `icons/icon-512.png` by default

The current iOS project uses:

- `PRODUCT_BUNDLE_IDENTIFIER = io.xatpy.beatable`

That value lives in:

- `ios/App/App.xcodeproj/project.pbxproj`

So if Xcode does not appear to reflect the latest config:

1. close Xcode
2. run `npm run cap:sync`
3. reopen the project
4. check `App` target → `Signing & Capabilities`

If you want to force the native bundle id/name/icon to match repo state again, run:

```bash
npm run cap:ios:sync-branding
```

## Android Project Setup

For Android, the intended app id is:

```text
com.xatpy.beatable
```

When the Android project exists, the Android sync script updates:

- `android/app/build.gradle`
  - `applicationId`
  - `namespace`
- `android/app/src/main/AndroidManifest.xml`
  - manifest package, if present
- `android/app/src/main/res/values/strings.xml`
  - app name
- `MainActivity` package path and package declaration in Java/Kotlin sources

So the normal flow is:

1. run `npm run cap:add:android`
2. run `npm run cap:sync`
3. open Android Studio

If Android already exists and you want to force the package/name back to repo-defined values, run:

```bash
npm run cap:android:sync-branding
```

### App Name

Display name comes from the native target settings and `Info.plist`, not just Capacitor config.

Relevant file:

- `ios/App/App/Info.plist`

If you want a different visible iOS app name, set it in Xcode under:

- `App` target → `General` → `Display Name`

## Icons

Capacitor does not automatically consume arbitrary images from `assets/` and turn them into a complete iOS app icon set.

Right now the iOS project uses:

- `ios/App/App/Assets.xcassets/AppIcon.appiconset`

The active icon catalog is configured in:

- `ios/App/App.xcodeproj/project.pbxproj`
  - `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`

That means the real source of truth for the iOS icon is the Xcode asset catalog, not `assets/` in the web app.

### Current State

The repo now includes a script that regenerates the iOS icon catalog from a single source image:

- default source: `icons/icon-512.png`
- overrideable with: `IOS_APP_ICON_SOURCE=...`

That script writes:

- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`

This keeps a fresh clone reproducible: after `npm run cap:add:ios` or `npm run cap:sync`, the native project can be brought back to the repo-defined icon/name/bundle-id state programmatically.

## Running On The iOS Simulator

1. Copy the current web app into Capacitor:

```bash
npm run cap:copy
```

2. Open the native project:

```bash
npm run cap:open:ios
```

3. In Xcode:

- select the `App` target
- choose a simulator like `iPhone 16` or `iPhone SE`
- press Run

If Simulator appears to run an older UI bundle:

1. uninstall the app from the simulator
2. rerun `npm run cap:copy`
3. run again from Xcode

## Preparing Builds

For real builds, use Xcode:

1. open the iOS project
2. set signing in `Signing & Capabilities`
3. choose your Apple Team
4. select `Any iOS Device (arm64)` or a real device
5. use `Product` → `Archive`

After archiving, use Xcode Organizer to:

- export a build
- upload to TestFlight
- prepare an App Store release

## Practical Workflow

During development:

1. change the web app
2. run `npm run cap:copy`
3. rerun from Xcode

Use Xcode as the source of truth for:

- bundle identifier
- signing
- display name
- icons
- release/archive configuration
