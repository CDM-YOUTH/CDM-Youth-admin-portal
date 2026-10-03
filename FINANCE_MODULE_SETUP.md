# Finance & Ledger Module — Complete Implementation Guide

## Overview
A centralized financial management system for tracking deanery/parish financial obligations and payments across events, projects, and enrollment subscriptions.

---

## 📊 Database Schema

### Tables Created
1. **`financial_categories`** — Master list of billable items
   - `name` (unique)
   - `type` ∈ {event, project, enrollment}
   - `is_active` (default: true)

2. **`parish_assessments`** — Obligations per parish × category × fiscal year
   - `parish_id` (FK → parishes)
   - `category_id` (FK → financial_categories)
   - `fiscal_year` (integer)
   - `headcount` (nullable, for enrollment: amount = headcount × 100 KES)
   - `amount_due` (numeric)
   - `is_historical_arrears` (boolean, default: false)
   - **Unique constraint:** (parish_id, category_id, fiscal_year)

3. **`parish_payments`** — Incoming payments from parishes
   - `parish_id` (FK → parishes)
   - `amount_paid` (numeric)
   - `payment_method` ∈ {cheque, bank_deposit, cash}
   - `reference_number` (cheque/slip code)
   - `payment_date` (date)
   - `notes` (text, nullable)

4. **`payment_allocations`** — FIFO routing of payments to obligations
   - `payment_id` (FK → parish_payments, ON DELETE CASCADE)
   - `assessment_id` (FK → parish_assessments, ON DELETE CASCADE)
   - `allocated_amount` (numeric)

### RLS Policies
All tables are protected with Row Level Security using the `can_access('finances', action, deanery_id, parish_id, NULL)` function. Users can only view/edit assessments and payments for parishes within their assigned scope (if any).

### Audit Fields
All tables include:
- `created_at`, `updated_at` (with automatic `touch_updated_at()` trigger)
- `created_by`, `updated_by` (FK → auth.users)

### Seeded Categories
The migration auto-inserts default categories:
- Bishop's Visit (event)
- Patronage Day (event)
- Youth Day (event)
- CUSA Mass (event)
- Ball Games (event)
- Kagio Project (project)
- Annual Enrollment Fee (enrollment)

---

## 🚀 Applying the Migrations

**Two migrations need to be applied (in order):**

### Migration 1: Database Schema
**File:** `supabase/migrations/20261003000006_finances_ledger.sql`

#### Option A: Via CLI (with Supabase token)
```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration.mjs supabase/migrations/20261003000006_finances_ledger.sql
```

#### Option B: Manual (Supabase Dashboard)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project → SQL Editor
3. Copy & paste contents of `supabase/migrations/20261003000006_finances_ledger.sql`
4. Execute

### Migration 2: Role Permissions
**File:** `supabase/migrations/20261003000007_finances_role_permissions.sql`

This adds the 'finances' module to all user roles:
- **admin**: Full access (view, create, edit, delete)
- **office**: Full access (view, create, edit, delete)
- **moderator**: Full write access except delete (view, create, edit)
- **user**: View-only access

Apply the same way as Migration 1.

---

## 🔐 Role-Based Access Control

The Finance module respects the existing role permission system:

| Role | View | Create | Edit | Delete | Use Case |
|------|------|--------|------|--------|----------|
| **admin** | ✅ | ✅ | ✅ | ✅ | Full system control |
| **office** | ✅ | ✅ | ✅ | ✅ | Youth office staff |
| **moderator** | ✅ | ✅ | ✅ | ❌ | Power users (no delete) |
| **user** | ✅ | ❌ | ❌ | ❌ | View-only access |

### How It Works
- When a user logs in, their role is read from `user_roles` table
- The `can_access('finances', action, deanery_id, parish_id, NULL)` RLS function checks their permissions
- Unauthorized actions are blocked at the database layer

### Setting User Roles
Navigate to **Admin → User Mgmt** to assign roles to users. Finance module permissions are automatically granted based on role assignment.

---

## 💾 Data Layer API

