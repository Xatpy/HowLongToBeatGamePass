# Beatable

> Find your next game. Know the time commitment.

Beatable is a free browser for Xbox Game Pass and PlayStation Plus games, filtered by HowLongToBeat completion times. 

No accounts. No ads. Just pick a service, set a time limit, and find something worth starting tonight.

## Why it Exists

Xbox Game Pass and PlayStation Plus are remarkable for their libraries, but terrible at helping you decide what to actually play. Those catalogs are optimized for discovery and merchandising—they give you no signal on time commitment.

Beatable is built for the gamer who opens their subscription library, feels overwhelmed by 500 titles, and closes it without playing anything. It fixes:
- **Time scarcity** — "I only have a weekend"
- **Subscription guilt** — "I'm paying for this and never finishing anything"
- **Backlog anxiety** — "I don't want to commit to a 60-hour RPG right now"
- **Discovery fatigue** — "Scrolling the library for 30 minutes to find nothing"

## What it Is (and Isn't)

Beatable answers **one** question subscription libraries refuse to answer: *how long is this game going to take?*

### What it is
- The only tool that lets you browse Xbox AND PlayStation in one place.
- A fast way to sort by Main Story time and filter to games under 10 hours.
- A static web app powered by data refreshed regularly from public APIs and HowLongToBeat.

### What it is not
- A storefront. It does not show trailers or user scores.
- A tracker. It does not track what you've played or build you a recommendation list.
- A commercial product. Built by an independent developer, free to use, and entirely open source.

## Documentation

More detailed technical information is available in the `docs/` folder:

- [Architecture & Repo Structure](docs/architecture.md)
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

If port `4173` is already in use:

```bash
PORT=4174 npm run start
```
