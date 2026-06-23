# Nyra MES UI — Application Test Cases

| Field | Value |
|-------|-------|
| **Application** | Nyra MES UI (`nyra-mes-ui`) |
| **Version** | 0.0.0 (workspace) |
| **Document** | APPLICATION_TEST_CASES.md |
| **Last updated** | June 2026 |
| **Scope** | Full application — Landing, Login, Legacy MES, Workflow Intelligence, Activated Carbon module |

---

## 1. Purpose

This document defines test cases to validate the entire Nyra MES UI application:

- All routes load without JavaScript errors or blank screens
- End-to-end Activated Carbon production flow (with local API)
- Workflow Intelligence module screens
- ISA-95 KPIs and triplet ontology configuration
- Non-functional behaviour (dashboard refresh, build)

Use it for **manual QA**, **UAT sign-off**, or as a reference for **automated Playwright tests** in `tests/e2e/`.

---

## 2. Test environment

### 2.1 Prerequisites

| # | Requirement | Notes |
|---|-------------|-------|
| E1 | Node.js 18+ | For UI and Playwright |
| E2 | `.env.ac` | Copy from `.env.ac.example` |
| E3 | UI running | `.\scripts\run_ac_ui.ps1` → http://127.0.0.1:5173 |
| E4 | API (integration tests) | http://127.0.0.1:8000 — optional for smoke-only |
| E5 | Modbus sim (telemetry) | http://127.0.0.1:8010 — optional |

### 2.2 Recommended local settings (`.env.ac`)

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_AUTH_ENABLED=false
VITE_DEMO_MODE=false
VITE_DEMO_READ_ONLY=false
```

### 2.3 Automated test execution

```powershell
cd d:\Sudha\Nyra\nyra-mes-ui
npm install
npx playwright install chromium
npm run test:e2e
```

Or use the helper script:

```powershell
.\scripts\run_e2e_local.ps1
```

| npm script | Description |
|------------|-------------|
| `npm run test:e2e` | Run all Playwright specs (starts dev:ac if not running) |
| `npm run test:e2e:ui` | Interactive Playwright UI |
| `npm run test:e2e:report` | Open HTML report |
| `npm run test:e2e:testbed` | Remote testbed smoke check |

---

## 3. Test case summary

| Suite | Count | Priority | API required |
|-------|-------|----------|--------------|
| G — Global / platform | 8 | P1 | Partial |
| AC-S — AC screen smoke | 20 | P1 | No |
| AC-F — AC functional flow | 14 | P1 | Yes |
| W — Workflow Intelligence | 14 | P1 | Partial |
| O — Ontology / ISA-95 | 8 | P2 | Partial |
| N — Non-functional | 6 | P2 | Partial |
| **Total** | **70** | | |

**Priority:** P1 = release blocker · P2 = important · P3 = nice to have

---

## 4. Global / platform test cases

| ID | Title | Priority | Preconditions | Test steps | Expected result | Auto |
|----|-------|----------|---------------|------------|-----------------|------|
| **G-001** | Landing page load | P1 | UI running | 1. Open `http://127.0.0.1:5173/` | Page shows "Nyra Services", industry tiles (Activated Carbon, Automobile OEM). No blank screen. | `01-global-smoke` |
| **G-002** | Select Activated Carbon industry | P1 | Auth disabled | 1. On landing, click **Activated Carbon Plant** tile | Navigates to `/activated-carbon/dashboard`. Sidebar visible. | `02-activated-carbon` beforeEach |
| **G-003** | Login page load | P1 | UI running | 1. Open `/login` | Sign-in form or Cognito configuration message visible. | `01-global-smoke` |
| **G-004** | Protected route redirect | P1 | `VITE_AUTH_ENABLED=true`, not logged in | 1. Open `/workflow` or `/activated-carbon/dashboard` | Redirect to `/login`. | Manual |
| **G-005** | Legacy MES dashboard | P2 | Logged in or auth off | 1. Open `/dashboard` | Legacy MES dashboard renders. | `01-global-smoke` |
| **G-006** | Legacy process library | P2 | Auth off | 1. Open `/process-library` | Page loads without JS error. | Manual |
| **G-007** | API health check | P2 | API on :8000 | 1. GET `http://127.0.0.1:8000/api/health` | HTTP 200, `{ "status": "ok" }`. | `01-global-smoke` |
| **G-008** | Auth config endpoint | P3 | API on :8000 | 1. GET `/api/auth/config` | HTTP 200 with `auth_enabled` flag. | Manual |

---

## 5. Activated Carbon — screen smoke test cases

