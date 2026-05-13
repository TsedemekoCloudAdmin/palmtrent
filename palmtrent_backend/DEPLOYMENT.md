# Palmtrent Backend Deployment

## Required
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `API_BASE_URL`

## Health
- `GET /api/v1/health`
- `GET /api/v1/ops/readiness`
- `GET /api/v1/ops/metrics` with admin token

## Release Checklist
1. Copy `.env.example` to `.env` and fill production secrets.
2. Run `npm ci`.
3. Run `npm test -- --runInBand`.
4. Run `node --check server.js`.
5. Run seeds once: `node scripts/seedAll.js`.
6. Configure daily `scripts/backup-mongo.ps1`.
7. Put the API behind TLS and configure production CORS domains.

Payment gateway, Mapbox, WhatsApp, Firebase, and external object storage are adapter-ready but require real provider credentials.
