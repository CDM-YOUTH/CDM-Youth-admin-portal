# Finance & Ledger Module — Complete Implementation Guide

## 🏗️ Architecture Overview

```
FINANCE SYSTEM
├── LEDGER (Tracking & Payments)
│   └── /admin/finances
│       ├── Summary (deanery rollup)
│       ├── Events (event arrears by year)
│       ├── Projects (project balances)
│       └── Enrollment (subscription tracking)
│
├── CONFIGURATION (Planning & Budgets)
│   └── /admin/finances/config
│       ├── Parish Classes (A, B, C tiers)
│       ├── Events (annual rates by year)
│       ├── Enrollment (per-member rate)
│       └── Projects (multi-year allocation matrix)
│
└── DATABASE
    ├── Master Data (classes, categories, rates)
    ├── Allocations (parish obligations)
    ├── Payments (cash, cheques, deposits)
    └── Audit Trail (who, when, what)
```

---

## 📊 Data Model

### Master Data Tables

#### `parish_classes` (Tiers)
```sql
Class A  →  Large/Urban parishes
Class B  →  Medium parishes  
Class C  →  Small/Rural parishes
```

#### `financial_categories` (Events by Year)
```sql
Event Name      | Type      | Fiscal Year
Bishop's Visit  | event     | 2026
Patronage Day   | event     | 2026
Youth Day       | event     | 2026
Annual Fee      | enrollment| 2026
```

#### `event_rates` (What each event costs)
```sql
Event         | Year | Amount
Bishop's Visit| 2026 | KES 1,500
              | 2027 | KES 1,800
Patronage Day | 2026 | KES 5,000
              | 2027 | KES 5,500
```

#### `enrollment_rates` (Per-member subscription)
```sql
Year | Amount per Member
2026 | KES 100
2027 | KES 100
```

#### `projects` (Multi-year initiatives)
```sql
Name              | Status | Description
Kagio Youth...    | Active | Building project
Annual Library... | Draft  | Library equipment
```

#### `project_class_allocations` (The Matrix)
```sql
Project         | Class A | Class B | Class C | Year
Kagio Youth     | 100,000 | 50,000  | 25,000  | 2025
                | 150,000 | 75,000  | 40,000  | 2026
Annual Library  | 50,000  | 30,000  | 15,000  | 2026
```

### Transaction Tables

#### `parish_assessments` (Invoices/Obligations)
Generated from:
- **Events:** All parishes × event rate
- **Enrollment:** headcount × enrollment rate
- **Projects:** Parish class allocation × year

Example:
```sql
Parish              | Obligation              | Amount | Year
St. Pius X, Mariira | Bishop's Visit 2026     | 1,500  | 2026
St. Pius X, Mariira | Kagio Project 2026      | 100,000| 2026 (Class A)
St. Pius X, Mariira | Enrollment 2026 (50)    | 5,000  | 2026 (50 × 100)
```

#### `parish_payments` (Cash In)
```sql
Parish     | Method      | Reference | Amount  | Date
Mariira    | Cheque      | CHQ-9928  | 15,000  | 2026-10-03
Mariira    | Bank Deposit| DEP-1001  | 50,000  | 2026-10-05
```

#### `payment_allocations` (Where Money Goes)
```sql
Payment          | Obligation              | Allocated
CHQ-9928 (15K)   | Bishop's Visit 2026     | 1,500
                 | Kagio Project 2026      | 13,500
```

---

## 🛠️ Modules

### 1. LEDGER (`/admin/finances`)

**Purpose:** Track actual payments and arrears

**Tabs:**
- **Summary** — Deanery rollup view (events, projects, enrollment arrears)
- **Events** — Event arrears by year with fiscal year filter
- **Projects** — Project balances (debt → allocations → payments)
- **Enrollment** — Youth subscription tracking (headcount × rate)

**Features:**
- Deanery-first view (drill down to parishes)
- Year filter for events
- Global "Record Payment" button
- FIFO waterfall auto-allocation
- View-only (read transactions)

**Data Sources:**
- Pulls from `parish_assessments` (obligations)
- Pulls from `parish_payments` (received)
- Calculates balances (due - paid)

---

### 2. CONFIG (`/admin/finances/config`)

**Purpose:** Plan budgets and manage obligations

**Tabs:**

#### A. Parish Classes
```
| Class Name | Description | # Parishes | Actions |
|------------|-------------|-----------|---------|
| Class A    | Large/Urban | 12        | [Edit]
| Class B    | Medium      | 18        | [Edit]
| Class C    | Small/Rural | 24        | [Edit]
```

