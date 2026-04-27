# Trust Accounting Module — Plan 1: Foundation + Core Trust Accounting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a new Next.js SaaS app with a complete Prisma schema, three-role auth, and a fully compliant trust receipt + disbursement + owner ledger system enforced at the tRPC layer.

**Architecture:** Next.js 14 App Router with tRPC v11 for type-safe API calls. Prisma 5 on Neon (serverless PostgreSQL) for the database. Clerk for multi-role auth. All monetary values stored as integers (cents). Every write auto-appends an immutable audit log entry via Prisma middleware, backed by a DB-level trigger.

**Tech Stack:** Next.js 14, tRPC v11, Prisma 5, Neon PostgreSQL, Clerk, shadcn/ui, Tailwind CSS, Zod, Vitest

---

## Plan Split

This project is delivered across three plans:
- **Plan 1 (this file):** Foundation + Core Trust Accounting
- **Plan 2:** Reconciliation + Reports + Compliance
- **Plan 3:** Advanced Features + PMS Integration + Seed Data

---

## File Map

```
trust-accounting/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── middleware.ts                  # Clerk route protection
│   │   ├── (auth)/
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                # Sidebar + header shell
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── receipts/page.tsx
│   │   │   ├── receipts/new/page.tsx
│   │   │   ├── disbursements/page.tsx
│   │   │   ├── disbursements/new/page.tsx
│   │   │   ├── owners/page.tsx
│   │   │   ├── owners/[id]/page.tsx      # Owner + ledger detail
│   │   │   └── properties/page.tsx
│   │   └── api/
│   │       └── trpc/[trpc]/route.ts      # tRPC HTTP handler
│   ├── server/
│   │   ├── db.ts                         # Prisma client singleton
│   │   ├── trpc.ts                       # tRPC init, context, procedures
│   │   ├── audit.ts                      # Prisma audit middleware
│   │   └── routers/
│   │       ├── _app.ts                   # Root router
│   │       ├── properties.ts
│   │       ├── owners.ts
│   │       ├── receipts.ts
│   │       ├── disbursements.ts
│   │       └── ledger.ts
│   ├── lib/
│   │   ├── money.ts                      # Cents arithmetic + formatting
│   │   ├── gst.ts                        # GST inclusive/exclusive/exempt
│   │   └── receipt-number.ts             # Sequential receipt numbering
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── header.tsx
│   │   ├── receipts/
│   │   │   ├── receipt-list.tsx
│   │   │   └── receipt-form.tsx
│   │   ├── disbursements/
│   │   │   ├── disbursement-list.tsx
│   │   │   └── disbursement-form.tsx
│   │   └── owners/
│   │       ├── owner-list.tsx
│   │       └── owner-ledger.tsx
│   └── trpc/
│       ├── client.tsx                    # tRPC React provider + client
│       └── server.ts                     # Server-side caller
└── src/__tests__/
    ├── lib/
    │   ├── money.test.ts
    │   ├── gst.test.ts
    │   └── receipt-number.test.ts
    └── server/routers/
        ├── receipts.test.ts
        ├── disbursements.test.ts
        └── ledger.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `trust-accounting/` (new repo, separate from any other project)
- Create: `package.json`, `tsconfig.json`, `.env.local`, `.gitignore`

- [ ] **Step 1: Create the Next.js app**

```bash
cd ~
pnpm create next-app@latest trust-accounting \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --no-turbopack
cd trust-accounting
```

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add @trpc/server@11 @trpc/client@11 @trpc/react-query@11 \
  @trpc/next@11 @tanstack/react-query@5 \
  @prisma/client prisma \
  @clerk/nextjs \
  zod \
  superjson
pnpm add -D vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/jest-dom \
  @types/node vite-tsconfig-paths
```

- [ ] **Step 3: Install shadcn/ui**

```bash
pnpm dlx shadcn@latest init
# Choose: Default style, Slate base colour, CSS variables yes
pnpm dlx shadcn@latest add button input label select table card badge form
```

- [ ] **Step 4: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
# Neon — create a project at neon.tech and paste the connection string
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."

# Clerk — create an app at clerk.com and paste keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
EOF
```

- [ ] **Step 5: Create `.gitignore` additions**

```bash
echo ".env.local" >> .gitignore
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

Create `src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 7: Initialise git and make first commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js trust accounting project"
```

---

## Task 2: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialise Prisma**