**Objective:** Every AC route loads with correct heading, sidebar, and no uncaught JS errors.

**Preconditions:** E1–E3; open AC module (G-002) or navigate directly.

| ID | Route | Expected heading / content | Auto |
|----|-------|---------------------------|------|
| **AC-S-001** | `/activated-carbon/dashboard` | Operational Intelligence Hub | Yes |
| **AC-S-002** | `/activated-carbon/kiln-telemetry` | Kiln Telemetry | Yes |
| **AC-S-003** | `/activated-carbon/raw-material-inward` | Raw Material Inward | Yes |
| **AC-S-004** | `/activated-carbon/raw-material-qc` | Raw Material QC | Yes |
| **AC-S-005** | `/activated-carbon/bag-tracing` | Bag traceability | Yes |
| **AC-S-006** | `/activated-carbon/kiln-feed` | Kiln Feed | Yes |
| **AC-S-007** | `/activated-carbon/feasibility` | Can this lot run right now? | Yes |
| **AC-S-008** | `/activated-carbon/routing` | Operation sequence per lot | Yes |
| **AC-S-009** | `/activated-carbon/execution` | Shop floor — operation by operation | Yes |
| **AC-S-010** | `/activated-carbon/screening` | Screening | Yes |
| **AC-S-011** | `/activated-carbon/kiln-parameters` | Hourly Kiln Parameters | Yes |
| **AC-S-012** | `/activated-carbon/quality-testing` | Finished product quality testing | Yes |
| **AC-S-013** | `/activated-carbon/customer-sales` | Customer purchase order | Yes |
| **AC-S-014** | `/activated-carbon/dispatch` | Dispatch | Yes |
| **AC-S-015** | `/activated-carbon/reports` | Production reports | Yes |
| **AC-S-016** | `/activated-carbon/yield-analysis` | Yield Analysis | Yes |
| **AC-S-017** | `/activated-carbon/traceability` | Batch Traceability | Yes |
| **AC-S-018** | `/activated-carbon/masters` | Masters | Yes |
| **AC-S-019** | `/activated-carbon/routing-builder` | Routing Builder | Yes |
| **AC-S-020** | `/activated-carbon/masters?tab=ontology-ui` | Triplet ontology / Ontology & UI | Yes |

**Pass criteria (all AC-S-*):**
- HTTP response < 400
- `#root` content length > 200 characters
- Expected heading text visible
- No uncaught page errors in browser console

---

## 6. Activated Carbon — functional / end-to-end flow

**Preconditions:** API running (E4); at least one supplier and raw material type in Masters.

| ID | Title | Priority | Test steps | Expected result | Auto |
|----|-------|----------|------------|-----------------|------|
| **AC-F-001** | Create supplier | P1 | Masters → Suppliers → enter name → Save | SUP-AC-* ID shown in dialog | Manual |
| **AC-F-002** | Create raw material type | P1 | Masters → Raw material types → Save | RAW-AC-*, routing preview shown | Manual |
| **AC-F-003** | Record raw material inward | P1 | Raw Material Inward → select supplier + material → 1000 kg → **Record inward** | ORD-AC-* created; appears in inward list | `04-ac-production-flow` |
| **AC-F-004** | Raw material QC | P1 | Raw Material QC → select pending order → fill ontology fields → **Save QC** | QC saved (PASS/FAIL); success message | `04-ac-production-flow` |
| **AC-F-005** | Register inward bag | P1 | Bag traceability → select inward → 50 kg → **Register bag** | BAG-AC-* created; listed in registry | `04-ac-production-flow` |
| **AC-F-006** | Release to production | P1 | Kiln Feed → Release to production (make-to-stock) | Production order / PO created | Manual |
| **AC-F-007** | Create kiln feed lot | P1 | Kiln Feed → select inward → kiln → **Save** | LOT-AC-* created | Manual |
| **AC-F-008** | Run feasibility | P1 | Feasibility → select lot → Run check | Six feasibility cards (material, kiln, tools, etc.) | Manual |
| **AC-F-009** | Generate lot routing | P1 | Lot Routing → select lot → Generate route | Operations listed per routing template | Manual |
| **AC-F-010** | Shop-floor execution | P1 | Execution → select lot → start/complete operations | Work order status progresses | Manual |
| **AC-F-011** | Record screening | P2 | Screening → select lot → mesh + kg → Save | EXEC-* or screening record saved | Manual |
| **AC-F-012** | Finished goods QC | P1 | Quality Testing → select lot → fill ontology fields → Save | QC-AC-* saved; fields match Ontology config | Manual |
| **AC-F-013** | Dispatch lot | P1 | Dispatch → select lot/customer → Save | Dispatch record created | Manual |
| **AC-F-014** | Customer PO | P2 | Customer PO → create order | Order saved; commitment message if API available | Manual |

