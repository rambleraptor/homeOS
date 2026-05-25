# Next.js API Routes

Next.js API routes that run server-side alongside the aepbase backend.

## Module Workers

Module-owned endpoints live under `/api/modules/<moduleId>/<workerName>`
and are dispatched by the catch-all route at
`app/api/modules/[moduleId]/[...path]/route.ts`. Each module declares
its workers in `module.config.ts` (`workers: { ... }`) with a lazy
`load: () => import(...)` so handler code stays out of the client
bundle. See `frontend/src/modules/workers/dispatcher.ts` for the
runtime contract.

Currently mounted workers:

- `POST /api/modules/groceries/process-image` — Gemini-powered
  extraction of grocery items from an uploaded image
- `POST /api/modules/groceries/send-grocery-notification` — pushes a
  "grocery list updated" notification to the caller's enabled subscriptions
- `POST /api/modules/hsa/parse-receipt` — Gemini-powered parser for
  medical receipts

## Notification Routes

#### `/api/notifications/send-test`
- **Method**: POST
- **Description**: Manually trigger a notification send for testing
- **Response**: `{ success: boolean, message: string, timestamp: string }`
- **Authentication**: Required (admin)

#### `/api/notifications/cron`
- **Method**: GET or POST
- **Description**: Scheduled endpoint for daily birthday/anniversary notifications
- **Response**: `{ success: boolean, message: string, timestamp: string }`
- **Authentication**: Optional CRON_SECRET header for external schedulers
- **Schedule**: Daily at 9:00 AM (configured in vercel.json)

## Environment Variables Required

### For Grocery APIs
- `GEMINI_API_KEY`: Google Gemini API key (required for AI categorization and image processing)
- `AEPBASE_URL`: aepbase server URL (defaults to `http://127.0.0.1:8090`)

### For Notification APIs
- `VAPID_PUBLIC_KEY`: VAPID public key for web push notifications
- `VAPID_PRIVATE_KEY`: VAPID private key for web push notifications
- `VAPID_EMAIL`: Contact email for VAPID (e.g., mailto:admin@example.com)
- `AEPBASE_ADMIN_EMAIL`: aepbase superuser email (for accessing all people records)
- `AEPBASE_ADMIN_PASSWORD`: aepbase superuser password
- `CRON_SECRET`: Optional secret for securing the cron endpoint (when not using Vercel Cron)

## Authentication

All API routes verify authentication using the aepbase bearer token passed in the `Authorization` header:

```
Authorization: Bearer <aepbase-token>
```

The token is obtained from the aepbase auth wrapper in the frontend and included in all API requests.

## Cron Job Setup

### Vercel Deployment
If deploying to Vercel, the cron job is automatically configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Other Deployments
For other deployment platforms, you can use an external cron service (e.g., cron-job.org) to call the endpoint:

```bash
curl -X POST https://your-domain.com/api/notifications/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Set the `CRON_SECRET` environment variable to secure the endpoint.

## Testing

Test the APIs using curl or Postman:

```bash
# Grab an aepbase auth token by logging in via the frontend, then:
TOKEN="your-aepbase-token"

# Test grocery categorization
curl -X POST http://localhost:3000/api/groceries/categorize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"apple"}'

# Test notification cron (admin only)
curl -X POST http://localhost:3000/api/notifications/send-test \
  -H "Authorization: Bearer $TOKEN"
```

All client-side calls forward the aepbase auth token automatically.