```bash
pnpm dlx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write the full schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}

// ─── Agency ───────────────────────────────────────────────────────────────────

model Agency {
  id                    String   @id @default(cuid())
  name                  String
  licenceNumber         String?
  gstRegistered         Boolean  @default(false)
  apcaUserId            String?
  revenueRecognition    RevenueRecognition @default(CHECK_IN)
  pooledArrangementName String?
  pooledArrangementDate DateTime?
  pooledArrangementRef  String?
  createdAt             DateTime @default(now())

  trustAccounts TrustAccount[]
  properties    Property[]
  owners        Owner[]
}

// ─── Trust Account ────────────────────────────────────────────────────────────

model TrustAccount {
  id            String   @id @default(cuid())
  agencyId      String
  bankName      String
  bsb           String
  accountNumber String
  accountName   String
  createdAt     DateTime @default(now())

  agency        Agency         @relation(fields: [agencyId], references: [id])
  receipts      TrustReceipt[]
  disbursements Disbursement[]
}

// ─── Properties & People ──────────────────────────────────────────────────────

model Property {
  id                 String              @id @default(cuid())
  agencyId           String
  address            String
  type               PropertyType
  status             PropertyStatus      @default(ACTIVE)
  revenueRecognition RevenueRecognition?
  ownerId            String
  createdAt          DateTime            @default(now())

  agency            Agency              @relation(fields: [agencyId], references: [id])
  owner             Owner               @relation(fields: [ownerId], references: [id])
  tenants           Tenant[]
  bookings          Booking[]
  receipts          TrustReceipt[]
  disbursements     Disbursement[]
  ledgerEntries     OwnerLedgerEntry[]
  developerGuarantee DeveloperGuarantee?
}

model Owner {
  id                String   @id @default(cuid())
  agencyId          String
  name              String
  email             String?
  phone             String?
  abn               String?
  bankBsb           String?
  bankAccountNumber String?
  bankAccountName   String?
  gstRegistered     Boolean  @default(false)
  createdAt         DateTime @default(now())

  agency        Agency             @relation(fields: [agencyId], references: [id])
  properties    Property[]
  disbursements Disbursement[]
  ledgerEntries OwnerLedgerEntry[]
  advances      OwnerAdvance[]
}

model Tenant {
  id         String       @id @default(cuid())
  propertyId String
  name       String
  email      String?
  phone      String?
  leaseStart DateTime
  leaseEnd   DateTime?
  weeklyRent Int
  bondAmount Int          @default(0)
  status     TenantStatus @default(ACTIVE)
  createdAt  DateTime     @default(now())

  property Property       @relation(fields: [propertyId], references: [id])
  receipts TrustReceipt[]
}

model Booking {
  id                 String        @id @default(cuid())
  propertyId         String
  guestName          String
  guestEmail         String?
  guestPhone         String?
  checkIn            DateTime
  checkOut           DateTime
  nightlyRate        Int
  cleaningFee        Int           @default(0)
  platformCommission Int           @default(0)
  platform           BookingPlatform @default(DIRECT)
  status             BookingStatus @default(CONFIRMED)
  createdAt          DateTime      @default(now())

  property Property       @relation(fields: [propertyId], references: [id])
  receipts TrustReceipt[]
}

// ─── Trust Receipts ───────────────────────────────────────────────────────────

model TrustReceipt {
  id              String            @id @default(cuid())
  trustAccountId  String
  receiptNumber   Int
  date            DateTime
  amount          Int
  gstAmount       Int               @default(0)
  gstTreatment    GstTreatment      @default(EXEMPT)
  payerName       String
  propertyId      String?
  tenantId        String?
  bookingId       String?
  type            ReceiptType
  accountType     AccountType       @default(TRUST)
  recognitionDate DateTime
  status          ReceiptStatus     @default(PENDING_CLEARANCE)
  inTransit       Boolean           @default(true)
  reversedById    String?           @unique
  notes           String?
  createdAt       DateTime          @default(now())
  createdBy       String

  trustAccount    TrustAccount      @relation(fields: [trustAccountId], references: [id])
  property        Property?         @relation(fields: [propertyId], references: [id])
  tenant          Tenant?           @relation(fields: [tenantId], references: [id])
  booking         Booking?          @relation(fields: [bookingId], references: [id])
  reversedBy      TrustReceipt?     @relation("Reversal", fields: [reversedById], references: [id])
  reversalOf      TrustReceipt?     @relation("Reversal")
  ledgerEntries   OwnerLedgerEntry[]

  @@unique([trustAccountId, receiptNumber])
}

// ─── Disbursements ────────────────────────────────────────────────────────────

model Disbursement {
  id             String              @id @default(cuid())
  trustAccountId String
  referenceNumber Int
  date           DateTime
  amount         Int
  gstAmount      Int                 @default(0)
  gstTreatment   GstTreatment        @default(EXEMPT)
  payeeName      String
  propertyId     String?
  ownerId        String?
  type           DisbursementType
  accountType    AccountType         @default(TRUST)
  status         DisbursementStatus  @default(PENDING_EFT)
  abaFileId      String?
  inTransit      Boolean             @default(true)
  authorisedBy   String
  notes          String?
  createdAt      DateTime            @default(now())
  createdBy      String

  trustAccount  TrustAccount       @relation(fields: [trustAccountId], references: [id])
  property      Property?          @relation(fields: [propertyId], references: [id])
  owner         Owner?             @relation(fields: [ownerId], references: [id])
  ledgerEntries OwnerLedgerEntry[]
}

// ─── Owner Ledger ─────────────────────────────────────────────────────────────

model OwnerLedgerEntry {
  id             String           @id @default(cuid())
  ownerId        String
  propertyId     String
  date           DateTime
  description    String
  debit          Int              @default(0)
  credit         Int              @default(0)
  runningBalance Int
  entryType      LedgerEntryType
  receiptId      String?
  disbursementId String?
  createdAt      DateTime         @default(now())

  owner        Owner         @relation(fields: [ownerId], references: [id])
  property     Property      @relation(fields: [propertyId], references: [id])
  receipt      TrustReceipt? @relation(fields: [receiptId], references: [id])
  disbursement Disbursement? @relation(fields: [disbursementId], references: [id])
}

model OwnerAdvance {
  id                String        @id @default(cuid())
  ownerId           String
  propertyId        String
  amount            Int
  outstandingAmount Int
  date              DateTime
  reason            String
  status            AdvanceStatus @default(OUTSTANDING)
  alertAfterDays    Int           @default(30)
  createdAt         DateTime      @default(now())

  owner Owner @relation(fields: [ownerId], references: [id])
}

// ─── Developer Guarantee ──────────────────────────────────────────────────────

model DeveloperGuarantee {
  id                  String   @id @default(cuid())
  propertyId          String   @unique
  guarantorName       String
  guaranteedAmount    Int
  periodType          String   @default("MONTHLY")
  startDate           DateTime
  endDate             DateTime
  createdAt           DateTime @default(now())

  property Property @relation(fields: [propertyId], references: [id])
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  timestamp  DateTime @default(now())
  userId     String
  userRole   String
  action     AuditAction
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  reason     String?
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum PropertyType {
  RESIDENTIAL
  SHORT_STAY
}

enum PropertyStatus {
  ACTIVE
  INACTIVE
}

enum RevenueRecognition {
  CHECK_IN
  CHECK_OUT
}

enum TenantStatus {
  ACTIVE
  VACATED
}

enum BookingPlatform {
  DIRECT
  AIRBNB
  STAYZ
  BOOKING_COM
  OTHER
}

enum BookingStatus {
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
}

enum ReceiptType {
  RENT
  BOND
  BOOKING_PAYMENT
  CLEANING_FEE
  SECURITY_DEPOSIT
  DEVELOPER_GUARANTEE_TOP_UP
  OTHER
}

enum DisbursementType {
  OWNER_PAYMENT
  MAINTENANCE
  MANAGEMENT_FEE_DRAW
  CLEANING_COST
  PLATFORM_COMMISSION
  TRANSFER_TO_GENERAL
  OWNER_ADVANCE
  TRUST_ACCOUNT_LOAN
  OTHER
}

enum AccountType {
  TRUST
  GENERAL
}

enum GstTreatment {
  INCLUSIVE
  EXCLUSIVE
  EXEMPT
}

enum ReceiptStatus {
  PENDING_CLEARANCE
  CLEARED
  REVERSED
}

enum DisbursementStatus {
  PENDING_EFT
  IN_ABA_FILE
  PROCESSED
  REVERSED
}

enum LedgerEntryType {
  RECEIPT
  DISBURSEMENT
  ADVANCE
  ADVANCE_RECOVERY
  MANAGEMENT_FEE
  DEVELOPER_GUARANTEE
  POOL_DISTRIBUTION
}

enum AdvanceStatus {
  OUTSTANDING
  PARTIALLY_RECOVERED
  RECOVERED
}

enum AuditAction {
  RECEIPT_CREATED
  RECEIPT_REVERSED
  DISBURSEMENT_MADE
  DISBURSEMENT_REVERSED
  RECONCILIATION_LOCKED
  RECONCILIATION_UNLOCKED
  PERIOD_MODIFIED
  ABA_GENERATED
  OWNER_ADVANCE_CREATED
  SETTINGS_CHANGED
  USER_CREATED
  USER_ROLE_CHANGED
  PROPERTY_CREATED
  OWNER_CREATED
}
```

- [ ] **Step 3: Run migration**

```bash
pnpm dlx prisma migrate dev --name init
```

Expected: Migration created and applied. Prisma Client generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add complete Prisma schema"
```

---

## Task 3: Money, GST, and Receipt Number Utilities

**Files:**
- Create: `src/lib/money.ts`
- Create: `src/lib/gst.ts`
- Create: `src/lib/receipt-number.ts`
- Create: `src/__tests__/lib/money.test.ts`
- Create: `src/__tests__/lib/gst.test.ts`
- Create: `src/__tests__/lib/receipt-number.test.ts`

- [ ] **Step 1: Write money utility tests**

Create `src/__tests__/lib/money.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toCents, fromCents, formatCurrency, addMoney, subtractMoney } from '@/lib/money'