### 6.1 Dashboard & reports (functional)

| ID | Title | Priority | Test steps | Expected result |
|----|-------|----------|------------|-----------------|
| **AC-F-015** | Dashboard KPI load | P1 | Open dashboard after production data exists | KPI tiles, pipeline, yield reports visible or show empty-state (not crash) |
| **AC-F-016** | Dashboard manual refresh | P1 | Click **Refresh** on dashboard | Data reloads immediately; loading indicator briefly shown |
| **AC-F-017** | Dashboard auto-refresh throttle | P2 | Stay on dashboard 15 min; switch browser tabs | No reload on tab focus; auto-refresh at most every 10 minutes |
| **AC-F-018** | Configure dashboard link | P2 | Click **Configure dashboard** | Opens Masters → Ontology & UI; text readable on navy background |
| **AC-F-019** | Reports hub — all tabs | P2 | Reports → click each tab (stages, RMS loss, kiln yield, grade stock, charcoal, gcharcoal, impurities) | Each chart or empty-state renders; no JS error |
| **AC-F-020** | Kiln live load strip | P2 | Dashboard → Kiln live load panel | Kiln cards with line chart; "auto-refresh every 10 min" footer |

---

## 7. Workflow Intelligence test cases

**Preconditions:** UI running; auth off or logged in.

| ID | Route | Expected heading | Priority | Auto |
|----|-------|------------------|----------|------|
| **W-001** | `/workflow` | Operational Intelligence Hub | P1 | Yes |
| **W-002** | `/workflow/customer-order` | Capture customer demand | P1 | Yes |
| **W-003** | `/workflow/production-order` | Release production from customer demand | P1 | Yes |
| **W-004** | `/workflow/lot-split` | Divide demand into manufacturable lots | P1 | Yes |
| **W-005** | `/workflow/routing` | Operation sequence per lot | P1 | Yes |
| **W-006** | `/workflow/feasibility` | Can this lot run right now? | P1 | Yes |
| **W-007** | `/workflow/scheduling` | Assign route operations to machines and slots | P1 | Yes |
| **W-008** | `/workflow/execution` | Shop floor — operation by operation | P1 | Yes |
| **W-009** | `/workflow/inspection` | Quality gate with auto-generated NCRs | P1 | Yes |
| **W-010** | `/workflow/dispatch` | Ship only what's truly ready | P1 | Yes |
| **W-011** | `/workflow/traceability` | Manufacturing genealogy graph | P1 | Yes |
| **W-012** | `/workflow/oee` | OEE & Utilization Intelligence | P2 | Yes |
| **W-013** | `/workflow/ontology` | Domain Graph | P2 | Yes |
| **W-014** | `/workflow/kg` | Staged KG Triples | P2 | Yes |

### 7.1 Workflow functional (Automotive OEM path)

| ID | Title | Priority | Test steps | Expected result |
|----|-------|----------|------------|-----------------|
| **W-F-001** | Customer order → production order | P1 | Customer order → create → Production order → release | Order and PO IDs generated |
| **W-F-002** | Lot split | P1 | Lot split → split order into lots | LOT-* IDs created |
| **W-F-003** | Full workflow pipeline | P2 | Run order through routing → feasibility → scheduling → execution → inspection → dispatch | Each stage accessible; lot progresses |

---

## 8. Ontology & ISA-95 test cases

| ID | Title | Priority | Test steps | Expected result |
|----|-------|----------|------------|-----------------|
| **O-001** | ISA-95 KPI sidebar | P1 | Dashboard → Production KPIs sidebar | Executive pie chart; L1 KPI drill-down modals open |
| **O-002** | Raw material QC ontology config | P1 | Masters → Ontology & UI → edit QC parameter label → Save | Config saved; Raw Material QC form shows updated label |
| **O-003** | Quality testing ontology config | P1 | Ontology & UI → Quality testing parameters → disable iodine → Save | Quality Testing page hides iodine field |
| **O-004** | Dashboard panel toggle | P1 | Ontology & UI → disable "Yield reports" panel → Save → Dashboard | Yield reports section hidden |
| **O-005** | ISA-95 trace chain table | P2 | Ontology & UI → scroll to trace chain | All screens listed with predicates and API paths |
| **O-006** | ISA-95 entity drilldown | P2 | Ontology & UI → ISA-95 explorer → click entity | Outgoing/incoming triples shown |
| **O-007** | Triplet staging after QC | P1 | Save Raw Material QC → open `/workflow/kg` | Staged triples for inward/QC (when API adapter active) |
| **O-008** | Impurity chart ontology | P2 | Enable chart series on stones_kg → Dashboard Production & stock | Impurities chart uses configured series name/colour |