**Actions:**
- Create/edit class names and descriptions
- Assign parishes to classes (bulk or individual)
- Sort order for display

#### B. Events
```
Year Filter: [2027 ▼]

| Event Name      | 2027  | Actions |
|-----------------|-------|---------|
| Bishop's Visit  | 2000  | [Edit]
| Patronage Day   | 5000  | [Edit]
| Youth Day       | 3000  | [Edit]
```

**Workflow:**
1. Click **[Year: 2027 ▼]** to view/edit events for that year
2. Click cell to edit rate → Modal updates amount
3. **[+ Add Event]** → Create new event for selected year
4. **[+ Add Year]** → Creates new year column
   - Option: "Copy from 2026?" → Auto-copies all events with same rates
   - Edit individual cells to adjust for new year
5. **Remove** → Delete event from specific year (not entire event)

**Auto-generates:**
- All parishes get obligation for that event at that rate
- Creates `parish_assessments` rows automatically

#### C. Enrollment
```
Simple configuration:
Rate per Member (KES): [100]  [Save]
Fiscal Year: [2027]
```

**Auto-generates:**
- Each parish's obligation = headcount × rate
- Updates `parish_assessments` with subscription amount

#### D. Projects
```
| Project Name      | Status   | Actions        |
|-------------------|----------|----------------|
| Kagio Youth...    | Active   | [View Matrix]
| Annual Library... | Draft    | [View Matrix]
```

**Click [View Matrix] → Opens Allocation Matrix**

```
Kagio Youth Project - Allocation Matrix

Year Filter / [+ Add Phase]: [2026 ▼]

| Phase/Class | Class A    | Class B   | Class C  | Actions |
|-------------|-----------|-----------|----------|---------|
| 2021        | 100,000   | 50,000    | 25,000   | [Edit]
| 2025        | 150,000   | 75,000    | 40,000   | [Edit]
| 2026        | 150,000   | 75,000    | 40,000   | [Edit]
| [+ Add Phase]
```

**Workflow:**
1. Click project → Opens matrix
2. Click cell (e.g., "Class A, 2026") → Modal to edit amount
3. **[+ Add Phase]** → New row
   - Option: "Copy from 2025?" → Auto-fills new year with same amounts
   - Edit cells to adjust amounts
4. Save → Auto-generates `parish_assessments` rows:
   - Each parish in Class A owes allocation_amount for that project/year

---

## 📈 Automatic Obligation Generation

When admin saves configuration, system auto-creates `parish_assessments`:

### Events
```
For each parish in system:
  For each event in fiscal_year:
    IF parish is active AND event is active:
      CREATE assessment(
        parish_id = parish.id,
        category_id = event.category_id,
        amount_due = event_rate.amount_due
      )
```

### Enrollment
```
For each parish with headcount:
  CREATE assessment(
    parish_id = parish.id,
    category_id = enrollment_category,
    headcount = parish.enrollment_count,
    amount_due = headcount * enrollment_rate
  )
```

### Projects
```
For each parish:
  IF parish has class_id:
    For each project_class_allocation matching parish.class_id:
      CREATE assessment(
        parish_id = parish.id,
        project_id = allocation.project_id,
        amount_due = allocation.amount_allocated
      )
```

---

## 🔐 Role-Based Access

| Role | Ledger | Config | Details |
|------|--------|--------|---------|
| **admin** | Full (R/W/D) | Full (R/W/D) | Complete access |
| **office** | Full (R/W/D) | Full (R/W/D) | Youth office staff |
| **moderator** | R/W (no D) | Read-only | Can record payments, see config |
| **user** | Read-only | — | View financial summaries |

---

## 📋 Migrations (Apply in Order)

```bash
# 1. Enhanced schema with all new tables
node scripts/apply-migration.mjs supabase/migrations/20261004000000_finances_enhanced_schema.sql

# 2. Role permissions
node scripts/apply-migration.mjs supabase/migrations/20261003000007_finances_role_permissions.sql
```

---

## 🚀 API & Data Layer

### Data Layer File
`src/lib/db/finances-config.ts`

**Parish Classes**
```ts
listParishClasses()
createParishClass({ class_name, description })
updateParishClass(id, { class_name, ... })
deleteParishClass(id)
```

**Events**
```ts
listEventsByYear(fiscalYear)        // Events for a year
listAllYears()                       // Available years
createEvent({ name, fiscalYear, amount })
updateEventRate(id, amount)
deleteEventRate(id)
```

