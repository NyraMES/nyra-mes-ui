# Nyra MES UI — Test Plan (Quick checklist)

> **Full test case document:** [APPLICATION_TEST_CASES.md](./APPLICATION_TEST_CASES.md) — 76 cases with IDs, steps, expected results, and sign-off sheet.

Use this checklist for manual QA or alongside automated E2E tests (`npm run test:e2e`).

## Prerequisites

| Service | Command | URL |
|---------|---------|-----|
| UI (AC mode) | `.\scripts\run_ac_ui.ps1` | http://127.0.0.1:5173 |
| API | `.\scripts\run_local_api.ps1` (if available) | http://127.0.0.1:8000 |
| Modbus sim (optional) | per project scripts | http://127.0.0.1:8010 |

Copy `.env.ac.example` → `.env.ac` before running AC UI (`VITE_AUTH_ENABLED=false` for local smoke tests).

---

## A. Automated E2E (Playwright)

```powershell
cd d:\Sudha\Nyra\nyra-mes-ui
npm install
npx playwright install chromium
npm run test:e2e
```

| Script | Purpose |
|--------|---------|
| `npm run test:e2e` | Starts dev:ac + runs all E2E specs |
| `npm run test:e2e:ui` | Playwright interactive UI |
| `npm run test:e2e:report` | Open HTML report |
| `npm run test:e2e:testbed` | Remote testbed smoke (requires network) |

**Spec files**

| File | Coverage |
|------|----------|
| `01-global-smoke.spec.js` | Landing, login, legacy dashboard, API health |
| `02-activated-carbon-routes.spec.js` | All 20 AC screens load without JS errors |
| `03-workflow-routes.spec.js` | All workflow intelligence routes |
| `04-ac-production-flow.spec.js` | Inward → QC → bag → dashboard (needs API) |

---

## B. Global application

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| G1 | Landing | Open `/` | Nyra Services tiles; Activated Carbon + Automobile OEM |
| G2 | Industry select | Click Activated Carbon (auth off) | Navigates to `/activated-carbon/dashboard` |
| G3 | Login page | Open `/login` | Sign-in form or Cognito message |
| G4 | Protected route | With auth on, open `/workflow` unauthenticated | Redirect to login |
| G5 | Legacy MES | Open `/dashboard`, `/process-library` | Pages render without blank screen |

---

## C. Activated Carbon — screen smoke

For each route, confirm: page title visible, no red error banner, sidebar present.

| # | Route | Key heading |
|---|-------|-------------|
| AC1 | `/activated-carbon/dashboard` | Operational Intelligence Hub |
| AC2 | `/activated-carbon/kiln-telemetry` | Kiln Telemetry |
| AC3 | `/activated-carbon/raw-material-inward` | Raw Material Inward |
| AC4 | `/activated-carbon/raw-material-qc` | Raw Material QC |
| AC5 | `/activated-carbon/bag-tracing` | Bag traceability |
| AC6 | `/activated-carbon/kiln-feed` | Kiln Feed |
| AC7 | `/activated-carbon/feasibility` | Can this lot run right now? |
| AC8 | `/activated-carbon/routing` | Operation sequence per lot |
| AC9 | `/activated-carbon/execution` | Shop floor |
| AC10 | `/activated-carbon/screening` | Screening |
| AC11 | `/activated-carbon/kiln-parameters` | Hourly Kiln Parameters |
| AC12 | `/activated-carbon/quality-testing` | Finished product quality testing |
| AC13 | `/activated-carbon/customer-sales` | Customer purchase order |
| AC14 | `/activated-carbon/dispatch` | Dispatch |
| AC15 | `/activated-carbon/reports` | Production reports |
| AC16 | `/activated-carbon/yield-analysis` | Yield Analysis |
| AC17 | `/activated-carbon/traceability` | Batch Traceability |
| AC18 | `/activated-carbon/masters` | Masters |
| AC19 | `/activated-carbon/routing-builder` | Routing Builder |
| AC20 | `/activated-carbon/masters?tab=ontology-ui` | Triplet ontology / Ontology & UI |

---

## D. Activated Carbon — production flow (API required)

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| P1 | Masters seed | Masters → add supplier, raw material type | IDs auto-generated |
| P2 | Raw inward | Record 1000 kg inward | ORD-AC-* created |
| P3 | Raw QC | Save QC with impurity fields | QC saved; ontology fields from config |
| P4 | Bag trace | Register 2 bags on inward | BAG-AC-*; containedIn triple staged (KG page) |
| P5 | Kiln feed | Release to production + kiln feed lot | LOT-AC-* created |
| P6 | Feasibility | Run feasibility for lot | Six checks displayed |
| P7 | Routing | Generate route for lot | Operations listed |
| P8 | Execution | Start/complete shop-floor steps | Work orders progress |
| P9 | Screening | Record mesh fractions | EXEC-* saved |
| P10 | Quality test | Save finished-goods QC | QC-AC-*; configurable ontology fields |
| P11 | Dispatch | Dispatch cleared lot | Dispatch record |
| P12 | Dashboard | Refresh hub | KPIs, pipeline, yield reports update |
| P13 | Reports | Open each report tab | Charts or empty-state (no crash) |
| P14 | Ontology admin | Enable/disable QC field + dashboard panel | Saves; dashboard reflects change |

---

## E. Workflow Intelligence module

| # | Route | Key heading |
|---|-------|-------------|
| W1 | `/workflow` | Operational Intelligence Hub |
| W2 | `/workflow/customer-order` | Capture customer demand |
| W3 | `/workflow/production-order` | Release production |
| W4 | `/workflow/lot-split` | Divide demand into manufacturable lots |
| W5 | `/workflow/routing` | Operation sequence |
| W6 | `/workflow/feasibility` | Can this lot run right now? |
| W7 | `/workflow/scheduling` | Assign route operations |
| W8 | `/workflow/execution` | Shop floor |
| W9 | `/workflow/inspection` | Quality gate |
| W10 | `/workflow/dispatch` | Ship only what's truly ready |
| W11 | `/workflow/traceability` | Manufacturing genealogy |
| W12 | `/workflow/oee` | OEE & Utilization |
| W13 | `/workflow/ontology` | Domain Graph |
| W14 | `/workflow/kg` | Staged KG Triples |

---

## F. ISA-95 & triplet ontology

| # | Test case | Expected |
|---|-----------|----------|
| O1 | Dashboard ISA-95 sidebar | L1 pie + drill-down modals |
| O2 | Ontology admin QC params | Raw material + quality tables editable |
| O3 | Ontology trace chain table | Lists all screens + predicates |
| O4 | ISA-95 drilldown | Entity explorer in Ontology tab |
| O5 | QC save → KG | Triples visible on `/workflow/kg` (when API stages) |
| O6 | Impurity chart | Series match enabled ontology QC fields |

---

## G. Non-functional

| # | Test case | Expected |
|---|-----------|----------|
| N1 | Dashboard auto-refresh | Data reloads at most every 10 min (not on tab focus) |
| N2 | Manual Refresh | Dashboard Refresh button loads immediately |
| N3 | Build | `npm run build` succeeds |
| N4 | Lint | `npm run lint` no new errors |

---

## Sign-off

| Area | Tester | Date | Pass/Fail |
|------|--------|------|-----------|
| Automated E2E | | | |
| AC production flow | | | |
| Workflow module | | | |
| Ontology / ISA-95 | | | |
