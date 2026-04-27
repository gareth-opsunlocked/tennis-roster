# Trust Accounting Module — Design Spec
**Date:** 2026-04-27
**Status:** Approved for implementation planning

---

## 1. Overview

A standalone, cloud-hosted SaaS web application that provides Queensland-compliant trust accounting for property managers and accommodation providers. **PMS-agnostic** means it can plug into any Property Management System via an adapter pattern — agencies keep their existing PMS and add this as a dedicated, auditor-grade trust accounting layer on top. Data flows in from a connected PMS automatically, with manual entry as a fallback.

**Primary goals:**
- Demonstrate end-to-end trust accounting flows convincingly to investors and potential clients
- Pass scrutiny from a QLD trust account auditor — every compliance requirement is enforced at the system level, not just the UI level
- Prove the adapter pattern works by shipping at least one real PMS integration alongside the core module

**Out of scope for PoC:**
- Owner portal (self-service owner login)
- Multi-tenancy (single agency for PoC)
- Mobile app
- Live bank feeds (CSV import is the PoC approach; Open Banking via Basiq/Frollo is the roadmap item to match Resly)

---

## 1a. Competitive Context

All major QLD competitors (Resly, HiRUM, REI Master) require the agency to adopt their full PMS stack. Trust accounting is a module inside their closed ecosystem — agencies cannot use it without switching everything.

| Platform | Strength | Weakness |
|----------|----------|----------|
| **Resly** | Live bank feeds (30+ banks), short stay / management rights focus, QLD-based | Short stay only, closed ecosystem, no open API |
| **HiRUM** | Long-established, 1,200+ properties, solid 3-way reconciliation | On-premise installs still common, no open API, agencies locked in |
| **REI Master** | Widest property type coverage (permanent, holiday, commercial, management rights) | Closed ecosystem, older tech stack, no open API |
| **Guesty** | Global platform, launched AU/NZ trust accounting March 2026, developed with a leading AU audit firm | Short-stay only, closed ecosystem, trust accounting only works if you're a Guesty customer |

**Market signal:** Guesty's March 2026 launch confirms that QLD trust accounting compliance is a serious, unsolved problem that global players are now investing in. Every solution in market requires the agency to adopt the full PMS stack — trust accounting is the hook, not a standalone module.

**Our differentiation:** The only standalone, PMS-agnostic trust accounting module. Agencies keep their existing PMS — Resly, HiRUM, REI Master, Guesty, Console Cloud, PropertyMe, or anything else — and plug our module in for compliance. If they ever switch PMS, their trust accounting history stays intact. These platforms are not our competitors; they are our integration targets and our sales channel.

---

## 2. Target Users & Roles

Three roles with strictly enforced permissions:

| Role | Access |
|------|--------|
| **Property Manager** | Full create/edit access. Cannot modify locked periods. Cannot view audit trail internals. |
| **Super Admin** | All property manager access, plus: unlock locked periods (with mandatory reason), manage users, configure agency settings. |
| **Auditor** | Read-only access to all records, reports, reconciliations, and full audit trail. Cannot create, edit, or delete anything. Cannot see owner bank account details. |

**Target agency size:** Sole operator to small agency — one trust account, 10–50 properties, 10–20 owners.

---

## 3. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 (App Router) + React | SSR, routing, API in one framework |
| API | tRPC | End-to-end type safety from DB to UI — financial systems need this |
| ORM | Prisma | Type-safe queries, auditable migration history |
| Database | PostgreSQL (Neon serverless) | ACID compliance, strong relational integrity for financial data |
| Auth | Clerk | Multi-role auth with minimal setup |
| UI | shadcn/ui + Tailwind CSS | Professional, accessible components |
| PDF | @react-pdf/renderer | Owner statements, receipts, reports |
| Deployment | Vercel (app) + Neon (database) | Scalable, minimal ops overhead |

---

## 4. Data Model

### Properties & People

