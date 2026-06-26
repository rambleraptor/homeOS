# HSA App

Track unreimbursed medical expenses for tax-free HSA withdrawals.

## Overview

The HSA (Health Savings Account) app helps you track out-of-pocket medical expenses that you've paid with personal funds. These expenses can be reimbursed from your HSA at any time in the future, tax-free. The app calculates your "Liquidatable Tax-Free Cash" - the total amount you can withdraw from your HSA.

## Features

### 📊 KPI Dashboard
- **Liquidatable Tax-Free Cash**: Prominently displays the total amount available for tax-free withdrawal
- Real-time calculation based on stored (unreimbursed) receipts
- Summary statistics showing stored vs. reimbursed receipts

### 📸 AI-Powered Receipt Parsing
- Upload receipt images (JPEG, PNG, WebP, GIF) or PDFs
- Click "Parse Receipt with AI" to automatically extract:
  - Merchant/Provider name
  - Service date
  - Amount paid
  - Category (Medical, Dental, Vision, Rx)
  - Patient name (if visible)
- Powered by Google Gemini 2.5 Flash vision model

### 📝 Quick Capture Form
- Simple, clean form for adding receipts
- Required fields: Merchant, Service Date, Amount, Category, Receipt File
- Optional fields: Patient, Notes
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

### Parse Receipt
```
POST /api/apps/hsa/parse-receipt
Authorization: Bearer <token>
Content-Type: application/json

{
  "image": "<base64_encoded_image>",
  "mimeType": "image/jpeg"
}

Response:
{
  "data": {
    "merchant": "CVS Pharmacy",
    "service_date": "2024-01-15",
    "amount": 45.99,
    "category": "Rx",
    "patient": "John Smith"
  },
  "message": "Receipt parsed successfully"
}
```

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
   - Click "Add Receipt" in the Quick Capture section
   - Upload your receipt image or PDF
   - For images, click "Parse Receipt with AI" to auto-fill fields
   - Review and adjust the parsed data
   - Click "Save Receipt"

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
src/apps/hsa/
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

Receipt parsing uses the instance's configured AI provider. Set the `ai` block
in `homestead.config.ts` (provider, model, auth) and supply the key via the
environment:

```bash
# In the project's .env
AI_API_KEY=your_ai_provider_api_key_here
```

The model must be vision-capable (e.g. `gpt-4o`, `claude-3-5-sonnet-latest`,
`gemini-2.5-flash`). See the [AI guide](../../homestead-site/docs/guides/ai.md).

### aepbase URL

The app talks to aepbase via the shared `/api/aep` same-origin
prefix on the one server port. Server-side helpers reach the engine at the
same prefix; override the target by setting `AEPBASE_URL` if the engine runs
somewhere other than `http://127.0.0.1:3000/api/aep`.

## Tips

1. **Better Parsing Results**: Take clear, well-lit photos of receipts with all text visible
2. **Manual Review**: Always review AI-parsed data before saving
3. **Organize Receipts**: Use the Patient field to track expenses by family member
4. **Regular Backups**: Keep receipts stored for IRS audit purposes (typically 3-7 years)
5. **Notes Field**: Add context like "vision exam" or "prescription refill" for future reference