### Location
`src/lib/db/finances.ts`

### Core Functions

#### Categories
```ts
listFinancialCategories(type?: "event" | "project" | "enrollment")
createFinancialCategory({ name, type })
```

#### Assessments
```ts
listParishAssessmentsPaged({ fiscalYear, deaneryId?, parishId?, page, size })
  → { data: ParishAssessment[], total: number }

createParishAssessment({ parishId, categoryId, fiscalYear, headcount?, amountDue, isHistoricalArrears? })
updateParishAssessment(id, { headcount?, amountDue?, isHistoricalArrears? })
deleteParishAssessment(id)
```

#### Payments
```ts
listParishPaymentsPaged({ parishId?, deaneryId?, page, size })
  → { data: ParishPayment[], total: number }

createParishPayment({
  parishId,
  amountPaid,
  paymentMethod: "cheque" | "bank_deposit" | "cash",
  referenceNumber?,
  paymentDate: "YYYY-MM-DD",
  notes?,
  allocations?: [{ assessmentId, allocatedAmount }, ...]
})
  // Auto-allocates via FIFO if allocations not provided

updateParishPayment(id, { amountPaid?, paymentMethod?, referenceNumber?, paymentDate?, notes? })
deleteParishPayment(id)  // Also deletes related allocations
```

#### Allocations
```ts
listPaymentAllocations(paymentId)
  → PaymentAllocation[]

updatePaymentAllocation(id, allocatedAmount)
deletePaymentAllocation(id)
```

---

## 🎨 UI Components & Routes

### Main Route
**File:** `src/routes/admin.finances.tsx`
**Path:** `/admin/finances`

#### Features
- **4 Tabs:**
  1. **Summary** — Deanery/parish rollup (events, projects, enrollment arrears)
  2. **Events** — Event-specific obligations + fiscal year filter
  3. **Projects** — Project balances (previous debt → allocations → collections → payments → balance)
  4. **Enrollment** — Subscription tracking (headcount × KES 100)