describe('money utilities', () => {
  it('converts dollars to cents', () => {
    expect(toCents(100.50)).toBe(10050)
    expect(toCents(0)).toBe(0)
    expect(toCents(1234.99)).toBe(123499)
  })

  it('converts cents to dollars', () => {
    expect(fromCents(10050)).toBe(100.50)
    expect(fromCents(0)).toBe(0)
  })

  it('formats cents as currency string', () => {
    expect(formatCurrency(10050)).toBe('$100.50')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(100)).toBe('$1.00')
  })

  it('adds money in cents without float errors', () => {
    expect(addMoney(10, 20)).toBe(30)
    expect(addMoney(1, 2)).toBe(3)
  })

  it('subtracts money in cents without float errors', () => {
    expect(subtractMoney(100, 30)).toBe(70)
    expect(subtractMoney(0, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/lib/money.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/money'`

- [ ] **Step 3: Implement money utilities**

Create `src/lib/money.ts`:

```typescript
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100)
}

export function addMoney(a: number, b: number): number {
  return a + b
}

export function subtractMoney(a: number, b: number): number {
  return a - b
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/lib/money.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Write GST utility tests**

Create `src/__tests__/lib/gst.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateGst } from '@/lib/gst'

describe('GST calculations', () => {
  it('returns zero GST for EXEMPT transactions', () => {
    const result = calculateGst(10000, 'EXEMPT')
    expect(result.gstAmount).toBe(0)
    expect(result.netAmount).toBe(10000)
    expect(result.grossAmount).toBe(10000)
  })

  it('splits GST from inclusive amount', () => {
    // $110 inclusive = $100 net + $10 GST
    const result = calculateGst(11000, 'INCLUSIVE')
    expect(result.gstAmount).toBe(1000)
    expect(result.netAmount).toBe(10000)
    expect(result.grossAmount).toBe(11000)
  })

  it('adds GST to exclusive amount', () => {
    // $100 exclusive = $100 net + $10 GST = $110 gross
    const result = calculateGst(10000, 'EXCLUSIVE')
    expect(result.gstAmount).toBe(1000)
    expect(result.netAmount).toBe(10000)
    expect(result.grossAmount).toBe(11000)
  })

  it('rounds GST to nearest cent', () => {
    // $33 inclusive: GST = 33/11 = $3.00 exactly
    const result = calculateGst(3300, 'INCLUSIVE')
    expect(result.gstAmount).toBe(300)
    expect(result.netAmount).toBe(3000)
  })
})
```

- [ ] **Step 6: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/lib/gst.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/gst'`

- [ ] **Step 7: Implement GST utilities**

Create `src/lib/gst.ts`:

```typescript
import type { GstTreatment } from '@prisma/client'

interface GstResult {
  netAmount: number
  gstAmount: number
  grossAmount: number
}

export function calculateGst(amount: number, treatment: GstTreatment): GstResult {
  if (treatment === 'EXEMPT') {
    return { netAmount: amount, gstAmount: 0, grossAmount: amount }
  }

  if (treatment === 'INCLUSIVE') {
    const gstAmount = Math.round(amount / 11)
    const netAmount = amount - gstAmount
    return { netAmount, gstAmount, grossAmount: amount }
  }

  // EXCLUSIVE — amount is net, add GST on top
  const gstAmount = Math.round(amount * 0.1)
  const grossAmount = amount + gstAmount
  return { netAmount: amount, gstAmount, grossAmount }
}
```

- [ ] **Step 8: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/lib/gst.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 9: Write receipt number tests**

Create `src/__tests__/lib/receipt-number.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNextReceiptNumber } from '@/lib/receipt-number'
import { prisma } from '@/server/db'

vi.mock('@/server/db', () => ({
  prisma: {
    trustReceipt: {
      findFirst: vi.fn(),
    },
  },
}))

describe('receipt number generation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 1 when no receipts exist', async () => {
    vi.mocked(prisma.trustReceipt.findFirst).mockResolvedValue(null)
    const next = await getNextReceiptNumber('account-1')
    expect(next).toBe(1)
  })

  it('returns max + 1 when receipts exist', async () => {
    vi.mocked(prisma.trustReceipt.findFirst).mockResolvedValue({
      receiptNumber: 42,
    } as any)
    const next = await getNextReceiptNumber('account-1')
    expect(next).toBe(43)
  })
})
```

- [ ] **Step 10: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/lib/receipt-number.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/receipt-number'`

- [ ] **Step 11: Implement receipt number utility**

Create `src/lib/receipt-number.ts`:

```typescript
import { prisma } from '@/server/db'

export async function getNextReceiptNumber(trustAccountId: string): Promise<number> {
  const latest = await prisma.trustReceipt.findFirst({
    where: { trustAccountId },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  })
  return (latest?.receiptNumber ?? 0) + 1
}
```

- [ ] **Step 12: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/lib/receipt-number.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 13: Commit**

```bash
git add src/lib/ src/__tests__/lib/
git commit -m "feat: add money, GST, and receipt number utilities with tests"
```

---

## Task 4: Prisma Client + Audit Middleware

**Files:**
- Create: `src/server/db.ts`
- Create: `src/server/audit.ts`

- [ ] **Step 1: Create Prisma client singleton**

Create `src/server/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Create audit middleware**

Create `src/server/audit.ts`:

```typescript
import { Prisma } from '@prisma/client'
import type { AuditAction } from '@prisma/client'
import { prisma } from './db'

const WRITE_ACTIONS: Prisma.PrismaAction[] = ['create', 'update', 'delete', 'upsert']

const MODEL_TO_ACTION: Partial<Record<string, AuditAction>> = {
  TrustReceipt: 'RECEIPT_CREATED',
  Disbursement: 'DISBURSEMENT_MADE',
  Property: 'PROPERTY_CREATED',
  Owner: 'OWNER_CREATED',
}

export function createAuditMiddleware(
  getUserContext: () => { userId: string; role: string } | null
): Prisma.Middleware {
  return async (params, next) => {
    // Never intercept AuditLog writes — prevents infinite loop
    if (params.model === 'AuditLog') return next(params)
    if (!WRITE_ACTIONS.includes(params.action)) return next(params)

    const before = params.action !== 'create'
      ? await (prisma as any)[params.model!.charAt(0).toLowerCase() + params.model!.slice(1)]
          .findUnique({ where: params.args.where }).catch(() => null)
      : null

    const result = await next(params)

    const userCtx = getUserContext()
    if (!userCtx) return result

    const action = MODEL_TO_ACTION[params.model ?? '']
    if (!action) return result

    await prisma.auditLog.create({
      data: {
        userId: userCtx.userId,
        userRole: userCtx.role,
        action,
        entityType: params.model ?? 'Unknown',
        entityId: result?.id ?? params.args?.where?.id ?? '',
        before: before ?? undefined,
        after: result ?? undefined,
      },
    })

    return result
  }
}
```

- [ ] **Step 3: Add DB-level immutability trigger via migration**

```bash
pnpm dlx prisma migrate dev --name add_audit_log_immutability
```

Then edit the generated migration SQL file to add at the end:

```sql
-- Prevent any UPDATE or DELETE on audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

Apply it:

```bash
pnpm dlx prisma migrate deploy
```

- [ ] **Step 4: Commit**

```bash
git add src/server/db.ts src/server/audit.ts prisma/migrations/
git commit -m "feat: Prisma client singleton + immutable audit log middleware and DB trigger"
```

---

## Task 5: tRPC Setup

**Files:**
- Create: `src/server/trpc.ts`
- Create: `src/server/routers/_app.ts`
- Create: `src/app/api/trpc/[trpc]/route.ts`
- Create: `src/trpc/client.tsx`
- Create: `src/trpc/server.ts`

- [ ] **Step 1: Create tRPC server init**

Create `src/server/trpc.ts`:

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { prisma } from './db'

export async function createTRPCContext(opts: { headers: Headers }) {
  const { userId } = auth()
  const user = userId ? await currentUser() : null
  const role = (user?.publicMetadata?.role as string) ?? null

  return { prisma, userId, role, headers: opts.headers }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: ctx.userId, role: ctx.role! } })
})