**Property**
- `id`, `address`, `type` (RESIDENTIAL | SHORT_STAY), `status` (ACTIVE | INACTIVE)
- `revenueRecognition` (CHECK_IN | CHECK_OUT) — short stay only, overrides agency default
- `ownerId` (FK → Owner)
- `developerGuarantee` (optional: guarantor entity, guaranteed amount, start/end date)

**Owner**
- `id`, `name`, `email`, `phone`, `ABN`
- `bankBSB`, `bankAccountNumber`, `bankAccountName` — for ABA file generation
- `gstRegistered` (boolean)

**Tenant** (residential)
- `id`, `name`, `email`, `phone`
- `propertyId`, `leaseStart`, `leaseEnd`, `weeklyRent`, `bondAmount`, `status`

**Booking** (short stay)
- `id`, `propertyId`, `guestName`, `guestEmail`, `guestPhone`
- `checkIn`, `checkOut`, `nightlyRate`, `cleaningFee`, `platformCommission`
- `platform` (DIRECT | AIRBNB | STAYZ | BOOKING_COM | OTHER)
- `status` (CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED)

---

### Trust Account

**TrustAccount**
- `id`, `bankName`, `bsb`, `accountNumber`, `accountName`
- `apcaUserId` — for ABA file generation (assigned by bank)
- `currentBalance` — always derived at query time (sum of all CLEARED receipts minus sum of all PROCESSED disbursements); never stored as a column to prevent drift

**TrustReceipt** (money IN to trust account)
- `id`, `receiptNumber` (sequential, never reused), `date`, `amount`
- `payerName`, `propertyId`, `tenantId` (nullable), `bookingId` (nullable)
- `type`: RENT | BOND | BOOKING_PAYMENT | CLEANING_FEE | SECURITY_DEPOSIT | DEVELOPER_GUARANTEE_TOP_UP | OTHER
- `accountType`: TRUST | GENERAL
- `gstTreatment`: INCLUSIVE | EXCLUSIVE | EXEMPT
- `gstAmount` (computed)
- `recognitionDate` — when this flows to owner ledger (= receipt date for residential; = check-in or check-out date for short stay per property setting)
- `status`: PENDING_CLEARANCE | CLEARED | REVERSED
- `reversedById` (FK → TrustReceipt, nullable) — reversal creates a counter-entry, never deletes
- `inTransit` (boolean) — true until matched in bank reconciliation

**Disbursement** (money OUT of trust account)
- `id`, `referenceNumber` (sequential), `date`, `amount`
- `payeeName`, `propertyId`, `ownerId` (nullable)
- `type`: OWNER_PAYMENT | MAINTENANCE | MANAGEMENT_FEE_DRAW | CLEANING_COST | PLATFORM_COMMISSION | TRANSFER_TO_GENERAL | OWNER_ADVANCE | TRUST_ACCOUNT_LOAN | OTHER
- `accountType`: TRUST | GENERAL
- `gstTreatment`: INCLUSIVE | EXCLUSIVE | EXEMPT
- `gstAmount` (computed)
- `authorisedBy` (userId)
- `status`: PENDING_EFT | IN_ABA_FILE | PROCESSED | REVERSED
- `abaFileId` (FK → ABAFile, nullable)
- `inTransit` (boolean) — true until matched in bank reconciliation

---

### Owner Ledgers

**OwnerLedgerEntry**
- `id`, `ownerId`, `propertyId`, `date`, `description`
- `debit`, `credit`, `runningBalance`
- `entryType`: RECEIPT | DISBURSEMENT | ADVANCE | ADVANCE_RECOVERY | MANAGEMENT_FEE | DEVELOPER_GUARANTEE
- `trustReceiptId` (FK, nullable), `disbursementId` (FK, nullable)
- Auto-created by the system when receipts or disbursements are posted. Never created manually.

