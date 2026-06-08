/**
 * Workflow sidebar navigation — nyra_mes_core aligned, no legacy duplicates.
 * Grouped by: Overview → Workflow steps → Master Data → Intelligence → Ontology/KG
 */

export const WF_SIDEBAR_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    defaultOpen: true,
    items: [{ to: "/workflow", label: "Intelligence Hub", end: true }],
  },
  {
    id: "workflow",
    label: "Manufacturing Workflow",
    defaultOpen: true,
    items: [
      { to: "/workflow/customer-order", label: "Customer Order" },
      { to: "/workflow/production-order", label: "Production Order" },
      { to: "/workflow/lot-split", label: "Lot Split" },
      { to: "/workflow/routing", label: "Routing" },
      { to: "/workflow/feasibility", label: "Feasibility" },
      { to: "/workflow/scheduling", label: "Scheduling" },
      { to: "/workflow/execution", label: "Execution" },
      { to: "/workflow/inspection", label: "Quality & NCR" },
      { to: "/workflow/dispatch", label: "Dispatch" },
    ],
  },
  {
    id: "masters",
    label: "Master Data",
    defaultOpen: false,
    items: [
      { to: "/workflow/masters/customers", label: "Customers" },
      { to: "/workflow/masters/parts", label: "Products" },
      { to: "/workflow/masters/routings", label: "Routings" },
    ],
  },
  {
    id: "intelligence",
    label: "Operations Intelligence",
    defaultOpen: false,
    items: [
      { to: "/workflow/traceability", label: "Traceability" },
      { to: "/workflow/oee", label: "OEE Dashboard" },
    ],
  },
  {
    id: "ontology",
    label: "Ontology & Knowledge Graph",
    defaultOpen: false,
    items: [
      { to: "/workflow/ontology", label: "Domain Graph" },
      { to: "/workflow/kg", label: "Staged Triples" },
    ],
  },
];

/** @deprecated use WF_SIDEBAR_SECTIONS */
export const MES_NAV_SECTIONS = WF_SIDEBAR_SECTIONS;

export { filterSidebarSections } from "./demoMode";

export function isNavSectionActive(section, pathname) {
  return section.items.some(
    (item) =>
      pathname === item.to ||
      (item.to !== "/workflow" && pathname.startsWith(`${item.to}/`))
  );
}

export function defaultOpenSections() {
  return Object.fromEntries(
    WF_SIDEBAR_SECTIONS.map((s) => [s.id, s.defaultOpen !== false])
  );
}
