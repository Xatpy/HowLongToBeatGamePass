# Shared Data Contract

The app is now built around one canonical remote data contract intended for both the browser app and future mobile apps.

Stable URLs:

- `/data/catalog-manifest.json`
  - the entry point clients should check first
- `/data/catalog.json`
  - the latest stable JSON dataset
- `/data/catalogs/catalog-<version>.json`
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
  "version": "20260324T081116Z",
  "generatedAt": "2026-03-24T08:11:16.333Z",
  "datasetUrl": "/data/catalogs/catalog-20260324T081116Z.json",
  "currentUrl": "/data/catalog.json",
  "manifestUrl": "/data/catalog-manifest.json"
}
```

The intended client update flow is:

1. Fetch `/data/catalog-manifest.json`.
2. Compare the returned `version` with the locally cached one.
3. If unchanged, keep using local data.
4. If changed, download `datasetUrl`.
5. Swap to the new dataset only after the download succeeds.

This keeps the client simple and gives deterministic versioning for mobile, while avoiding direct dependence on the refresh pipeline.
