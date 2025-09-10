# E‑Signature System Specification

## Purpose
A lightweight agreement e‑signing flow that supports typed or drawn signatures, optional credit card authorization metadata, PDF generation, and download links. Includes view/sign tracking and optional Google Drive upload.

## Core Models

### Agreement
- id: string
- campaign_id: string
- contact_id: string
- contact_name: string
- contact_email: string
- company?: string
- start_date: string
- setup_fee: number
- monthly_fee: number
- campaign_name: string
- status: 'pending' | 'viewed' | 'signed'
- signature?: string (typed text or data URL for image)
- signature_type?: 'typed' | 'drawn'
- signed_date?: string
- signed_at?: DateTime
- viewed_at?: DateTime
- created_at: DateTime
- updated_at: DateTime
- pdf_data?: base64 (agreement PDF)
- agreement_url?: string
- agreement_pdf_path?: string (backend/uploads/agreements/{id}/agreement.pdf)

### Credit Card Authorization (optional metadata)
- cc_name_on_card?: string
- cc_last4?: string
- cc_brand?: string
- cc_authorization_signature?: string (typed or data URL image)
- cc_authorization_signed_date?: string
- cc_exp_month?: string
- cc_exp_year?: string
- cc_zip?: string
- cc_pdf_data?: base64 (credit card authorization PDF)
- cc_pdf_path?: string (backend/uploads/agreements/{id}/cc_authorization.pdf)

## Frontend UI (AgreementSigningPage)
- Loads agreement by ID: GET /api/agreements/{id}
- Marks viewed if pending: POST /api/agreements/{id}/view
- Signature capture modes:
  - Typed: text input (cursive styling)
  - Drawn: signature canvas (react-signature-canvas) → PNG data URL
- Terms acceptance checkbox required
- Optional Credit Card Authorization block:
  - Name on Card, Card Brand, Last 4, Exp (MM/YY), ZIP
  - Typed or Drawn CC signature capture
- Actions:
  - Print Agreement
  - Sign Agreement → POST /api/agreements/{id}/sign
  - After success: auto-download service agreement PDF; show Download buttons
- States:
  - Loading, Not Found, Already Signed (with "Download PDF" / "Sign a New Copy"), Success confirmation
- Template rendering:
  - Static HTML template shown in iframe (`/agreements/template.html`) for visual context (optional)
  - Page auto-resizes iframe height for clean layout

## Backend API (FastAPI)
Base: `/api/agreements`

- GET `/{agreement_id}` → AgreementResponse
- POST `/{agreement_id}/view` → mark viewed (if pending); update `viewed_at`; optional contact.agreement_status='viewed'
- POST `/{agreement_id}/sign` → SignAgreementRequest
  - Validates and stores signature, sets status='signed', timestamps
  - Generates PDFs:
    - Service Agreement PDF (ReportLab)
    - Credit Card Authorization PDF (if CC metadata provided)
  - Persists bytes to `backend/uploads/agreements/{id}/`
  - Stores base64 in DB fields for redundancy
  - Optionally uploads PDFs to Google Drive if `drive_folder_id` provided
  - Sends confirmation email with download links (if email service configured)
  - Returns signed metadata + public URLs
- GET `/{agreement_id}/pdf` → returns service agreement PDF (signed or preview)
- GET `/{agreement_id}/cc-pdf` → returns CC authorization PDF if exists
- POST `/{agreement_id}/duplicate` → create a new pending copy from an existing agreement

### Admin/Utilities
- POST `/admin/clear-signatures` → clears signatures/PDFs for all agreements; resets to pending
- POST `/admin/backfill-latest` → updates contact records to point to latest agreement PDFs by email
- POST `/admin/repair-all-pdfs` → regenerates PDFs for all signed agreements
- POST `/admin/repair-campaign-pdfs/{campaign_id}` → regenerates PDFs and refreshes contact `agreement_data`
- GET `/{agreement_id}/debug` → debug record + file presence
- GET `/{agreement_id}/test-pdfs` → generate both PDFs for compare
- GET `/{agreement_id}/verify-stored-pdfs` → surface previews and paths

## PDF Generation (ReportLab)
- Agreement PDF content:
  - Title, client info (name, email, company, campaign, start date)
  - Optionally loads docx content (agree-temp.docx) and renders (skips payment section)
  - Signature section: typed text signature or embedded image (decoded from data URL)
- CC Authorization PDF content:
  - Client and agreement metadata
  - Cardholder details (metadata only, no PCI data)
  - Authorization text
  - Cardholder signature (typed or image)
- Files written to `backend/uploads/agreements/{id}/` with consistent names

## Public URLs
- Files under `backend/uploads` are exposed as `/uploads/...`
- `compute_public_url(path)` normalizes and rewrites to proper public URL for Render or local

## Email Confirmations (optional)
- HTML and plain-text confirmation with buttons/links to PDFs
- Uses configured `email_service`

## Minimal Request/Response Types
```ts
// Sign request
interface SignAgreementRequest {
  signature: string;                 // typed text or data URL (PNG)
  signature_type?: 'typed' | 'drawn';
  signed_date: string;               // display date
  // Optional CC block
  cc_name_on_card?: string;
  cc_card_brand?: string;
  cc_last4?: string;
  cc_authorization_signature?: string; // typed or data URL
  cc_authorization_signed_date?: string;
  cc_exp_month?: string;
  cc_exp_year?: string;
  cc_zip?: string;
  // Optional uploads target
  drive_folder_id?: string;
}

// Agreement response (subset)
interface AgreementResponse {
  id: string;
  contact_name: string;
  contact_email: string;
  company?: string;
  start_date: string;
  setup_fee: number;
  monthly_fee: number;
  campaign_name: string;
  status: 'pending' | 'viewed' | 'signed';
  signed_at?: string;
  signature?: string;
  agreement_pdf_url?: string;
  cc_pdf_url?: string;
}
```

## Implementation Notes
- Persist PDFs immediately after signing for deterministic downloads
- Non-PCI collection: store only metadata (name/brand/last4 + signature); never store full PAN/CVV
- Provide clear success UI with immediate download links and email confirmation
- Use typed/drawn toggles for both main and CC signature capture
- Ensure `/uploads` static serving is wired to `backend/uploads`