const enforcePropertyManager = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  if (!['propertyManager', 'superAdmin'].includes(ctx.role ?? '')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Property manager access required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, role: ctx.role! } })
})

const enforceSuperAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  if (ctx.role !== 'superAdmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super admin access required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, role: ctx.role! } })
})

export const authedProcedure = t.procedure.use(enforceAuth)
export const managerProcedure = t.procedure.use(enforcePropertyManager)
export const adminProcedure = t.procedure.use(enforceSuperAdmin)
```

- [ ] **Step 2: Create root router**

Create `src/server/routers/_app.ts`:

```typescript
import { createTRPCRouter } from '@/server/trpc'
import { propertiesRouter } from './properties'
import { ownersRouter } from './owners'
import { receiptsRouter } from './receipts'
import { disbursementsRouter } from './disbursements'
import { ledgerRouter } from './ledger'

export const appRouter = createTRPCRouter({
  properties: propertiesRouter,
  owners: ownersRouter,
  receipts: receiptsRouter,
  disbursements: disbursementsRouter,
  ledger: ledgerRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Create tRPC HTTP handler**

Create `src/app/api/trpc/[trpc]/route.ts`:

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  })

export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create tRPC client**

Create `src/trpc/client.tsx`:

```typescript
'use client'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()
```

Create `src/trpc/server.ts`:

```typescript
import { createTRPCProxyClient, loggerLink, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@/server/routers/_app'

export const api = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({ enabled: () => false }),
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/trpc`,
      transformer: superjson,
    }),
  ],
})
```

- [ ] **Step 5: Commit**

```bash
git add src/server/trpc.ts src/server/routers/_app.ts \
  src/app/api/ src/trpc/
git commit -m "feat: tRPC setup with auth middleware and three roles"
```

---

## Task 6: Properties and Owners Routers

**Files:**
- Create: `src/server/routers/properties.ts`
- Create: `src/server/routers/owners.ts`

- [ ] **Step 1: Create properties router**

Create `src/server/routers/properties.ts`:

```typescript
import { z } from 'zod'
import { createTRPCRouter, managerProcedure, authedProcedure } from '@/server/trpc'

const AGENCY_ID = 'agency-demo' // single-agency PoC — replaced in multi-tenant phase

export const propertiesRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.prisma.property.findMany({
      where: { agencyId: AGENCY_ID },
      include: { owner: true, tenants: { where: { status: 'ACTIVE' } } },
      orderBy: { address: 'asc' },
    })
  ),

  create: managerProcedure
    .input(
      z.object({
        address: z.string().min(1),
        type: z.enum(['RESIDENTIAL', 'SHORT_STAY']),
        ownerId: z.string(),
        revenueRecognition: z.enum(['CHECK_IN', 'CHECK_OUT']).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.property.create({
        data: { ...input, agencyId: AGENCY_ID },
      })
    ),

  byId: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.property.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          owner: true,
          tenants: true,
          bookings: { orderBy: { checkIn: 'desc' }, take: 20 },
        },
      })
    ),
})
```

- [ ] **Step 2: Create owners router**

Create `src/server/routers/owners.ts`:

```typescript
import { z } from 'zod'
import { createTRPCRouter, managerProcedure, authedProcedure } from '@/server/trpc'

const AGENCY_ID = 'agency-demo'

export const ownersRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.prisma.owner.findMany({
      where: { agencyId: AGENCY_ID },
      include: { properties: true },
      orderBy: { name: 'asc' },
    })
  ),

  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        abn: z.string().optional(),
        bankBsb: z.string().optional(),
        bankAccountNumber: z.string().optional(),
        bankAccountName: z.string().optional(),
        gstRegistered: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.owner.create({
        data: { ...input, agencyId: AGENCY_ID },
      })
    ),

  byId: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.owner.findUniqueOrThrow({
        where: { id: input.id },
        include: { properties: true },
      })
    ),
})
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/properties.ts src/server/routers/owners.ts
git commit -m "feat: properties and owners tRPC routers"
```

---

## Task 7: Trust Receipts Router

**Files:**
- Create: `src/server/routers/receipts.ts`
- Create: `src/__tests__/server/routers/receipts.test.ts`

- [ ] **Step 1: Write receipt router tests**

Create `src/__tests__/server/routers/receipts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '@trpc/server'
import { receiptsRouter } from '@/server/routers/receipts'
import { prisma } from '@/server/db'

vi.mock('@/server/db', () => ({
  prisma: {
    trustReceipt: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    ownerLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    property: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/receipt-number', () => ({
  getNextReceiptNumber: vi.fn().mockResolvedValue(1),
}))

const createCaller = createCallerFactory(receiptsRouter)
const ctx = {
  prisma,
  userId: 'user-1',
  role: 'propertyManager',
  headers: new Headers(),
}

describe('receipts router', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a receipt with sequential number and audit log', async () => {
    const mockReceipt = {
      id: 'receipt-1',
      receiptNumber: 1,
      trustAccountId: 'ta-1',
      amount: 150000,
      gstAmount: 0,
      recognitionDate: new Date(),
      propertyId: 'prop-1',
      ownerId: 'owner-1',
    }
    vi.mocked(prisma.trustReceipt.create).mockResolvedValue(mockReceipt as any)
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      ownerId: 'owner-1',
      type: 'RESIDENTIAL',
    } as any)
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.ownerLedgerEntry.create).mockResolvedValue({} as any)

    const caller = createCaller(ctx)
    const result = await caller.create({
      trustAccountId: 'ta-1',
      date: new Date(),
      amount: 150000,
      payerName: 'Jane Smith',
      propertyId: 'prop-1',
      type: 'RENT',
      gstTreatment: 'EXEMPT',
    })

    expect(prisma.trustReceipt.create).toHaveBeenCalledOnce()
    expect(result.receiptNumber).toBe(1)
  })

  it('creates a ledger entry for the owner when receipt is posted', async () => {
    const mockReceipt = {
      id: 'receipt-1',
      receiptNumber: 2,
      trustAccountId: 'ta-1',
      amount: 200000,
      gstAmount: 0,
      recognitionDate: new Date(),
      propertyId: 'prop-1',
      ownerId: 'owner-1',
    }
    vi.mocked(prisma.trustReceipt.create).mockResolvedValue(mockReceipt as any)
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      ownerId: 'owner-1',
      type: 'RESIDENTIAL',
    } as any)
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.ownerLedgerEntry.create).mockResolvedValue({} as any)

    const caller = createCaller(ctx)
    await caller.create({
      trustAccountId: 'ta-1',
      date: new Date(),
      amount: 200000,
      payerName: 'John Doe',
      propertyId: 'prop-1',
      type: 'RENT',
      gstTreatment: 'EXEMPT',
    })

    expect(prisma.ownerLedgerEntry.create).toHaveBeenCalledOnce()
    const call = vi.mocked(prisma.ownerLedgerEntry.create).mock.calls[0][0]
    expect(call.data.credit).toBe(200000)
    expect(call.data.entryType).toBe('RECEIPT')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/server/routers/receipts.test.ts