**OwnerAdvance**
- `id`, `ownerId`, `propertyId`, `amount`, `date`, `reason`
- `status`: OUTSTANDING | PARTIALLY_RECOVERED | RECOVERED
- `outstandingAmount` — tracked as funds are recovered from future rental income
- `alertAfterDays` (default: 30) — dashboard alert if unrecovered beyond this

---

### Bank Reconciliation

**BankReconciliation**
- `id`, `period` (YYYY-MM), `bankStatementBalance`, `trustLedgerBalance`, `ownerLedgerSumBalance`
- `receiptsInTransit` (sum), `paymentsInTransit` (sum)
- `adjustedBankBalance` — bankStatementBalance + receiptsInTransit - paymentsInTransit
- `difference` — must be $0.00 to lock
- `status`: OPEN | RECONCILED | LOCKED
- `lockedAt`, `lockedBy`

**Three-way formula enforced on lock:**
```
Bank Statement Balance
+ Receipts in Transit
- Payments in Transit
= Trust Ledger Balance
= Sum of Owner Ledger Balances
```
All three values displayed at all times during reconciliation. Period cannot be locked until `difference = $0.00`.

**BankStatementImport**
- `id`, `reconciliationId`, `filename`, `importedAt`, `importedBy`
- `bankFormat`: NAB | CBA | WESTPAC | ANZ | OTHER_CSV

**BankStatementLine**
- `id`, `importId`, `date`, `description`, `amount`, `matchStatus`: MATCHED | UNMATCHED | IGNORED
- `matchedReceiptId` (nullable), `matchedDisbursementId` (nullable)

---

### ABA File

**ABAFile**
- `id`, `generatedAt`, `generatedBy`, `filename`, `description`
- `totalAmount`, `lineCount`, `periodMonth`
- `status`: GENERATED | SUBMITTED_TO_BANK | CONFIRMED

**ABAFileLine**
- `id`, `abaFileId`, `disbursementId`
- `bsb`, `accountNumber`, `accountName`, `amount`, `lodgementReference`

---

### Audit Log (append-only)

**AuditLog**
- `id`, `timestamp`, `userId`, `userRole`, `action`
- Actions: RECEIPT_CREATED | RECEIPT_REVERSED | DISBURSEMENT_MADE | DISBURSEMENT_REVERSED | RECONCILIATION_LOCKED | RECONCILIATION_UNLOCKED | PERIOD_MODIFIED | ABA_GENERATED | OWNER_ADVANCE_CREATED | SETTINGS_CHANGED | USER_CREATED | USER_ROLE_CHANGED
- `entityType`, `entityId`
- `before` (JSON), `after` (JSON)
- `ipAddress`, `reason` (required for RECONCILIATION_UNLOCKED and PERIOD_MODIFIED)

**Enforcement:** No UPDATE or DELETE is ever permitted on this table at the database level (enforced via Prisma middleware and a database-level trigger).

---

## 5. Feature Modules

### 5.1 Trust Receipts
- New receipt form: date, amount, payer, property, type, GST treatment, tenancy/booking link
- System auto-assigns sequential receipt number (never reused, never skipped)
- Revenue recognition: for residential → receipted date; for short stay → check-in or check-out date per property setting
- In-transit flag set automatically; cleared when matched in reconciliation wizard
- No receipt can be deleted. Reversal creates an equal and opposite counter-entry — both remain in the audit trail
- PDF receipt generation per transaction

### 5.2 Disbursements
- New disbursement form: date, amount, payee, property, owner, type, GST treatment
- Hard block at tRPC layer if disbursement would overdraw the owner's ledger or the trust account overall
- Batch owner payment run: select multiple owners → system calculates each owner's available balance → generates disbursement for each → bundles into ABA file
- Disbursements marked PENDING_EFT until ABA file confirmed as submitted
- Management fee draw: specific type that moves money from trust account to general account — recorded in both

### 5.3 Owner Ledgers
- Individual running ledger per owner, per property
- Debit/credit/running balance visible at all times
- Entries auto-created on every receipt and disbursement — never manually entered
- Available balance = current ledger balance (cleared receipts only, recognised per revenue recognition setting)
- Owner advances tracked separately with recovery status

