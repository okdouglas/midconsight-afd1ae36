# Self-hosted basemap (Cloudflare R2 + Protomaps)

The map reads one `.pmtiles` file straight from R2 with HTTP range requests.
No tile server, no API key, no per-request fees (R2 has no egress charge).

Config: `VITE_BASEMAP_PMTILES_URL` in `.env` (public value). If it is empty the
app falls back to plain OpenStreetMap raster tiles.

## Build the file (Windows PowerShell)

1. Download `go-pmtiles` for Windows from https://github.com/protomaps/go-pmtiles/releases and unzip `pmtiles.exe`.
2. Find the newest daily build:
   `(Invoke-RestMethod https://build.protomaps.com/builds.json)[-1].key`
3. Cut out the Midcontinent (OK, north TX, south KS, edges of NM/CO/AR/MO):
   `.\pmtiles.exe extract https://build.protomaps.com/<KEY> midcon.pmtiles --bbox=-104.0,32.0,-93.0,38.0 --maxzoom=13`
4. Check the size: `(Get-Item midcon.pmtiles).Length / 1MB`

`--maxzoom` must match `MAX_DATA_ZOOM` in `src/lib/basemap.ts`.

## Upload

R2 bucket `midconsight-tiles`. Under 300 MB: `npx wrangler r2 object put midconsight-tiles/midcon.pmtiles --file midcon.pmtiles --remote`
Over 300 MB: use rclone or the AWS CLI against the R2 S3 endpoint with an R2 API token.

## Serve it

- Bucket Settings, Custom Domains: `tiles.midconsight.com`.
- Bucket Settings, CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://midconsight.com", "https://www.midconsight.com", "https://midconsight.reliquarytrading.workers.dev", "http://localhost:8080"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-Match", "If-None-Match"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

- Cloudflare Cache Rule for `tiles.midconsight.com`: eligible for cache, so reads are fast.
- Set `VITE_BASEMAP_PMTILES_URL="https://tiles.midconsight.com/midcon.pmtiles"` in `.env`, commit, push.
