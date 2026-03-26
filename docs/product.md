# Product & Mobile App Summary

## What Changed In This Iteration

Beatable was upgraded from a catalog browser into a local-first personal game decision app.

The biggest product changes are:

- a first-class `My Library` tab
- per-game backlog status
- favorites
- hide / restore
- persistent browse filters and search state
- a dedicated detail view with actions
- improved mobile and tablet browse layouts
- a clearer top navigation and filter panel
- a redesigned `My Library` experience

None of these features require accounts or backend infrastructure. The goal was to add meaningful standalone utility quickly and keep the implementation maintainable.

## New User-Facing Features

### 1. My Library

The app now has a prominent personal library screen that surfaces user-managed state directly in the main navigation.

Sections include:

- My List
- Favorites
- Completed
- Hidden

The screen is designed to make the app’s personal value obvious immediately.

### 2. Backlog Status

Each game can be stored locally with one list status:

- `Want to Play`
- `Playing`
- `Completed`

This status is available from:

- browse cards
- detail view
- library cards

### 3. Favorites

Any game can be favorited or unfavorited locally.

Favorite state is shown in:

- browse UI
- detail view
- library sections

### 4. Hide / Restore

Games can be hidden from browse results and restored later from the personal library.

This makes the app more useful as a real decision tool rather than a passive content listing.

### 5. Persistent Filters

Browse state now persists across refreshes and relaunches.

Persisted values include:

- service
- search query
- platform filter
- length filter
- active sort
- sort direction

### 6. Detail View

Each game now has a detail view that shows:

- title
- artwork
- review
- duration metrics
- service and metadata
- personal actions

This gives each item an actual app-level interaction model instead of behaving like a static row in a website.

## Technical Summary

### Architecture

The app still uses:

- vanilla HTML
- vanilla CSS
- vanilla JavaScript
- Capacitor as the native wrapper

No framework migration was introduced.

### Persistence

User state is stored locally in `localStorage`.

That includes:

- per-game personal state
- persisted browse state
- cached catalog data

This same storage approach works in both:

- the browser
- the Capacitor WebView runtime

### Catalog Loading

The app now:

- boots quickly from local cached data when available
- refreshes catalog data in the background
- prefers newer bundled catalog data over stale cached data in native builds

This reduces startup failures while avoiding stale content after shipping a new native binary.

## Why This Is Now A Proper App

The key difference is persistent, user-specific value on-device.

Before:

- the app mostly behaved like a catalog browser
- it was primarily a passive listing of third-party content
- there was little personal state or retained utility

Now:

- the user can build and manage a personal library
- the app remembers what matters to that user
- the app supports repeated decision-making over time
- the app has clear local utility even offline or without signing in

That is the product argument for why this is now a proper standalone app instead of a plain website inside a wrapper.

## Release Notes Style Summary

If you need a concise summary for internal docs, release notes, or review prep:

Beatable now includes a first-class `My Library`, local backlog management, favorites, hide/restore, persistent filters, and detail views with personal actions. The app stores user-specific state on-device, restores that state on relaunch, and presents a mobile-focused UI designed around fast browsing and personal decision-making.
