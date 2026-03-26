# Shared Data Contract

The app is now built around one canonical remote data contract intended for both the browser app and future mobile apps.

Stable URLs:

- `https://xatpy.github.io/beatable/data/catalog-manifest.json`
  - the entry point clients should check first
- `https://xatpy.github.io/beatable/data/catalog.json`
  - the latest stable JSON dataset
- `https://xatpy.github.io/beatable/data/catalogs/catalog-<version>.json`
  - immutable versioned dataset files

The manifest currently includes:

- `schemaVersion`
- `product`
- `version`
- `generatedAt`
- `datasetUrl`
- `currentUrl`
- `manifestUrl`
- `sha256`
- `sizeBytes`
- `matchedCount`
- `totalCatalogCount`

Current manifest example:

```json
{
  "schemaVersion": 1,
  "product": "Beatable",
  "baseUrl": "https://xatpy.github.io/beatable/",
  "version": "20260324T085304Z",
  "generatedAt": "2026-03-24T08:53:04.405Z",
  "datasetUrl": "https://xatpy.github.io/beatable/data/catalogs/catalog-20260324T085304Z.json",
  "currentUrl": "https://xatpy.github.io/beatable/data/catalog.json",
  "manifestUrl": "https://xatpy.github.io/beatable/data/catalog-manifest.json",
  "datasetPath": "data/catalogs/catalog-20260324T085304Z.json"
}
```

The intended client update flow is:

1. Load the last good cached dataset immediately if available.
2. Fetch `https://xatpy.github.io/beatable/data/catalog-manifest.json` in the background.
3. Compare the returned `version` with the locally stored version metadata.
4. If unchanged, keep using the current dataset.
5. If changed, download `datasetUrl` fully, validate it, then swap the local dataset pointer.
6. Only after the new dataset succeeds should the client stop using the older one.

This keeps the client simple and gives deterministic versioning for mobile, while avoiding direct dependence on the refresh pipeline.

## Publishing Flow

The repo includes a scheduled/manual GitHub Actions workflow at:

- `.github/workflows/update-data.yml`

That workflow:

1. installs dependencies
2. runs `npm run update-data`
3. commits refreshed `data/` artifacts if they changed
4. pushes them back to the repository

That means mobile apps can pick up refreshed game data through the manifest without requiring a new app store release.