### 5.4 Bank Reconciliation
**Automated wizard (4 steps):**
1. Import bank statement CSV (NAB, CBA, Westpac, ANZ formats supported out of the box; generic CSV fallback)
2. Auto-match: exact amount + date ± 3 days + description keyword matching. Confidence score shown per match.
3. Review screen: matched (green), unmatched (amber), in-transit items (blue). Manual match remaining.
4. Three-way balance check. Difference shown in real time. Lock button enabled only when difference = $0.00.

**Money in transit:** Receipts and disbursements flagged as in-transit appear in their own section of the reconciliation screen. Aged in-transit items (>5 days) flagged on dashboard.

**Locked periods:** Once locked, no property manager can edit transactions in that period. Any change requires super admin unlock with a mandatory written reason — recorded permanently in audit log. Changes create reversing entries, never modify originals.

### 5.5 Reports (all exportable as PDF)
| Report | Description |
|--------|-------------|
| Trial Balance | All owner ledger balances vs trust account balance — must net to zero |
| Receipts Register | All receipts for a selected date range, filterable by type/property |
| Disbursements Register | All disbursements for a selected date range |
| Owner Statements | Individual statement per owner for any period — shows all debits, credits, opening and closing balance |
| GST Summary | Taxable vs exempt transactions grouped for BAS preparation |
| ABA File History | All ABA files generated, with status and line detail |
| Audit Trail Export | Full audit log for any period, exportable as CSV |

### 5.6 Audit Trail
- Dedicated screen for auditor role
- Filter by: user, action type, date range, entity type, entity ID
- Every write operation automatically appends a row — no exceptions
- Reason field mandatory for sensitive actions (unlock, period modification)
- Export as CSV for auditor's own records

---

## 6. Compliance Rules (enforced at tRPC layer)

| Rule | Enforcement |
|------|------------|
| Sequential receipt numbers | Auto-assigned, never reused, gap detection alerts |
| No overdrawn owner ledgers | Hard block on disbursement if owner balance insufficient |
| No overdrawn trust account | Hard block if trust account total would go negative |
| Three-way balance on lock | Period cannot be locked if difference ≠ $0.00 |
| Immutable audit log | DB-level trigger prevents UPDATE/DELETE on audit_log table |
| Management fees not left in trust | Dashboard alert if undrawn management fees >7 days old |
| Monthly reconciliation | Dashboard alert if current month not yet reconciled by 5th of following month |
| Locked period protection | Property manager writes to locked periods blocked at tRPC middleware |
| In-transit aged items | Dashboard alert for any in-transit item >5 days old |
| Owner advance recovery | Dashboard alert for unrecovered advances older than configured threshold |

---

## 7. GST Treatment

Agency-level setting: `gstRegistered` (boolean). If false, all GST fields hidden system-wide.

Per transaction, three options:
- **INCLUSIVE** — amount entered includes GST. System splits: net = amount ÷ 1.1, GST = amount - net
- **EXCLUSIVE** — amount entered is ex-GST. System adds: GST = amount × 0.1, gross = amount + GST
- **EXEMPT** — no GST (residential rent, bonds, security deposits, trust money transfers)

Default GST treatment per transaction type:

| Transaction Type | Default GST |
|-----------------|-------------|
| Residential rent | EXEMPT |
| Bond | EXEMPT |
| Booking payment | INCLUSIVE (if agency GST registered) |
| Cleaning fee | INCLUSIVE |
| Management fee draw | INCLUSIVE |
| Developer guarantee top-up | EXEMPT |
| Maintenance disbursement | INCLUSIVE |
| Owner payment | EXEMPT |

Overridable per transaction. GST amounts stored separately on every transaction. GST Summary report provides BAS-ready figures.

---

## 8. Revenue Recognition (Short Stay)

Agency default setting: `revenueRecognition` (CHECK_IN | CHECK_OUT), overridable per property.

