# Beatable

> A local-first game decision app for PlayStation Plus and Xbox Game Pass.

Beatable started as a browser for Xbox Game Pass and PlayStation Plus games filtered by HowLongToBeat completion times.

It is now a personal game decision tool with on-device user state:

- a first-class `My Library` area
- backlog statuses (`Want to Play`, `Playing`, `Completed`)
- favorites
- hidden games
- persistent browse filters
- detail views and action sheets

No account. No backend. No ads. Your personal state stays on the device.

## Why it Exists

Xbox Game Pass and PlayStation Plus are remarkable for their libraries, but terrible at helping you decide what to actually play. Those catalogs are optimized for discovery and merchandising—they give you no signal on time commitment.

Beatable is built for the gamer who opens their subscription library, feels overwhelmed by 500 titles, and closes it without playing anything. It fixes:
- **Time scarcity** — "I only have a weekend"
- **Subscription guilt** — "I'm paying for this and never finishing anything"
- **Backlog anxiety** — "I don't want to commit to a 60-hour RPG right now"
- **Discovery fatigue** — "Scrolling the library for 30 minutes to find nothing"

## What it Is (and Isn't)

Beatable still answers the core question subscription libraries refuse to answer: *how long is this game going to take?*

It also now helps with the next decision: *what should I actually play next from my own saved list?*

### What it is
- A local-first app for browsing Xbox and PlayStation subscription catalogs in one place.
- A personal backlog and decision tool with persistent on-device state.
- A fast way to sort by Main Story time and filter by platform or length.
- A Capacitor-wrapped vanilla HTML/CSS/JS app powered by a regularly refreshed catalog and local persistence.

### What it is not
- A storefront. It does not show trailers or user scores.
- A social platform. There are no accounts, sync, or community features in the current build.
- A commercial product. Built by an independent developer, free to use, and entirely open source.

## Current Feature Set

### Personal Library

- `My Library` is a first-class tab in the app navigation.
- Games can be added to a local list with one status at a time:
  - `Want to Play`
  - `Playing`
  - `Completed`
- Favorites are stored locally.
- Hidden games are removed from browse results by default and can be restored later.

### Browse Experience

- Search by title.
- Switch between PlayStation Plus and Xbox Game Pass.
- Filter by platform and completion length.
- Sort by:
  - `Main Story`
  - `Main + Extra`
  - `Completionist`
  - `Review`
- Filter and sort choices persist across refreshes and app relaunches.

### Detail + Actions

- Every game has a detail view.
- Every game supports personal actions:
  - set backlog status
  - favorite / unfavorite
  - hide / restore
- Browse cards surface review and duration data in a compact layout.

### Local-First Behavior

- User-specific state is stored in `localStorage`.
- The same persistence model works in the browser and in the Capacitor app runtime.
- Catalog data is cached locally for faster startup and resilience.
- Bundled native app builds prefer newer bundled catalog data over stale cached catalog data.

## Why This Is Now A Real App

Beatable is no longer just a thin catalog wrapper. The current app has real user-specific utility even without logging in or connecting to a backend:

- it stores and manages a personal library on-device
- it remembers the user’s browsing context and preferences
- it lets the user build a backlog, favorite games, and dismiss titles
- it presents that state in a first-class `My Library` screen
- it works as a personal decision tool, not only as a passive content browser

That local-first behavior is the main difference between a plain website wrapper and an actual standalone app product.

## Documentation

More detailed technical information is available in the `docs/` folder:

- [Product & Mobile App Summary](docs/product.md)
- [Architecture & Repo Structure](docs/architecture.md)
- [Capacitor Setup](docs/capacitor.md)
- [Data Pipeline & Limitations](docs/pipeline.md)
- [Shared Data Contract](docs/data-contract.md)
- [Environment Variables](docs/environment.md)

## Running Locally

Install dependencies:

```bash
npm install
```

Refresh the dataset:

```bash
npm run update-data
```

Start the app:

```bash
npm run start
```

or:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Validate the code:

```bash
npm run check
```

Prepare the current web app for Capacitor:

```bash
npm run cap:copy
```

If port `4173` is already in use:

```bash
PORT=4174 npm run start
```