- **Global Controls:**
  - Deanery filter (defaults to user's scope if assigned)
  - Fiscal year filter (2020–present)
  - "Record Payment" button (top-right)

#### Scoping
- **Deanery-first view:** Shows all deaneries by default
- **Drill-down:** Select deanery from dropdown → shows parishes only
- **Access control:** RLS ensures users only see their assigned scope

### Payment Recording Modal
**File:** `src/components/admin/composables/forms/record-payment-dialog.tsx`

#### Features
- **Parish selection** — Autocomplete dropdown
- **Payment method** — Radio group (cheque/deposit/cash)
- **Reference number** — Required for cheque, optional for others
- **Amount & date** — Numeric input + date picker
- **Allocation strategy:**
  - **Auto (FIFO):** Waterfall allocation to oldest arrears first
  - **Manual:** Target a specific obligation
- **Notes** — Optional memo field

#### Validation
- Parish required
- Amount > 0
- Cheque number required if method = cheque
- Manual targeting requires category selection

---

## 🔧 Sidebar Navigation

Added under new "Finance" section:
- **Icon:** Banknote
- **Label:** "Ledger & Payments"
- **Module:** "finances" (for role-based access control)
- **Visibility:** Controlled by `useModuleAccess()` — requires role permission for "finances"

---

## 🎯 Styling & Design

### Color Scheme
- **Danger/Primary:** Red buttons (Record Payment)
- **Accents:** Gold (sidebar active state)
- **Table:** Alternating rows on hover, danger text for arrears

### Layout
- Consistent with Leaders and Youth Records modules
- Topbar with title, tabs, and action button
- Card-based table layout with toolbar
- Tabular numeric data (right-aligned amounts)

### Typography
- Headings: 12px bold eyebrow labels
- Table content: 11px regular text
- Numeric values: 11px monospace (amounts)

---

## 📋 Workflow Example: Record a Payment

1. **User clicks** "Record Payment" button
2. **Modal opens** → User selects parish (e.g., "St. Pius X, Mariira")
3. **Payment details:**
   - Method: Cheque
   - Reference: CHQ-992811
   - Amount: KES 15,000
   - Date: 2026-10-03
4. **Allocation:** Auto FIFO selected (default)
5. **Submit:** System creates:
   - 1 `parish_payments` row (amount_paid = 15,000)
   - N `payment_allocations` rows (oldest historical arrears first, then current obligations)
6. **Success toast** → Modal closes, tables refresh

---

## 🔄 Next Steps (Recommended Enhancements)

### Phase 1: Core Data Aggregation
- [ ] Implement data aggregation for Summary tab
  - Aggregate events arrears per deanery/parish
  - Aggregate project balances
  - Aggregate enrollment arrears
- [ ] Wire up actual query results (currently showing KES 0 placeholders)
- [ ] Test with sample data

### Phase 2: Category Management UI
- [ ] Add/Edit event categories dialog
- [ ] Add/Edit project categories dialog
- [ ] Bulk category import from Excel
- [ ] Soft-delete (archive) categories

### Phase 3: Reporting & Exports
- [ ] Export to XLSX (payment ledger, arrears register)
- [ ] Summary PDF (deanery-level financial snapshot)
- [ ] Google Sheets sync (like events registration)
- [ ] Email summaries (monthly arrears report)

### Phase 4: Analytics & Dashboards
- [ ] Financial KPIs (collection rate, arrears trend)
- [ ] Charts (collection by method, arrears by category)
- [ ] Forecasting (expected revenue vs. outstanding)

---

## ⚠️ Known Limitations & Notes

1. **Soft Deletes:** Not implemented yet — deleted assessments/payments are removed from DB entirely (use archive flag in UI if needed)
2. **Bulk Operations:** No CSV import for assessments yet
3. **Notifications:** No alerts when payments are due or overdue
4. **Mobile:** Tables may require horizontal scroll on narrow screens
5. **Audit Trail:** Soft-delete and update history not visible in UI (exists in DB via `deleted_at`, `created_by`, `updated_by`)

---

## 🔐 Security Checklist

- ✅ RLS policies on all tables
- ✅ Access control via `can_access()` function
- ✅ User scope inheritance (deanery/parish/outstation)
- ✅ Numeric fields use `numeric(12, 2)` (preserve precision)
- ✅ No hardcoded admin bypass in queries
- ⚠️ TODO: Rate limiting on payment creation (consider adding to API route)

---

## 📝 SQL Queries for Manual Testing

### Insert test assessment
```sql
INSERT INTO parish_assessments (parish_id, category_id, fiscal_year, amount_due)
SELECT p.id, fc.id, 2026, 5000
FROM parishes p, financial_categories fc
WHERE p.name = 'St. Pius X, Mariira' AND fc.name = 'Bishop''s Visit'
LIMIT 1;
```

### Check assessments for a deanery
```sql
SELECT pa.*, fc.name, p.name
FROM parish_assessments pa
JOIN financial_categories fc ON fc.id = pa.category_id
JOIN parishes p ON p.id = pa.parish_id
WHERE p.deanery_id = (SELECT id FROM deaneries WHERE name = 'Gaichanjiru Deanery')
ORDER BY p.name, fc.name;
```

### Check payment allocations
```sql
SELECT pp.*, pa.amount_due, fc.name
FROM parish_payments pp
LEFT JOIN payment_allocations pa ON pa.payment_id = pp.id
LEFT JOIN parish_assessments ppa ON ppa.id = pa.assessment_id
LEFT JOIN financial_categories fc ON fc.id = ppa.category_id
WHERE pp.parish_id = (SELECT id FROM parishes WHERE name = 'St. Pius X, Mariira')
ORDER BY pp.payment_date DESC;
```

---

## 📞 Support

For issues or questions:
1. Check CLAUDE.md for architecture overview
2. Review existing modules (Leaders, Youth Records) for similar patterns
3. Test RLS policies with different user roles
4. Verify `can_access()` function returns true for your user's scope

---

**Created:** 2026-10-03  
**Status:** ✅ Ready for data aggregation & UI wiring  
**Branch:** feature/finances
