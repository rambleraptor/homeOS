# Developer Actions Architecture

## Overview

The Developer module provides a UI for managing and executing automated Playwright scripts. Actions can be triggered manually from the UI with support for interactive prompts (like 2FA codes).

## Current Status

✅ **Completed:**
- Database schema (PocketBase migrations)
- Safeway coupon clipper Playwright script
- Developer module UI (basic structure)
- Module registration

🚧 **In Progress / TODO:**
- Action execution backend service
- Real-time run status updates
- Interactive input prompts UI
- Action CRUD operations
- Run history viewing

## Architecture

### 1. Database Schema

**Collections:**

- **`actions`** - Action definitions
  - `name`: Action display name
  - `description`: Action description
  - `script_id`: Identifier for the Playwright script (e.g., "safeway_coupons")
  - `parameters`: JSON object with script parameters
  - `last_run_at`: Timestamp of last execution
  - `created_by`: User who created the action

- **`action_runs`** - Execution history
  - `action`: Relation to action
  - `status`: pending | running | awaiting_input | success | error
  - `started_at`: Execution start time
  - `completed_at`: Execution completion time
  - `duration_ms`: Execution duration
  - `logs`: Array of log entries
  - `error`: Error message if failed
  - `result`: JSON result data
  - `input_request`: Pending input request (for awaiting_input status)
  - `input_response`: User-provided input

### 2. Playwright Scripts

Located in: `scripts/actions/`

**Example: Safeway Coupon Clipper** (`safeway-coupons.js`)
- Logs into Safeway.com
- Handles 2FA verification (requires manual code entry on first run)
- Navigates to deals page
- Clips all available coupons
- Returns summary of clipped coupons

**Script Interface:**
```javascript
async function run(parameters, logger) {
  // parameters: { email, password, ... }
  // logger: { log, error, warn }
  // Returns: { success, clipped, total, message }
}
```

### 3. Interactive Execution Flow

**Step 1: User triggers action**
- User clicks "Run" button in UI
- Frontend creates `action_run` record with status="pending"
- Backend service picks up the run

**Step 2: Execution starts**
- Backend updates status to "running"
- Playwright script begins execution
- Logs streamed to `logs` array

**Step 3: Input request (if needed)**
- Script needs 2FA code
- Backend updates run:
  - `status`: "awaiting_input"
  - `input_request`: { prompt: "Enter 2FA code", field_name: "verificationCode", field_type: "text" }
- UI detects status change and shows modal

**Step 4: User provides input**
- User enters code in modal
- Frontend updates `input_response` field
- Backend detects response and resumes script

**Step 5: Completion**
- Script finishes
- Backend updates:
  - `status`: "success" or "error"
  - `completed_at`: timestamp
  - `duration_ms`: execution time
  - `result`: script return value

### 4. Frontend Components

**Current:**
- `ActionsPage.tsx` - Main actions list/dashboard
- Module registration in `registry.ts`
- Route setup in `app/(app)/developer/page.tsx`

**TODO:**
- Action detail page
- Action form (create/edit)
- Run history viewer
- Log viewer component
- Input prompt modal

### 5. Backend Service (TODO)

**Requirements:**
- PocketBase hook or standalone service
- Watches for `action_run` records with status="pending"
- Executes Playwright scripts
- Handles input pausing/resuming
- Streams logs to database
- Manages script lifecycle

**Proposed Implementation:**
```
pb_hooks/
└── actions/
    ├── action-runner.js      # Main execution service
    ├── script-loader.js      # Loads and validates scripts
    └── input-manager.js      # Handles interactive inputs
```

## Example: Running Safeway Coupon Clipper

1. **Create Action:**
   ```json
   {
     "name": "Safeway Coupon Clipper",
     "description": "Automatically clips all available Safeway coupons",
     "script_id": "safeway_coupons",
     "parameters": {
       "email": "user@example.com",
       "password": "********"
     }
   }
   ```

2. **Run Action:**
   - User clicks "Run" button
   - System creates action_run record
   - Backend executes `scripts/actions/safeway-coupons.js`

3. **Handle 2FA:**
   - Script requests verification code
   - Status changes to "awaiting_input"
   - UI shows modal: "Enter 2FA code sent to your email"
   - User enters code
   - Script continues

4. **View Results:**
   - Status changes to "success"
   - Result: `{ clipped: 45, total: 45, message: "Clipped 45 of 45 coupons" }`
   - Logs show step-by-step progress

## Next Steps

1. **Implement backend execution service** (pb_hooks)
2. **Build UI components:**
   - Action form
   - Run viewer
   - Input prompt modal
3. **Add real-time updates** (polling or WebSockets)
4. **Create more action scripts:**
   - Other grocery stores
   - Bill payments
   - Account monitoring
5. **Add scheduling** (future feature - cron-based execution)

## Files Created

**Migrations:**
- `pb_migrations/1739000000_created_actions.js`
- `pb_migrations/1739000001_created_action_runs.js`

**Frontend:**
- `frontend/src/modules/developer/module.config.ts`
- `frontend/src/modules/developer/types.ts`
- `frontend/src/modules/developer/index.ts`
- `frontend/src/modules/developer/components/ActionsPage.tsx`
- `frontend/src/app/(app)/developer/page.tsx`
- Updated: `frontend/src/modules/registry.ts`

**Scripts:**
- `scripts/package.json`
- `scripts/actions/safeway-coupons.js`

## Credentials Management

**Current:** Parameters stored in plain JSON in PocketBase (encrypted at rest by PocketBase)

**TODO:** Consider adding encryption layer for sensitive parameters like passwords

## Testing

**Migrations:** ✅ Tested and passing (`make test-migrations`)
**Frontend:** ✅ Type-checks passing
**Playwright Script:** ⚠️ Manually tested in Chrome, needs automated test