```

Expected: FAIL — `Cannot find module '@/server/routers/receipts'`

- [ ] **Step 3: Implement receipts router**

Create `src/server/routers/receipts.ts`:

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, managerProcedure, authedProcedure } from '@/server/trpc'
import { calculateGst } from '@/lib/gst'
import { getNextReceiptNumber } from '@/lib/receipt-number'

export const receiptsRouter = createTRPCRouter({
  list: authedProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.prisma.trustReceipt.findMany({
        where: {
          trustAccountId: input.trustAccountId,
          ...(input.from || input.to
            ? { date: { gte: input.from, lte: input.to } }
            : {}),
        },
        include: { property: true },
        orderBy: { receiptNumber: 'desc' },
      })
    ),

  create: managerProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        date: z.date(),
        amount: z.number().int().positive(),
        payerName: z.string().min(1),
        propertyId: z.string().optional(),
        tenantId: z.string().optional(),
        bookingId: z.string().optional(),
        type: z.enum([
          'RENT', 'BOND', 'BOOKING_PAYMENT', 'CLEANING_FEE',
          'SECURITY_DEPOSIT', 'DEVELOPER_GUARANTEE_TOP_UP', 'OTHER',
        ]),
        accountType: z.enum(['TRUST', 'GENERAL']).default('TRUST'),
        gstTreatment: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT']).default('EXEMPT'),
        notes: z.string().optional(),
        recognitionDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const receiptNumber = await getNextReceiptNumber(input.trustAccountId)
      const { gstAmount } = calculateGst(input.amount, input.gstTreatment)

      // Determine recognition date
      let recognitionDate = input.recognitionDate ?? input.date
      if (input.bookingId && !input.recognitionDate) {
        const booking = await ctx.prisma.booking.findUnique({
          where: { id: input.bookingId },
          include: { property: true },
        })
        if (booking) {
          const recognition =
            booking.property.revenueRecognition ?? 'CHECK_IN'
          recognitionDate =
            recognition === 'CHECK_IN' ? booking.checkIn : booking.checkOut
        }
      }

      const receipt = await ctx.prisma.trustReceipt.create({
        data: {
          ...input,
          receiptNumber,
          gstAmount,
          recognitionDate,
          createdBy: ctx.userId,
          status: 'PENDING_CLEARANCE',
          inTransit: true,
        },
      })

      // Auto-create owner ledger entry
      if (input.propertyId) {
        const property = await ctx.prisma.property.findUnique({
          where: { id: input.propertyId },
          select: { ownerId: true },
        })
        if (property) {
          const lastEntry = await ctx.prisma.ownerLedgerEntry.findFirst({
            where: { ownerId: property.ownerId, propertyId: input.propertyId },
            orderBy: { date: 'desc' },
            select: { runningBalance: true },
          })
          const runningBalance = (lastEntry?.runningBalance ?? 0) + input.amount

          await ctx.prisma.ownerLedgerEntry.create({
            data: {
              ownerId: property.ownerId,
              propertyId: input.propertyId,
              date: recognitionDate,
              description: `${input.type} — Receipt #${receiptNumber}`,
              credit: input.amount,
              runningBalance,
              entryType: 'RECEIPT',
              receiptId: receipt.id,
            },
          })
        }
      }

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          userRole: ctx.role,
          action: 'RECEIPT_CREATED',
          entityType: 'TrustReceipt',
          entityId: receipt.id,
          after: receipt as any,
        },
      })

      return receipt
    }),

  reverse: managerProcedure
    .input(
      z.object({
        receiptId: z.string(),
        reason: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.trustReceipt.findUniqueOrThrow({
        where: { id: input.receiptId },
      })

      if (original.status === 'REVERSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Receipt has already been reversed',
        })
      }

      const receiptNumber = await getNextReceiptNumber(original.trustAccountId)

      const reversal = await ctx.prisma.trustReceipt.create({
        data: {
          trustAccountId: original.trustAccountId,
          receiptNumber,
          date: new Date(),
          amount: -original.amount,
          gstAmount: -original.gstAmount,
          gstTreatment: original.gstTreatment,
          payerName: original.payerName,
          propertyId: original.propertyId,
          tenantId: original.tenantId,
          bookingId: original.bookingId,
          type: original.type,
          accountType: original.accountType,
          recognitionDate: new Date(),
          status: 'REVERSED',
          inTransit: true,
          reversedById: original.id,
          notes: `Reversal of receipt #${original.receiptNumber}: ${input.reason}`,
          createdBy: ctx.userId,
        },
      })

      await ctx.prisma.trustReceipt.update({
        where: { id: original.id },
        data: { status: 'REVERSED' },
      })

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          userRole: ctx.role,
          action: 'RECEIPT_REVERSED',
          entityType: 'TrustReceipt',
          entityId: original.id,
          before: original as any,
          reason: input.reason,
        },
      })

      return reversal
    }),
})
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/server/routers/receipts.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/receipts.ts src/__tests__/server/routers/receipts.test.ts
git commit -m "feat: trust receipts router with sequential numbering, GST, ledger entries"
```

---

## Task 8: Disbursements Router

**Files:**
- Create: `src/server/routers/disbursements.ts`
- Create: `src/__tests__/server/routers/disbursements.test.ts`

- [ ] **Step 1: Write disbursement tests**

Create `src/__tests__/server/routers/disbursements.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory, TRPCError } from '@trpc/server'
import { disbursementsRouter } from '@/server/routers/disbursements'
import { prisma } from '@/server/db'

vi.mock('@/server/db', () => ({
  prisma: {
    disbursement: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    ownerLedgerEntry: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    trustReceipt: { aggregate: vi.fn() },
  },
}))

const createCaller = createCallerFactory(disbursementsRouter)
const ctx = {
  prisma,
  userId: 'user-1',
  role: 'propertyManager',
  headers: new Headers(),
}