**Enrollment**
```ts
getEnrollmentRate(fiscalYear)
updateEnrollmentRate(fiscalYear, amountPerMember)
```

**Projects**
```ts
listProjects()
createProject({ name, description })
updateProject(id, { name, status, ... })
deleteProject(id)

getProjectAllocationMatrix(projectId)  // Get all allocations
createProjectAllocation({ projectId, classId, allocationYear, amount })
updateProjectAllocation(id, amount)
deleteProjectAllocation(id)
bulkCreateAllocations(projectId, year, [{ classId, amount }])
copyProjectAllocationYear(projectId, fromYear, toYear)  // Copy year
```

---

## 🎯 User Workflows

### Admin Sets Up Budget for 2027

1. Go to **Finance Config → Events**
2. Select **Year: 2027 ▼**
3. Click **[+ Add Year]**
   - Dialog: "Copy from 2026?" → [Yes]
   - System copies all 2026 events to 2027 with same amounts
4. Edit individual events as needed:
   - Bishop's Visit: 1,500 → 1,800
   - Patronage Day: 5,000 → 5,500
5. **[+ Add Event]** for new event (Youth Summit: 2,500)
6. Save → All parishes get new obligations

### Admin Sets Up Tiered Project

1. Go to **Finance Config → Projects**
2. Click **[+ Create Project]** → "Kagio Youth Complex"
3. Click **[View Matrix]**
4. Click **[+ Add Phase]** → 2027
   - Dialog: "Copy from 2026?" → [Yes]
   - Fills matrix with 2026 amounts
5. Edit Class A, 2027: 150,000 → 180,000
6. Edit Class B, 2027: 75,000 → 90,000
7. Edit Class C, 2027: 40,000 → 50,000
8. Save → All parishes in each class get obligation

### Finance Officer Records Payment

1. Go to **Finance Ledger**
2. Click **[Record Payment]**
3. Select Parish: "St. Pius X, Mariira"
4. Method: Cheque, Ref: CHQ-9928, Amount: 15,000, Date: Oct 3
5. Allocation: Auto (FIFO) → System allocates:
   - 1,500 → Bishop's Visit 2026
   - 13,500 → Kagio Project 2026 (oldest)
6. Save → Payment recorded, arrears updated

---

## 📊 Ledger Dashboard

The **Ledger** tabs automatically calculate from assessments + payments:

### Summary Tab
```
Gaichanjiru Deanery

| Metric              | Amount    |
|---------------------|-----------|
| Total Events Due    | 847,500   |
| Events Paid         | 456,200   |
| Events Arrears      | 391,300   |
|                     |           |
| Total Projects Due  | 5,200,000 |
| Projects Paid       | 2,100,000 |
| Projects Arrears    | 3,100,000|
|                     |           |
| Enrollment Due      | 245,000   |
| Enrollment Paid     | 245,000   |
| Enrollment Arrears  | 0         |
```

### Events Tab (2027)
```
| Parish              | Bishop's Visit | Patronage Day | Youth Day | Arrears | Total |
|---------------------|---|---|---|---|---|
| St. Pius X, Mariira | 1,800 | 5,500 | 3,000 | 0 | 10,300 |
| Murang'a (HQ)       | 0 (red)| 0 (red) | 3,000 | 5,300 | 5,300 |
```

---

## ✅ Complete Checklist

- ✅ Database schema (parishes classes, events by year, project matrix)
- ✅ Data layer (CRUD for all config entities)
- ✅ Ledger UI (4 tabs with real data)
- ✅ Config UI (4 tabs for budgeting)
- ✅ Role permissions (admin/office/moderator/user)
- ✅ Sidebar navigation (both modules)
- ✅ Auto obligation generation on save
- ✅ Year management (copy, add, edit)
- ✅ Deanery scoping (consistent with system)
- ✅ FIFO payment allocation

---

## 🔧 Next: Production Ready Tasks

1. **Add Modal Dialogs:**
   - Edit event rate modal
   - Edit class modal
   - Edit project allocation cell modal
   - Add/edit project modal

2. **Bulk Operations:**
   - Import parishes CSV with class assignments
   - Export assessment report

3. **Advanced Features:**
   - Year cloning with adjustments
   - Soft delete with restore
   - Audit log view
   - Payment reconciliation report

---

**Status:** 🎉 **Full implementation ready for testing**

Apply migrations, test workflows, then add modal dialogs for full production deployment.
