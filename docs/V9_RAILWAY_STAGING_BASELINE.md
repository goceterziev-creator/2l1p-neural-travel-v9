# GT63 Next - V9 Railway Staging Baseline

Status: Draft
Scope: GT63 Next / V9 only
Repository: `gotebibi-design/2l1p-neural-travel-v9`
Branch: `main`

## Purpose

This baseline proves that GT63 Next can run independently from GT63 Stable.

The goal is not to add product functionality. The goal is to establish an isolated Railway staging service before starting Hotel Image Memory or any other V9 capability.

## V8 / V9 Boundary

V8 Stable is the production reference line.

V9 Next is the development and staging line.

V9 must not reuse:

- V8 Railway service;
- V8 production domain;
- V8 production database;
- V8 production volume;
- V8 production credentials;
- V8 runtime storage;
- V8 deployment or rollback history.

## Railway Service Checklist

- Create a new Railway project or service for V9.
- Connect it to `gotebibi-design/2l1p-neural-travel-v9`.
- Deploy from branch `main`.
- Use repository root as the service root.
- Start command: `npm start`.
- Assign a new staging domain.
- Create a new persistent volume.
- Mount the volume at `/data`.
- Do not attach the V8 production volume.
- Do not copy the V8 production database into the V9 volume.

## Environment Variables

| Variable | Purpose | Required | Staging Example | Must Differ From V8 | Secret |
|---|---|---:|---|---:|---:|
| `NODE_ENV` | Runtime mode | Yes | `production` | No | No |
| `GT63_PRODUCT_LINE` | Identifies the product line | Yes | `V9` | Yes | No |
| `GT63_RUNTIME_ENV` | Identifies deployment environment | Yes | `staging` | Yes | No |
| `GT63_REQUIRE_ISOLATED_STORAGE` | Enables strict storage guard | Yes | `true` | Yes | No |
| `PORT` | Railway-provided HTTP port | Railway | set by Railway | Yes | No |
| `LIVE_BASE_URL` | Public V9 staging URL | Yes | `https://gt63-next-staging.up.railway.app` | Yes | No |
| `DATA_DIR` | Persistent runtime root | Yes | `/data` | Yes | No |
| `DB_FILE` | Explicit database file override | Optional | `/data/DATABASE/database.json` | Yes if set | No |
| `MEDIA_DIR` | Public media storage root | Yes | `/data/storage/media` | Yes | No |
| `SOURCE_EVIDENCE_DIR` | Import evidence archive | Recommended | `/data/storage/source-evidence` | Yes | No |
| `AIRPORT_CONFIG_FILE` | Runtime airport config | Recommended | `/data/CONFIG/airports.json` | Yes | No |
| `OCR_PATTERN_CONFIG_FILE` | Runtime OCR pattern config | Recommended | `/data/CONFIG/ocr-patterns.json` | Yes | No |
| `REGRESSION_LIBRARY_DIR` | Runtime regression library | Optional | `/data/REGRESSION_LIBRARY` | Yes | No |
| `GEMINI_INTAKE_TEST_DIR` | Runtime Gemini test output | Optional | `/data/GEMINI_INTAKE_TEST` | Yes | No |
| `AUTH_SECRET` | Session signing secret | Yes | staging-only secret | Yes | Yes |
| `BETA_AUTH_BYPASS` | Auth bypass for controlled staging | Optional | `false` | Should differ from prod policy | No |
| `OPENAI_API_KEY` | OpenAI integration | Optional for boot | staging-only key | Yes | Yes |
| `GEMINI_API_KEY` | Gemini Vision integration | Optional for boot | staging-only key | Yes | Yes |
| `SERPAPI_KEY` | Image/search provider | Optional for boot | staging-only key | Yes | Yes |
| `GT63_ENABLE_VISION_TEST_ENDPOINTS` | Enables protected test endpoints | Optional | `false` | No | No |

Never copy actual V8 production secrets into documentation or Git.

## Database Setup

Recommended staging database path:

```text
/data/DATABASE/database.json
```

The application initializes a missing database as:

```json
{
  "schemaVersion": "gt63-v9-staging-1",
  "agencies": [],
  "users": [],
  "clients": [],
  "offers": [],
  "activities": []
}
```

For staging, set:

```text
GT63_REQUIRE_ISOLATED_STORAGE=true
DATA_DIR=/data
```

This prevents accidental fallback to application-directory runtime storage.

## Volume Setup

Recommended Railway volume:

```text
Mount path: /data
```

Runtime paths:

```text
/data/DATABASE/database.json
/data/storage/media
/data/storage/source-evidence
/data/CONFIG/airports.json
/data/CONFIG/ocr-patterns.json
```

Files inside `/app/public` are deployment artifacts and must not be treated as persistent runtime storage.

## Domain Setup

Use a V9 staging domain only.

Do not use:

```text
https://2l1p-neural-travel-production.up.railway.app
```

The application refuses that production URL when `GT63_REQUIRE_ISOLATED_STORAGE=true`.

## Deployment Procedure

1. Confirm V9 repository is connected.
2. Confirm branch is `main`.
3. Configure V9-only environment variables.
4. Attach V9-only volume at `/data`.
5. Deploy.
6. Wait for successful boot.
7. Run smoke checks.

## Smoke Test Procedure

Check health:

```text
GET /health
GET /api/health
```

Expected:

- HTTP 200;
- `service` is `GT63 Next`;
- `line` is `V9`;
- `runtime` is `staging`;
- `database.ok` is `true`;
- `media.ok` is `true`.

Check public media:

```text
GET /media/health/test.txt
```

Expected:

- HTTP 200;
- response contains `GT63 V9 media storage OK`.

## PDF Verification Procedure

1. Create or identify a V9 staging offer.
2. Open:

```text
/api/offers/{offerId}/print
```

3. Generate:

```text
/api/offers/{offerId}/pdf
```

4. Confirm:

- PDF response is 200;
- file opens as PDF;
- print route uses the V9 staging domain;
- no V8 production URL is referenced;
- temporary Chromium profile is cleaned.

## Media Path Verification Procedure

Baseline media check:

```text
/media/health/test.txt
```

Future image memory check:

```text
/media/hotel-images/{hotel-id}/{asset-id}.webp
```

The future image route must serve from the V9 volume, not from V8 production storage.

## Rollback Procedure

Use the V9 Railway service deployment history only.

Rollback must not affect:

- V8 Railway production;
- V8 production domain;
- V8 production volume;
- V8 production database.

## PASS / FAIL Acceptance Checklist

The V9 Railway Staging Baseline passes only when all items are true:

- [ ] V9 deploys from `gotebibi-design/2l1p-neural-travel-v9`.
- [ ] V9 deploys from branch `main`.
- [ ] Application boots successfully.
- [ ] `/health` returns success.
- [ ] `/api/health` returns success.
- [ ] Health identifies `GT63 Next` and `V9`.
- [ ] `database.ok` is `true`.
- [ ] `media.ok` is `true`.
- [ ] `/media/health/test.txt` returns success.
- [ ] V9 uses a dedicated Railway service.
- [ ] V9 uses a dedicated Railway volume.
- [ ] V9 uses a dedicated staging domain.
- [ ] V9 does not reference the V8 production domain.
- [ ] V9 does not use the V8 production database.
- [ ] V9 does not use the V8 production volume.
- [ ] PDF generation works in staging.
- [ ] Deployment and rollback history are independent from V8.

## Known Operator Actions

The operator must create the Railway service, attach the `/data` volume, set environment variables, and trigger deployment.

This repository does not contain Railway credentials and must not store production secrets.