describe('disbursements router', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks disbursement when owner ledger balance is insufficient', async () => {
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue({
      runningBalance: 5000, // $50.00
    } as any)

    const caller = createCaller(ctx)
    await expect(
      caller.create({
        trustAccountId: 'ta-1',
        date: new Date(),
        amount: 10000, // $100 — exceeds $50 balance
        payeeName: 'John Owner',
        ownerId: 'owner-1',
        propertyId: 'prop-1',
        type: 'OWNER_PAYMENT',
        gstTreatment: 'EXEMPT',
      })
    ).rejects.toThrow('Insufficient funds')
  })

  it('creates disbursement and debits owner ledger when funds available', async () => {
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue({
      runningBalance: 150000, // $1500
    } as any)
    vi.mocked(prisma.disbursement.create).mockResolvedValue({
      id: 'disb-1',
      referenceNumber: 1,
      amount: 100000,
    } as any)
    vi.mocked(prisma.ownerLedgerEntry.create).mockResolvedValue({} as any)
    vi.mocked(prisma.disbursement.findFirst).mockResolvedValue(null)

    const caller = createCaller(ctx)
    const result = await caller.create({
      trustAccountId: 'ta-1',
      date: new Date(),
      amount: 100000,
      payeeName: 'John Owner',
      ownerId: 'owner-1',
      propertyId: 'prop-1',
      type: 'OWNER_PAYMENT',
      gstTreatment: 'EXEMPT',
    })

    expect(result.amount).toBe(100000)
    expect(prisma.ownerLedgerEntry.create).toHaveBeenCalledOnce()
    const ledgerCall = vi.mocked(prisma.ownerLedgerEntry.create).mock.calls[0][0]
    expect(ledgerCall.data.debit).toBe(100000)
    expect(ledgerCall.data.runningBalance).toBe(50000) // 150000 - 100000
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/server/routers/disbursements.test.ts
```

Expected: FAIL — `Cannot find module '@/server/routers/disbursements'`

- [ ] **Step 3: Implement disbursements router**

Create `src/server/routers/disbursements.ts`:

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, managerProcedure, authedProcedure } from '@/server/trpc'
import { calculateGst } from '@/lib/gst'
import { subtractMoney } from '@/lib/money'

async function getNextReferenceNumber(trustAccountId: string, prisma: any): Promise<number> {
  const latest = await prisma.disbursement.findFirst({
    where: { trustAccountId },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  })
  return (latest?.referenceNumber ?? 0) + 1
}

export const disbursementsRouter = createTRPCRouter({
  list: authedProcedure
    .input(z.object({ trustAccountId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.disbursement.findMany({
        where: { trustAccountId: input.trustAccountId },
        include: { owner: true, property: true },
        orderBy: { date: 'desc' },
      })
    ),

  create: managerProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        date: z.date(),
        amount: z.number().int().positive(),
        payeeName: z.string().min(1),
        propertyId: z.string().optional(),
        ownerId: z.string().optional(),
        type: z.enum([
          'OWNER_PAYMENT', 'MAINTENANCE', 'MANAGEMENT_FEE_DRAW',
          'CLEANING_COST', 'PLATFORM_COMMISSION', 'TRANSFER_TO_GENERAL',
          'OWNER_ADVANCE', 'TRUST_ACCOUNT_LOAN', 'OTHER',
        ]),
        accountType: z.enum(['TRUST', 'GENERAL']).default('TRUST'),
        gstTreatment: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT']).default('EXEMPT'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Overdraft check — enforce per owner and per trust account
      if (input.ownerId && input.propertyId) {
        const lastEntry = await ctx.prisma.ownerLedgerEntry.findFirst({
          where: { ownerId: input.ownerId, propertyId: input.propertyId },
          orderBy: { date: 'desc' },
          select: { runningBalance: true },
        })
        const currentBalance = lastEntry?.runningBalance ?? 0
        if (input.amount > currentBalance) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient funds: owner balance is $${(currentBalance / 100).toFixed(2)}, disbursement requires $${(input.amount / 100).toFixed(2)}`,
          })
        }
      }

      const { gstAmount } = calculateGst(input.amount, input.gstTreatment)
      const referenceNumber = await getNextReferenceNumber(input.trustAccountId, ctx.prisma)

      const disbursement = await ctx.prisma.disbursement.create({
        data: {
          ...input,
          referenceNumber,
          gstAmount,
          authorisedBy: ctx.userId,
          createdBy: ctx.userId,
          status: 'PENDING_EFT',
          inTransit: true,
        },
      })

      // Auto-create owner ledger entry (debit)
      if (input.ownerId && input.propertyId) {
        const lastEntry = await ctx.prisma.ownerLedgerEntry.findFirst({
          where: { ownerId: input.ownerId, propertyId: input.propertyId },
          orderBy: { date: 'desc' },
          select: { runningBalance: true },
        })
        const runningBalance = subtractMoney(lastEntry?.runningBalance ?? 0, input.amount)

        await ctx.prisma.ownerLedgerEntry.create({
          data: {
            ownerId: input.ownerId,
            propertyId: input.propertyId,
            date: input.date,
            description: `${input.type} — Ref #${referenceNumber}`,
            debit: input.amount,
            runningBalance,
            entryType: 'DISBURSEMENT',
            disbursementId: disbursement.id,
          },
        })
      }

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          userRole: ctx.role,
          action: 'DISBURSEMENT_MADE',
          entityType: 'Disbursement',
          entityId: disbursement.id,
          after: disbursement as any,
        },
      })

      return disbursement
    }),
})
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/server/routers/disbursements.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/disbursements.ts src/__tests__/server/routers/disbursements.test.ts
git commit -m "feat: disbursements router with hard overdraft prevention"
```

---

## Task 9: Owner Ledger Router

**Files:**
- Create: `src/server/routers/ledger.ts`
- Create: `src/__tests__/server/routers/ledger.test.ts`

- [ ] **Step 1: Write ledger tests**

Create `src/__tests__/server/routers/ledger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '@trpc/server'
import { ledgerRouter } from '@/server/routers/ledger'
import { prisma } from '@/server/db'

