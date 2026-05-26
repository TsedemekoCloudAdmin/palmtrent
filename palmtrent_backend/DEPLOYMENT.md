# Palmtrent Backend Deployment

## Required
- `MONGODB_URI`
- `JWT_SECRET`
- `INTEGRATION_SECRET_KEY`
- `FRONTEND_URL`
- `API_BASE_URL`
- `CORS_ORIGINS`
- `INTERNAL_JOB_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `OPENAPI_AFRICA_PUBLIC_UNIQUE_ID`
- `OPENAPI_AFRICA_RETURN_URL`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `FIREBASE_SERVICE_ACCOUNT`
- `EMAIL_HOST`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`
- `STORAGE_DRIVER`
- `UPLOAD_SCAN_COMMAND`

For `STORAGE_DRIVER=s3` or `STORAGE_DRIVER=r2`, also set `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`. For Cloudflare R2, also set `STORAGE_ENDPOINT`; set `STORAGE_BASE_URL` if files should be served through a public CDN/domain.

ClicknPay/OpenAPI Africa is the primary hosted payment gateway, including EcoCash/OneMoney where enabled on that provider account. The Paynow direct rail remains available for dedicated EcoCash/OneMoney processing; set `ENABLE_PAYNOW_DIRECT_RAIL=true` and configure `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_RESULT_URL`, and `PAYNOW_RETURN_URL` only when that direct rail is intentionally used in production.

## Health
- `GET /api/v1/health`
- `GET /api/v1/ops/readiness`
- `GET /api/v1/ops/metrics` with admin token

`/api/v1/ops/readiness` returns `503` when required production providers are missing, credentials are placeholders, MongoDB is disconnected, upload scanning is disabled, or production storage is still local without `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`.

Upload, routing, and geocoding code paths also fail closed at runtime in production. Only set `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`, `ALLOW_LOCATION_FALLBACK_IN_PRODUCTION=true`, or `ALLOW_ESTIMATED_DISTANCE_IN_PRODUCTION=true` as a temporary operational exception after accepting that uploads or route pricing may no longer be backed by production-grade providers.

## Release Checklist
1. Copy `.env.example` to `.env` and fill production secrets.
2. Run `npm ci`.
3. Run `npm test -- --runInBand`.
4. Run `node --check server.js`.
5. Run seeds once: `node scripts/seedAll.js`.
6. Configure daily `scripts/backup-mongo.ps1`.
7. Configure maintenance jobs:
   - Run `npm run jobs:maintenance -- escrow` frequently enough to release eligible escrow payouts after their grace period.
   - Run `npm run jobs:maintenance -- payouts` after rollout and periodically to backfill any released escrow payout records missing from legacy data.
   - Run `npm run jobs:maintenance -- documents` daily for vehicle and trailer document expiry alerts.
   - Run `npm run jobs:maintenance -- shipments` after rollout to link legacy shipments to bookings by booking reference for matching and POD access.
   - Schedule `npm run jobs:maintenance` at least hourly in production so escrow releases, document expiry checks, shipment maintenance, and due corporate report emails are processed.
8. Put the API behind TLS and configure production CORS domains.

ClicknPay/OpenAPI Africa, Mapbox, WhatsApp, Firebase, SMTP email, upload scanning, and object storage require real provider credentials before production traffic. Paynow direct EcoCash/OneMoney credentials are required only when `ENABLE_PAYNOW_DIRECT_RAIL=true`.