- **Trust receipt** always recorded on the date money is physically received (at time of booking payment)
- **Owner ledger entry** (and availability for disbursement) delayed until recognition date:
  - CHECK_IN: recognition date = booking check-in date
  - CHECK_OUT: recognition date = booking check-out date
- Money sits in trust but does not appear in owner's available balance until recognition date
- Trial balance and three-way reconciliation account for this — "unrecognised trust receipts" shown as a reconciling item
- Cancellations: if booking cancelled before check-in, receipt reversed and refund processed as disbursement

---

## 9. Developer Guarantees

Configured per property:
- Guarantor entity name, guarantee amount per period (monthly), guarantee start date, guarantee end date
- Dashboard alert 30 days before guarantee expiry

Each period:
- If actual rent receipted ≥ guaranteed amount → no top-up required
- If actual rent < guaranteed amount → system prompts to create a **Developer Guarantee Top-Up** receipt for the shortfall
- Top-up receipted as trust money from the developer entity, flows to owner ledger
- Full guarantee history reportable per property

---

## 10. Trust vs General Account

Every transaction tagged as TRUST or GENERAL.

- **TRUST money:** rent, bonds, booking deposits, security deposits, developer guarantee payments — held on behalf of clients
- **GENERAL money:** management fees earned, GST collected — agency's own money

Management fee draw process:
1. Property manager initiates "Draw Management Fees" for a period
2. System calculates total management fees across all properties
3. Creates a disbursement of type MANAGEMENT_FEE_DRAW from trust account
4. Creates a corresponding TRANSFER_TO_GENERAL receipt in the general account ledger
5. Both sides recorded in audit log

Dashboard alert if undrawn management fees have been sitting in trust for >7 days.

---

## 11. ABA File Generation

Standard Australian Banking Association DE format.