---

## 9. Masters (Activated Carbon) test cases

| ID | Tab | Test steps | Expected result |
|----|-----|------------|-----------------|
| **M-001** | Customers | Add customer name → Save | CUST-AC-* generated |
| **M-002** | Suppliers | Add supplier → Save | SUP-AC-* generated |
| **M-003** | Raw material types | Add type + process steps → Save | RAW-AC-* / RT-AC-* in dialog |
| **M-004** | Plant resources | Add kiln → Save | RES-KILN-* / EQ-KILN-* generated |
| **M-005** | Routing | View routing reference | Read-only routing master displayed |
| **M-006** | Kiln parameters | Add parameter key → Save | Appears on Kiln Parameters page |
| **M-007** | Ontology & UI | Save ontology config | Success message; persists after reload |

---

## 10. Non-functional test cases

| ID | Title | Priority | Test steps | Expected result |
|----|-------|----------|------------|-----------------|
| **N-001** | Production build | P1 | Run `npm run build` | Exit code 0; `dist/` generated |
| **N-002** | ESLint | P2 | Run `npm run lint` | No new blocking errors |
| **N-003** | Responsive layout | P3 | Resize dashboard to 1280px and 1920px | KPI grid and pipeline readable; no overlap |
| **N-004** | Sidebar navigation | P2 | Click each AC sidebar item | Correct route; active state highlighted |
| **N-005** | Demo mode watermark | P3 | Run with `VITE_DEMO_MODE=true` | Demo watermark visible; read-only where configured |
| **N-006** | Context API fallback | P2 | Stop API; reload AC dashboard | Context warning or fallback defaults; no hard crash |

---

## 11. Testbed / production smoke (remote)

Use when validating deployed environment (e.g. `https://nyraservices-testbed.net/mes`).

| ID | Title | Command / steps | Expected result |
|----|-------|-----------------|-----------------|
| **TB-001** | Remote landing | `npm run test:e2e:testbed` or manual | Landing + login + API health pass |
| **TB-002** | Auth-protected AC | Open `/mes/activated-carbon/dashboard` without login | Redirect to login |
| **TB-003** | Asset load | Check browser network tab | No failed `/mes/assets/` requests |

---

## 12. Traceability — automated tests

| Playwright spec | Test case IDs covered |
|-----------------|----------------------|
| `tests/e2e/01-global-smoke.spec.js` | G-001, G-003, G-005, G-007 |
| `tests/e2e/02-activated-carbon-routes.spec.js` | G-002, AC-S-001 … AC-S-020 |
| `tests/e2e/03-workflow-routes.spec.js` | W-001 … W-014 |
| `tests/e2e/04-ac-production-flow.spec.js` | AC-F-003, AC-F-004, AC-F-005, AC-F-015 (partial) |
| `scripts/e2e_testbed_check.mjs` | TB-001, TB-002, TB-003 |

---

## 13. Defect reporting template

When logging a failure, include:

```
Test Case ID: (e.g. AC-F-003)
Environment: local / testbed / production
Browser: Chrome / Edge / Firefox + version
Steps to reproduce:
Expected:
Actual:
Screenshot / console error:
API response (if applicable):
```

---

## 14. Sign-off sheet

| Suite | Total cases | Passed | Failed | Blocked | Tester | Date |
|-------|-------------|--------|--------|---------|--------|------|
| G — Global | 8 | | | | | |
| AC-S — Screen smoke | 20 | | | | | |
| AC-F — Functional | 20 | | | | | |
| W — Workflow | 14 | | | | | |
| O — Ontology | 8 | | | | | |
| N — Non-functional | 6 | | | | | |
| **Total** | **76** | | | | | |

**Release recommendation:** ☐ Approve · ☐ Approve with conditions · ☐ Reject

**Approver:** _________________________ **Date:** _____________

---

## 15. Related files

| File | Purpose |
|------|---------|
| `tests/APPLICATION_TEST_CASES.md` | This document |
| `tests/MANUAL_TEST_PLAN.md` | Short checklist version |
| `tests/e2e/*.spec.js` | Automated Playwright tests |
| `playwright.config.js` | Playwright configuration |
| `scripts/run_e2e_local.ps1` | One-command local E2E runner |
| `scripts/run_ac_ui.ps1` | Start AC UI for manual testing |
