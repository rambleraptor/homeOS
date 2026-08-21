# HSA App

Track unreimbursed medical expenses for tax-free HSA withdrawals.

## Overview

The HSA (Health Savings Account) app helps you track out-of-pocket medical expenses that you've paid with personal funds. These expenses can be reimbursed from your HSA at any time in the future, tax-free. The app calculates your "Liquidatable Tax-Free Cash" - the total amount you can withdraw from your HSA.

## Features

### 📊 KPI Dashboard
- **Liquidatable Tax-Free Cash**: Prominently displays the total amount available for tax-free withdrawal
- Real-time calculation based on stored (unreimbursed) receipts
- Summary statistics showing stored vs. reimbursed receipts

### 📸 Automatic Capture from Documents
- Upload a receipt in the **Documents** app instead of keying it in here.
- The documents pipeline classifies it as a `medical-receipt`, extracts the
  merchant, date, amount, category, and patient, and mirrors the result into
  HSA Receipts automatically — the created receipt links back to the source
  document via `source_document` rather than storing a second copy of the file.
- See `documents/doc-types/medical-receipt.ts` and its `post_classify` hook at
  `documents/doc-types/post-classify/medical-receipt.server.ts`.

### 📝 Quick Capture Form
- Simple, clean form for adding a receipt by hand.
- Required fields: Merchant, Service Date, Amount, Category, Receipt File
- Optional fields: Patient, Person, Notes
- File upload with validation (max 10MB)
- Real-time form validation

### 🗂️ Audit Vault
- Comprehensive table view of all receipts
- Filter by status: All, Stored, Reimbursed
- Columns: Date, Merchant, Amount, Category, Patient, Receipt (link), Status, Actions
- Direct links to view uploaded receipt files
- "Mark as Reimbursed" button to update receipt status
- Delete functionality with confirmation

## File Storage

### Where Uploads Are Stored

Receipt files are stored by aepbase on disk under `aepbase/data/files/`:

```
aepbase/
└── data/
    └── files/
        └── <plural>/<record_id>/<filename>
```

### Accessing Files

File fields are downloaded via aepbase's `:download` custom method on
the parent resource (e.g. `POST /hsa-receipts/{id}:download`). The
frontend abstracts this through the standard aepbase wrapper.

### File Security

- Files inherit the access scoping of the owning resource (per-user via
  parent scoping)
- Authentication is required to download files

### Backup Considerations

When backing up your Homestead data, include the entire
`aepbase/data/` directory:
- `aepbase/data/data.db` - SQLite database with receipt metadata
- `aepbase/data/files/` - Uploaded receipt blobs

## API Endpoints

AI extraction is no longer a bespoke HSA endpoint — it's handled by the
Documents app, which classifies an uploaded receipt and mirrors it into HSA.

### CRUD Operations

All CRUD operations use the shared aepbase wrapper through React Query hooks:

- `useHSAReceipts()` - Fetch all receipts
- `useHSAStats()` - Get calculated statistics
- `useCreateHSAReceipt()` - Create new receipt
- `useUpdateHSAReceipt()` - Update receipt (mark as reimbursed)
- `useDeleteHSAReceipt()` - Delete receipt

## Database Schema

Collection: `hsa_receipts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| merchant | text | Yes | Provider name (e.g., "CVS Pharmacy") |
| service_date | date | Yes | Date of service |
| amount | number | Yes | Amount paid (min: 0) |
| category | select | Yes | Medical, Dental, Vision, or Rx |
| patient | text | No | Patient name |
| status | select | Yes | Stored or Reimbursed |
| receipt_file | file | Yes | Image or PDF (max 10MB) |
| notes | text | No | Additional notes |
| created_by | relation | No | User who created the record |

## Usage

1. **Add a Receipt**:
   - To capture automatically, upload the receipt in the **Documents** app —
     it's classified and mirrored into HSA for you.
   - To add one by hand, click "Add Receipt" in the Quick Capture section,
     upload the receipt image or PDF, fill in the fields, and click "Save
     Receipt".

2. **Mark as Reimbursed**:
   - When you withdraw money from your HSA
   - Find the receipt in the Audit Vault
   - Click "Mark Reimbursed"
   - The receipt is removed from the Liquidatable Cash total

3. **Filter Receipts**:
   - Use the dropdown in the Audit Vault
   - View "All", "Stored", or "Reimbursed" receipts

4. **View Receipt**:
   - Click the "View" link in the Receipt column
   - Opens the receipt file in a new tab

## Development

### Adding New Features

The app follows the standard Homestead app pattern:

```
packages/homestead-apps/receipts/
├── components/           # UI components
├── hooks/               # React Query hooks
├── types.ts            # TypeScript types
├── app.config.ts    # App metadata
└── index.ts            # Public exports
```

### Testing

Run tests with:
```bash
make test
```

## Configuration

### AI provider

The HSA app itself no longer calls the AI provider directly — receipt
extraction is done by the Documents app. Configure the `ai` block in
`homestead.config.ts` for that pipeline; see the
[AI guide](../../homestead-site/docs/guides/ai.md).

### aepbase URL

The app talks to aepbase via the shared `/api/aep` same-origin
prefix on the one server port. Server-side helpers reach the engine at the
same prefix; override the target by setting `AEPBASE_URL` if the engine runs
somewhere other than `http://127.0.0.1:3000/api/aep`.

## Tips

1. **Better Extraction Results**: When capturing via Documents, upload a clear, well-lit scan or photo with all text visible
2. **Manual Review**: Review a mirrored receipt's fields before marking it reimbursed
3. **Organize Receipts**: Use the Patient/Person fields to track expenses by family member
4. **Regular Backups**: Keep receipts stored for IRS audit purposes (typically 3-7 years)
5. **Notes Field**: Add context like "vision exam" or "prescription refill" for future reference