File header: agency name, APCA User ID, date, description.
Per payment line: BSB, account number, account name, transaction code (credit = 50), amount, lodgement reference (owner name + period), trace BSB/account (agency's account).
File footer: total net amount, credit count, debit count.

Process:
1. Select disbursement batch (e.g. "June owner payments")
2. System validates all owners have BSB + account number on file
3. Validates all disbursements are in PENDING_EFT status
4. Generates `.aba` file, records ABAFile row in database
5. Disbursements move to IN_ABA_FILE status
6. Property manager downloads file, uploads to bank internet banking
7. Property manager marks ABA as SUBMITTED_TO_BANK
8. When bank processes, property manager confirms — disbursements move to PROCESSED and in-transit flag cleared

---

## 12. Dummy Data

Pre-seeded for the demo:

- 1 agency ("Sunshine Coast Realty"), GST registered, pooled trust arrangement
- 1 trust account (Westpac, realistic BSB/account)
- 15 properties (10 residential, 5 short stay)
- 10 owners (some own multiple properties)
- 15 tenants (residential leases)
- 30 bookings across 5 short stay properties (mix of Airbnb, Stayz, direct)
- 6 months of receipts and disbursements (realistic amounts, sequential receipt numbers)
- 6 completed and locked monthly reconciliations
- 1 developer guarantee (2 properties in a new development, guarantee active)
- 2 owner advances (1 recovered, 1 outstanding)
- 1 ABA file generated (demonstrating batch payment)
- Full audit trail history for all seeded activity

---

## 13. Locked Period / Super Admin Override

When a reconciliation period is locked:
- tRPC middleware rejects any write targeting a transaction in that period for property manager role
- Super admin can unlock via dedicated action — mandatory `reason` field (min 20 characters)
- Unlock event written to audit log: userId, timestamp, reason, period affected
- Any changes made during unlock window create **reversing entries** (original transaction untouched, new offsetting entry created with reference to original)
- Period re-locked by super admin when corrections complete
- Dashboard banner shown to all users while a previously-locked period is unlocked

---

## 14. Pooled Accounting Arrangement

Standard QLD practice — one trust account holds all client funds; individual owner ledgers maintain separation.

Documented in agency settings:
- Pooled arrangement name, establishment date, authorising document reference (for audit evidence)

Enforced invariant on every transaction:
```
Trust Account Balance = Sum of All Owner Ledger Balances + Unrecognised Trust Receipts
```
Any discrepancy triggers a system alert and blocks further writes until resolved.

---

## 15. Deployment

- **App:** Vercel (automatic deploys from main branch)
- **Database:** Neon (serverless PostgreSQL — scales to zero when not in use, no idle cost for PoC)
- **Auth:** Clerk (handles session management, role assignment, MFA)
- **Environment:** Single environment for PoC (no separate staging)
- **Repository:** New standalone repo — completely separate from any other project

---

## 16. PMS Integration Architecture

### Adapter Pattern

Each PMS integration is a self-contained adapter that implements a standard interface. Adding a new PMS means writing a new adapter — the trust accounting core is never modified.

```
PMS (Resly / HiRUM / REI Master / Console Cloud / PropertyMe / etc.)
        ↓  (webhook push OR scheduled pull)
  PMS Adapter Layer  ←— one adapter per PMS, maps PMS concepts → internal format
        ↓
  Ingestion API  (tRPC, authenticated via API key per agency)
        ↓
  Trust Accounting Core  (unchanged regardless of PMS)
```

### Standard Adapter Interface

Every adapter must map its PMS data to these internal events:

| Internal Event | PMS Equivalent |
|---------------|----------------|
| `receipt.created` | Payment received / booking deposit |
| `booking.confirmed` | Reservation confirmed (short stay) |
| `booking.checkedIn` | Guest check-in |
| `booking.checkedOut` | Guest check-out |
| `booking.cancelled` | Cancellation |
| `tenant.created` | New tenancy (residential) |
| `rent.received` | Rent payment |
| `maintenance.invoice` | Maintenance job completed |

### Ingestion API

Each agency gets an API key. The ingestion endpoint is:
```
POST /api/ingest/{agencyId}
Authorization: Bearer {apiKey}
Content-Type: application/json
{ "event": "receipt.created", "data": { ... }, "source": "resly" }
```

The adapter normalises PMS-specific payloads into this format before posting. Duplicate events are idempotent (same external reference ID = no duplicate receipt created).

### PoC Reference Integration: Resly

Resly is the priority first integration — Queensland-based, short-stay focused, modern API, and the closest competitor. The Resly adapter will:
- Consume Resly webhooks for booking events (confirmed, checked-in, checked-out, cancelled)
- Map Resly booking/payment data to trust receipts and bookings in our system
- Demonstrate end-to-end: booking made in Resly → automatically receipted in trust account → appears in owner ledger on recognition date

### Integration Targets (Roadmap Order)

1. **Resly** — PoC reference integration (short stay / management rights, QLD-based, modern API)
2. **Console Cloud** — largest residential PMS market share in QLD
3. **PropertyMe** — second largest residential QLD
4. **Guesty** — global short-stay platform, strong AU growth post March 2026 launch
5. **REI Master / REI Cloud** — management rights and commercial
6. **HiRUM** — holiday letting legacy base

### Manual Entry Fallback

Agencies without a supported PMS use the full manual entry UI. No functionality is reduced — the adapter layer simply auto-creates records that would otherwise be entered by hand.

---

## 17. Implementation Notes

- Monetary values stored as integers (cents) throughout — no floating point arithmetic anywhere near money
- All timestamps stored as UTC; displayed in AEST/AEDT per user's locale
- Prisma middleware intercepts every write to append audit log entry — business logic cannot bypass it
- DB-level trigger on `audit_log` table prevents any UPDATE or DELETE (belt and braces alongside Prisma enforcement)
- tRPC procedures use Zod for input validation — amounts must be positive, dates must be valid, required fields enforced
- PDF generation runs server-side — no client-side PDF libraries
