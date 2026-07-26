# GT63 Hotel Image Memory

Status: Architecture Draft
Milestone: V9.0.0 - GT63 Next Foundation
Task: 001
Scope: GT63 Next only

## Purpose

GT63 Hotel Image Memory defines how GT63 owns, stores, validates, serves, and reuses hotel images as persistent platform assets.

The goal is to stop treating third-party image URLs as the long-term presentation source. External providers may help discover images, but GT63 must preserve the approved image identity through its own storage, registry, and public media URLs.

## Problem

The Stable architecture can preserve hotel image identity when valid image URLs already exist, but it does not own those images.

Current failure modes:

- external provider rate limits such as HTTP 429;
- temporary provider URLs;
- broken remote images;
- repeated lookups for the same hotel;
- no durable platform memory of approved hotel imagery;
- limited operator control over replacement, approval, and refresh.

## Product Principle

Approved hotel imagery is client-visible proposal data.

Once an image is approved for a hotel, GT63 should preserve that asset and serve it from an app-owned URL whenever possible.

## Target Flow

```text
Hotel Detection
  -> Hotel Identity
  -> Hotel Image Memory
  -> Cache Lookup
      -> Found
          -> Serve app-owned asset
      -> Missing
          -> Image Provider
          -> Validate
          -> Persist
          -> Serve app-owned asset
      -> Provider failure
          -> Approved placeholder
```

## Non-Goals

This architecture does not redesign:

- Proposal Engine;
- OCR;
- Smart Import contract;
- HTML templates;
- PDF renderer;
- pricing;
- offer selection behavior;
- GT63 Stable.

## Folder Structure

Proposed runtime storage:

```text
/data/
  storage/
    hotel-images/
      registry.json
      assets/
        {hotel-id}/
          {asset-id}.webp
          {asset-id}.metadata.json
      quarantine/
        {asset-id}.bin
```

Local development equivalent:

```text
storage/
  hotel-images/
    registry.json
    assets/
    quarantine/
```

Repository source code:

```text
gt63-core/
  hotel-image-memory/
    hotel-identity.js
    image-registry.js
    image-storage.js
    image-validation.js
    image-provider.js
    providers/
      serpapi-provider.js
      manual-provider.js
```

Tests and fixtures:

```text
test/
  fixtures/
    hotel-image-memory/
      zurich-hotels.json
      valid-hotel-image.jpg
      tiny-image.jpg
      invalid-image.txt
```

## Storage Strategy

Primary production path:

```text
/data/storage/hotel-images
```

The path must be configurable:

```text
GT63_HOTEL_IMAGE_STORAGE_DIR=/data/storage/hotel-images
```

Local default:

```text
storage/hotel-images
```

Image assets should be stored under stable hotel identity folders. The recommended normalized identity key is:

```text
{normalized-hotel-name}-{normalized-location-hash}
```

Example:

```text
dolder-grand-zurich-9f31c2
```

Public URL format:

```text
/media/hotel-images/{hotel-id}/{asset-id}.webp
```

The database should persist public app-owned URLs, not private filesystem paths.

## Public Media Route

Proposed route:

```text
GET /media/hotel-images/:hotelId/:assetId
```

Route behavior:

- serves only files from `GT63_HOTEL_IMAGE_STORAGE_DIR/assets`;
- rejects path traversal;
- returns correct image MIME type;
- sets cache headers suitable for immutable asset IDs;
- returns 404 for missing or quarantined assets;
- does not expose private filesystem paths.

HTML and PDF can both consume this route because it is a normal public application URL.

## Image Registry

Initial registry can be JSON for V9 foundation. It can later move to SQLite or another persistence layer.

Proposed registry file:

```text
/data/storage/hotel-images/registry.json
```

Schema:

```json
{
  "version": 1,
  "hotels": {
    "dolder-grand-zurich-9f31c2": {
      "hotelId": "dolder-grand-zurich-9f31c2",
      "hotelName": "The Dolder Grand",
      "location": "Zurich",
      "aliases": [
        "The Dolder Grand",
        "Dolder Grand Zurich"
      ],
      "assets": [
        {
          "assetId": "sha256-...",
          "url": "/media/hotel-images/dolder-grand-zurich-9f31c2/sha256-....webp",
          "storagePath": "assets/dolder-grand-zurich-9f31c2/sha256-....webp",
          "provider": "serpapi",
          "source": "https://provider.example/image.jpg",
          "checksum": "sha256:...",
          "mime": "image/webp",
          "width": 1200,
          "height": 800,
          "bytes": 145230,
          "status": "approved",
          "createdAt": "2026-07-26T00:00:00.000Z",
          "updatedAt": "2026-07-26T00:00:00.000Z"
        }
      ],
      "createdAt": "2026-07-26T00:00:00.000Z",
      "updatedAt": "2026-07-26T00:00:00.000Z"
    }
  }
}
```

Asset statuses:

- `candidate`;
- `approved`;
- `rejected`;
- `quarantined`;
- `superseded`.

## Database Linkage

Offer records should continue to store image arrays using the existing presentation contract:

```json
{
  "hotels": [
    {
      "name": "The Dolder Grand",
      "images": [
        "https://gt63.example/media/hotel-images/dolder-grand-zurich-9f31c2/sha256-abcd.webp"
      ],
      "imageUrls": [
        "https://gt63.example/media/hotel-images/dolder-grand-zurich-9f31c2/sha256-abcd.webp"
      ],
      "imageSource": {
        "type": "gt63-hotel-image-memory",
        "hotelId": "dolder-grand-zurich-9f31c2",
        "assetId": "sha256-abcd",
        "status": "approved"
      }
    }
  ]
}
```

The proposal renderer should not need to know whether an image came from source upload, cache, SerpAPI, manual upload, or another provider.

## Image Provider Interface

The engine must not call SerpAPI directly from business logic.

Interface:

```js
class ImageProvider {
  constructor(options = {}) {}
  get name() {
    return "provider-name";
  }
  async searchHotelImages({ hotelName, location, limit, context }) {
    return [];
  }
}
```

Provider result shape:

```json
{
  "provider": "serpapi",
  "sourceUrl": "https://provider.example/image.jpg",
  "thumbnailUrl": "https://provider.example/thumb.jpg",
  "title": "The Dolder Grand",
  "width": 1200,
  "height": 800,
  "mime": "image/jpeg",
  "confidence": 0.82
}
```

Initial providers:

- `SerpApiImageProvider`;
- `ManualImageProvider`;
- `SourceImageProvider`.

Future providers:

- Google Places;
- Booking;
- internal curated library;
- agency media library.

## Cache-First Policy

The lookup contract:

```text
resolveHotelImages(hotel)
  1. normalize hotel identity
  2. check approved registry assets
  3. return app-owned URLs if present
  4. check source/import image candidates
  5. validate and persist approved source image
  6. call provider only on cache miss
  7. validate provider image
  8. persist provider image
  9. return app-owned URLs
  10. return approved placeholder metadata if no reliable image exists
```

Hard rule:

Provider lookup is forbidden when the registry already has enough approved assets for the hotel.

## Validation

Reject images that fail any of:

- HTTP status is not 200;
- MIME type is not `image/jpeg`, `image/png`, or `image/webp`;
- decoded image dimensions are below minimum threshold;
- byte length is zero or too small;
- byte length exceeds configured maximum;
- checksum already exists for another asset;
- image decoder fails;
- URL host is disallowed by policy;
- image is not reachable from the server;
- image cannot be served back through `/media/hotel-images`.

Initial thresholds:

```text
MIN_WIDTH=320
MIN_HEIGHT=220
MIN_BYTES=4096
MAX_BYTES=8388608
```

Preferred persisted format:

```text
webp
```

## Fallback Policy

If no valid image exists:

- HTML displays approved hotel image placeholder;
- PDF displays the same approved placeholder behavior;
- no generic destination or travel image may be represented as hotel photography;
- operator-visible warning is recorded:

```text
Hotel image requires confirmation
```

## API Endpoints

Read endpoints:

```text
GET /api/hotel-image-memory/hotels/:hotelId
GET /api/hotel-image-memory/search?hotelName=&location=
GET /media/hotel-images/:hotelId/:assetId
```

Write endpoints:

```text
POST /api/hotel-image-memory/hotels/:hotelId/assets
POST /api/hotel-image-memory/hotels/:hotelId/refresh
PATCH /api/hotel-image-memory/hotels/:hotelId/assets/:assetId
```

Write endpoint rules:

- require authenticated operator capability;
- never expose provider keys;
- validate files before registry commit;
- use atomic registry writes;
- preserve previous approved asset on failed refresh;
- record source and provider metadata.

## Migration Plan

Phase 1 - Shadow Inventory:

- scan existing persisted offers;
- identify remote hotel image URLs;
- normalize hotel identities;
- report duplicate and missing image coverage;
- do not change offer records.

Phase 2 - Cache Warmup:

- download and validate existing remote images;
- store approved assets in `/data/storage/hotel-images`;
- create registry entries;
- keep offers unchanged.

Phase 3 - Proposal Integration:

- on new import, resolve hotel images through Hotel Image Memory;
- persist app-owned public URLs in `hotels[].images` and `hotels[].imageUrls`;
- preserve current proposal adapter contract.

Phase 4 - Operator Review:

- expose image status and replacement controls;
- allow manual upload;
- allow reject/supersede.

Phase 5 - Provider Expansion:

- add additional providers behind the same interface;
- introduce provider priority and backoff policy.

## Implementation Roadmap

1. Create storage and registry module.
2. Create hotel identity normalizer.
3. Create image validator.
4. Add `/media/hotel-images` read-only static route.
5. Add source image ingestion into cache.
6. Add provider abstraction with SerpAPI adapter.
7. Add cache-first resolver.
8. Integrate resolver into Smart Import hotel enrichment.
9. Persist app-owned URLs in offer records.
10. Add operator warnings for missing images.
11. Add manual replacement API.
12. Add migration inventory script.
13. Add regression coverage.

## Regression Standard

Permanent fixture:

```text
Canonical Zurich Hotel Image Memory Fixture
```

Minimum assertions:

- cache hit does not call provider;
- source image is validated and persisted;
- provider success is validated, persisted, and served as app-owned URL;
- HTTP 429 produces approved placeholder and operator warning;
- duplicate image checksum is not stored twice;
- public media URL returns a valid image;
- HTML uses app-owned image URLs;
- PDF can fetch app-owned image URLs;
- selected hotel preserves its own image identity;
- hotel options preserve distinct image identities.

## Railway Persistence Requirements

Production must configure:

```text
GT63_HOTEL_IMAGE_STORAGE_DIR=/data/storage/hotel-images
```

The route `/media/hotel-images` must serve assets from that directory.

Files under `/app/public` are deployment artifacts and must not be treated as persistent image memory.

## Open Decisions

1. Registry backend for V9 foundation: JSON first or SQLite first.
2. Manual approval workflow: required before client visibility or optional for provider images.
3. Asset version URL format.
4. CDN handoff strategy.
5. Moderation policy and rejection reasons.

## Architecture Decision

Recommendation: implement Hotel Image Memory as a cache-first platform service using persistent Railway storage and app-owned public URLs.

SerpAPI remains a provider behind an interface. It is not a direct dependency of proposal rendering or offer presentation.

Final target:

```text
source/import image
  -> approved GT63 cache
  -> app-owned public URL
  -> offer record
  -> HTML/PDF
```

Provider fallback:

```text
no source image
  + cache miss
  -> provider lookup
  -> validate
  -> persist
  -> app-owned public URL
```

Failure:

```text
provider unavailable
  -> approved placeholder
  -> operator warning
```