vi.mock('@/server/db', () => ({
  prisma: {
    ownerLedgerEntry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

const createCaller = createCallerFactory(ledgerRouter)
const ctx = {
  prisma,
  userId: 'user-1',
  role: 'propertyManager',
  headers: new Headers(),
}

describe('ledger router', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ledger entries for an owner in date order', async () => {
    const entries = [
      { id: '1', date: new Date('2025-01-15'), credit: 150000, debit: 0, runningBalance: 150000 },
      { id: '2', date: new Date('2025-01-20'), credit: 0, debit: 100000, runningBalance: 50000 },
    ]
    vi.mocked(prisma.ownerLedgerEntry.findMany).mockResolvedValue(entries as any)

    const caller = createCaller(ctx)
    const result = await caller.entriesForOwner({ ownerId: 'owner-1' })

    expect(result).toHaveLength(2)
    expect(result[0].runningBalance).toBe(150000)
  })

  it('returns current balance from latest ledger entry', async () => {
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue({
      runningBalance: 75000,
    } as any)

    const caller = createCaller(ctx)
    const result = await caller.balanceForOwner({ ownerId: 'owner-1' })

    expect(result.balanceCents).toBe(75000)
  })

  it('returns zero balance when owner has no ledger entries', async () => {
    vi.mocked(prisma.ownerLedgerEntry.findFirst).mockResolvedValue(null)

    const caller = createCaller(ctx)
    const result = await caller.balanceForOwner({ ownerId: 'owner-1' })

    expect(result.balanceCents).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:run src/__tests__/server/routers/ledger.test.ts
```

Expected: FAIL — `Cannot find module '@/server/routers/ledger'`

- [ ] **Step 3: Implement ledger router**

Create `src/server/routers/ledger.ts`:

```typescript
import { z } from 'zod'
import { createTRPCRouter, authedProcedure } from '@/server/trpc'

export const ledgerRouter = createTRPCRouter({
  entriesForOwner: authedProcedure
    .input(
      z.object({
        ownerId: z.string(),
        propertyId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.prisma.ownerLedgerEntry.findMany({
        where: {
          ownerId: input.ownerId,
          ...(input.propertyId ? { propertyId: input.propertyId } : {}),
          ...(input.from || input.to
            ? { date: { gte: input.from, lte: input.to } }
            : {}),
        },
        include: {
          receipt: { select: { receiptNumber: true } },
          disbursement: { select: { referenceNumber: true } },
          property: { select: { address: true } },
        },
        orderBy: { date: 'asc' },
      })
    ),

  balanceForOwner: authedProcedure
    .input(z.object({ ownerId: z.string(), propertyId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const latest = await ctx.prisma.ownerLedgerEntry.findFirst({
        where: {
          ownerId: input.ownerId,
          ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        },
        orderBy: { date: 'desc' },
        select: { runningBalance: true },
      })
      return { balanceCents: latest?.runningBalance ?? 0 }
    }),
})
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test:run src/__tests__/server/routers/ledger.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Run full test suite**

```bash
pnpm test:run
```

Expected: PASS — all tests across all files

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/ledger.ts src/__tests__/server/routers/ledger.test.ts
git commit -m "feat: owner ledger router with balance calculation"
```

---

## Task 10: Clerk Auth + Route Protection

**Files:**
- Create: `src/app/middleware.ts`
- Modify: `src/app/layout.tsx`
- Create: `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create Clerk middleware**

Create `src/middleware.ts` (at project root, not in `src/app`):

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Wrap app with Clerk provider**

Update `src/app/layout.tsx`:

```tsx
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trust Accounting',
  description: 'QLD-compliant trust accounting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 3: Create sign-in and sign-up pages**

Create `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

Create `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 4: Set up roles in Clerk dashboard**

In the Clerk dashboard (clerk.com), go to **Configure → Sessions → Customize session token** and add:

```json
{
  "role": "{{user.public_metadata.role}}"
}
```

Then in **Users**, set `publicMetadata.role` to `"propertyManager"`, `"superAdmin"`, or `"auditor"` per user.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/layout.tsx src/app/(auth)/
git commit -m "feat: Clerk auth with route protection and three roles"
```

---

## Task 11: Dashboard Layout + Navigation

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/trpc/client.tsx` (tRPC provider)

- [ ] **Step 1: Create tRPC provider wrapper**

Update `src/trpc/client.tsx`:

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { trpc } from './client'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

- [ ] **Step 2: Create sidebar**

Create `src/components/layout/sidebar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const managerLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/receipts', label: 'Receipts' },
  { href: '/disbursements', label: 'Disbursements' },
  { href: '/owners', label: 'Owners' },
  { href: '/properties', label: 'Properties' },
  { href: '/reconciliation', label: 'Reconciliation' },
  { href: '/reports', label: 'Reports' },
]

const auditorLinks = [
  { href: '/dashboard', label: 'Audit Summary' },
  { href: '/reconciliation', label: 'Reconciliations' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit-trail', label: 'Audit Trail' },
]

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const links = role === 'auditor' ? auditorLinks : managerLinks

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 min-h-screen p-4">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trust Accounting
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === link.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { UserButton } from '@clerk/nextjs'
import { TRPCProvider } from '@/trpc/provider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const role = (user?.publicMetadata?.role as string) ?? 'propertyManager'

  return (
    <TRPCProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-6">
            <span className="text-sm text-muted-foreground capitalize">{role}</span>
            <UserButton afterSignOutUrl="/sign-in" />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </TRPCProvider>
  )
}
```

- [ ] **Step 4: Create placeholder dashboard page**

Create `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-muted-foreground">Trust account overview coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 5: Start dev server and verify login flow works**

```bash
pnpm dev
```

Open `http://localhost:3000` — should redirect to `/sign-in`. Sign in → should land on `/dashboard` with sidebar.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/ src/components/layout/ src/trpc/
git commit -m "feat: dashboard layout with role-aware sidebar and Clerk auth"
```

---

## Task 12: Receipts UI

**Files:**
- Create: `src/app/(dashboard)/receipts/page.tsx`
- Create: `src/app/(dashboard)/receipts/new/page.tsx`
- Create: `src/components/receipts/receipt-list.tsx`
- Create: `src/components/receipts/receipt-form.tsx`

- [ ] **Step 1: Create receipt list component**

Create `src/components/receipts/receipt-list.tsx`:

```tsx
'use client'
import { trpc } from '@/trpc/client'
import { formatCurrency } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

const TRUST_ACCOUNT_ID = 'trust-account-demo' // replaced in multi-tenant phase

export function ReceiptList() {
  const { data: receipts, isLoading } = trpc.receipts.list.useQuery({
    trustAccountId: TRUST_ACCOUNT_ID,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading receipts...</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Payer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {receipts?.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono">{r.receiptNumber}</TableCell>
            <TableCell>{format(new Date(r.date), 'dd/MM/yyyy')}</TableCell>
            <TableCell>{r.payerName}</TableCell>
            <TableCell>{r.type.replace(/_/g, ' ')}</TableCell>
            <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
            <TableCell>
              <Badge variant={r.status === 'CLEARED' ? 'default' : 'secondary'}>
                {r.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
        {receipts?.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No receipts yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create receipt form**

Create `src/components/receipts/receipt-form.tsx`:

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toCents } from '@/lib/money'

const TRUST_ACCOUNT_ID = 'trust-account-demo'

const schema = z.object({
  date: z.string().min(1, 'Date required'),
  amountDollars: z.string().min(1, 'Amount required'),
  payerName: z.string().min(1, 'Payer name required'),
  type: z.enum(['RENT', 'BOND', 'BOOKING_PAYMENT', 'CLEANING_FEE', 'SECURITY_DEPOSIT', 'DEVELOPER_GUARANTEE_TOP_UP', 'OTHER']),
  gstTreatment: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT']),
})

type FormValues = z.infer<typeof schema>

export function ReceiptForm() {
  const router = useRouter()
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'RENT', gstTreatment: 'EXEMPT' },
  })
  const create = trpc.receipts.create.useMutation({
    onSuccess: () => router.push('/receipts'),
  })

  const onSubmit = (values: FormValues) => {
    create.mutate({
      trustAccountId: TRUST_ACCOUNT_ID,
      date: new Date(values.date),
      amount: toCents(parseFloat(values.amountDollars)),
      payerName: values.payerName,
      type: values.type,
      gstTreatment: values.gstTreatment,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register('date')} />
        {errors.date && <p className="text-destructive text-sm">{errors.date.message}</p>}
      </div>
      <div>
        <Label htmlFor="amountDollars">Amount ($)</Label>
        <Input id="amountDollars" type="number" step="0.01" min="0.01" {...register('amountDollars')} />
        {errors.amountDollars && <p className="text-destructive text-sm">{errors.amountDollars.message}</p>}
      </div>
      <div>
        <Label htmlFor="payerName">Payer Name</Label>
        <Input id="payerName" {...register('payerName')} />
        {errors.payerName && <p className="text-destructive text-sm">{errors.payerName.message}</p>}
      </div>
      <div>
        <Label>Type</Label>
        <Select onValueChange={(v) => setValue('type', v as any)} defaultValue="RENT">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="RENT">Rent</SelectItem>
            <SelectItem value="BOND">Bond</SelectItem>
            <SelectItem value="BOOKING_PAYMENT">Booking Payment</SelectItem>
            <SelectItem value="CLEANING_FEE">Cleaning Fee</SelectItem>
            <SelectItem value="SECURITY_DEPOSIT">Security Deposit</SelectItem>
            <SelectItem value="DEVELOPER_GUARANTEE_TOP_UP">Developer Guarantee</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>GST Treatment</Label>
        <Select onValueChange={(v) => setValue('gstTreatment', v as any)} defaultValue="EXEMPT">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="EXEMPT">Exempt (no GST)</SelectItem>
            <SelectItem value="INCLUSIVE">Inclusive (amount includes GST)</SelectItem>
            <SelectItem value="EXCLUSIVE">Exclusive (add GST on top)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {create.error && <p className="text-destructive text-sm">{create.error.message}</p>}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Saving...' : 'Create Receipt'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create receipts pages**

Create `src/app/(dashboard)/receipts/page.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReceiptList } from '@/components/receipts/receipt-list'

export default function ReceiptsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trust Receipts</h1>
        <Link href="/receipts/new">
          <Button>New Receipt</Button>
        </Link>
      </div>
      <ReceiptList />
    </div>
  )
}
```

Create `src/app/(dashboard)/receipts/new/page.tsx`:

```tsx
import { ReceiptForm } from '@/components/receipts/receipt-form'

export default function NewReceiptPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Receipt</h1>
      <ReceiptForm />
    </div>
  )
}
```

- [ ] **Step 4: Install react-hook-form + date-fns**

```bash
pnpm add react-hook-form @hookform/resolvers date-fns
```

- [ ] **Step 5: Test in browser**

With `pnpm dev` running, navigate to `/receipts` — list should load (empty). Navigate to `/receipts/new` — form should render. Fill in and submit — should redirect to list with new receipt.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/receipts/ src/components/receipts/
git commit -m "feat: receipts list and new receipt form UI"
```

---

## Task 13: Disbursements + Owners UI

**Files:**
- Create: `src/app/(dashboard)/disbursements/page.tsx`
- Create: `src/app/(dashboard)/disbursements/new/page.tsx`
- Create: `src/components/disbursements/disbursement-list.tsx`
- Create: `src/components/disbursements/disbursement-form.tsx`
- Create: `src/app/(dashboard)/owners/page.tsx`
- Create: `src/app/(dashboard)/owners/[id]/page.tsx`
- Create: `src/components/owners/owner-list.tsx`
- Create: `src/components/owners/owner-ledger.tsx`

- [ ] **Step 1: Create disbursement list**

Create `src/components/disbursements/disbursement-list.tsx`:

```tsx
'use client'
import { trpc } from '@/trpc/client'
import { formatCurrency } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

const TRUST_ACCOUNT_ID = 'trust-account-demo'

export function DisbursementList() {
  const { data, isLoading } = trpc.disbursements.list.useQuery({ trustAccountId: TRUST_ACCOUNT_ID })

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ref #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Payee</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-mono">{d.referenceNumber}</TableCell>
            <TableCell>{format(new Date(d.date), 'dd/MM/yyyy')}</TableCell>
            <TableCell>{d.payeeName}</TableCell>
            <TableCell>{d.type.replace(/_/g, ' ')}</TableCell>
            <TableCell className="text-right">{formatCurrency(d.amount)}</TableCell>
            <TableCell>
              <Badge variant={d.status === 'PROCESSED' ? 'default' : 'secondary'}>
                {d.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
        {data?.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">No disbursements yet</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create disbursement form**

Create `src/components/disbursements/disbursement-form.tsx`:

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toCents } from '@/lib/money'

const TRUST_ACCOUNT_ID = 'trust-account-demo'

const schema = z.object({
  date: z.string().min(1),
  amountDollars: z.string().min(1),
  payeeName: z.string().min(1),
  type: z.enum(['OWNER_PAYMENT', 'MAINTENANCE', 'MANAGEMENT_FEE_DRAW', 'CLEANING_COST', 'PLATFORM_COMMISSION', 'TRANSFER_TO_GENERAL', 'OWNER_ADVANCE', 'TRUST_ACCOUNT_LOAN', 'OTHER']),
  gstTreatment: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT']),
})
type FormValues = z.infer<typeof schema>

export function DisbursementForm() {
  const router = useRouter()
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'OWNER_PAYMENT', gstTreatment: 'EXEMPT' },
  })
  const create = trpc.disbursements.create.useMutation({
    onSuccess: () => router.push('/disbursements'),
  })

  const onSubmit = (values: FormValues) => {
    create.mutate({
      trustAccountId: TRUST_ACCOUNT_ID,
      date: new Date(values.date),
      amount: toCents(parseFloat(values.amountDollars)),
      payeeName: values.payeeName,
      type: values.type,
      gstTreatment: values.gstTreatment,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div>
        <Label>Date</Label>
        <Input type="date" {...register('date')} />
      </div>
      <div>
        <Label>Amount ($)</Label>
        <Input type="number" step="0.01" min="0.01" {...register('amountDollars')} />
      </div>
      <div>
        <Label>Payee Name</Label>
        <Input {...register('payeeName')} />
      </div>
      <div>
        <Label>Type</Label>
        <Select onValueChange={(v) => setValue('type', v as any)} defaultValue="OWNER_PAYMENT">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER_PAYMENT">Owner Payment</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="MANAGEMENT_FEE_DRAW">Management Fee Draw</SelectItem>
            <SelectItem value="CLEANING_COST">Cleaning Cost</SelectItem>
            <SelectItem value="PLATFORM_COMMISSION">Platform Commission</SelectItem>
            <SelectItem value="TRANSFER_TO_GENERAL">Transfer to General</SelectItem>
            <SelectItem value="OWNER_ADVANCE">Owner Advance</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>GST Treatment</Label>
        <Select onValueChange={(v) => setValue('gstTreatment', v as any)} defaultValue="EXEMPT">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="EXEMPT">Exempt</SelectItem>
            <SelectItem value="INCLUSIVE">Inclusive</SelectItem>
            <SelectItem value="EXCLUSIVE">Exclusive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {create.error && <p className="text-destructive text-sm">{create.error.message}</p>}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Saving...' : 'Create Disbursement'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create disbursement pages**

Create `src/app/(dashboard)/disbursements/page.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DisbursementList } from '@/components/disbursements/disbursement-list'

export default function DisbursementsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Disbursements</h1>
        <Link href="/disbursements/new"><Button>New Disbursement</Button></Link>
      </div>
      <DisbursementList />
    </div>
  )
}
```

Create `src/app/(dashboard)/disbursements/new/page.tsx`:

```tsx
import { DisbursementForm } from '@/components/disbursements/disbursement-form'

export default function NewDisbursementPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Disbursement</h1>
      <DisbursementForm />
    </div>
  )
}
```

- [ ] **Step 4: Create owner ledger component**

Create `src/components/owners/owner-ledger.tsx`:

```tsx
'use client'
import { trpc } from '@/trpc/client'
import { formatCurrency } from '@/lib/money'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

export function OwnerLedger({ ownerId }: { ownerId: string }) {
  const { data: balance } = trpc.ledger.balanceForOwner.useQuery({ ownerId })
  const { data: entries, isLoading } = trpc.ledger.entriesForOwner.useQuery({ ownerId })

  return (
    <div>
      <div className="mb-4 rounded-md border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">Current Balance</p>
        <p className="text-2xl font-bold">
          {balance ? formatCurrency(balance.balanceCents) : '—'}
        </p>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading ledger...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{format(new Date(e.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-right text-destructive">
                  {e.debit > 0 ? formatCurrency(e.debit) : ''}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {e.credit > 0 ? formatCurrency(e.credit) : ''}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(e.runningBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create owner list component and pages**

Create `src/components/owners/owner-list.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { formatCurrency } from '@/lib/money'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function OwnerList() {
  const { data: owners, isLoading } = trpc.owners.list.useQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Properties</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {owners?.map((o) => (
          <TableRow key={o.id}>
            <TableCell>
              <Link href={`/owners/${o.id}`} className="font-medium hover:underline">{o.name}</Link>
            </TableCell>
            <TableCell>{o.properties.length}</TableCell>
            <TableCell className="text-muted-foreground">{o.email ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

Create `src/app/(dashboard)/owners/page.tsx`:

```tsx
import { OwnerList } from '@/components/owners/owner-list'

export default function OwnersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Owners</h1>
      <OwnerList />
    </div>
  )
}
```

Create `src/app/(dashboard)/owners/[id]/page.tsx`:

```tsx
import { OwnerLedger } from '@/components/owners/owner-ledger'

export default function OwnerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Owner Ledger</h1>
      <OwnerLedger ownerId={params.id} />
    </div>
  )
}
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm test:run
```

Expected: PASS — all tests

- [ ] **Step 7: Final commit for Plan 1**

```bash
git add src/app/(dashboard)/disbursements/ src/app/(dashboard)/owners/ \
  src/components/disbursements/ src/components/owners/
git commit -m "feat: disbursements and owners UI — Plan 1 complete"
```

---

## Plan 1 Complete

At this point you have:
- ✓ New Next.js project with full TypeScript, Tailwind, shadcn/ui
- ✓ Complete Prisma schema covering all entities
- ✓ Immutable audit log with DB-level trigger
- ✓ tRPC API with three-role auth enforcement
- ✓ Trust receipts with sequential numbering, GST, auto-ledger entries
- ✓ Disbursements with hard overdraft prevention
- ✓ Owner ledger with running balances
- ✓ Working UI for receipts, disbursements, and owner ledger
- ✓ 12 passing tests

**Next:** Plan 2 — Bank Reconciliation, Reports, ABA Files, Locked Periods
