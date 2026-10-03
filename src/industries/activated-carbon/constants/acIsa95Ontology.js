/**
 * ISA-95 manufacturing ontology — Activated Carbon (GR Carbons).
 * Hierarchy: Enterprise → Site/Area → Process Cell → Production Unit → Control Module.
 * Triples align with mes_core traceability (Subject → Predicate → Object).
 */

export const ISA95_LEVELS = [
  { level: 4, label: "Enterprise", short: "L4" },
  { level: 3, label: "Site / Area", short: "L3" },
  { level: 2, label: "Process Cell", short: "L2" },
  { level: 1, label: "Production Unit", short: "L1" },
  { level: 0, label: "Control Module", short: "L0" }
];

/** @type {Array<{ id: string, label: string, level: number, kind: string, parent: string | null, flowPath?: string, processStep?: string, desc: string }>} */
export const AC_ISA95_ENTITIES = [
  {
    id: "Enterprise:GR_CARBONS",
    label: "GR Carbons",
    level: 4,
    kind: "enterprise",
    parent: null,
    desc: "Enterprise — customer orders, suppliers, and plant governance (ISA-95 Level 4)."
  },
  {
    id: "Site:AC_Plant",
    label: "Activated Carbon Plant",
    level: 3,
    kind: "site",
    parent: "Enterprise:GR_CARBONS",
    desc: "Manufacturing site — single product family: granular activated carbon."
  },
  {
    id: "Area:RawMaterial",
    label: "Raw Material Handling",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "raw-material-inward",
    processStep: "RAW_MATERIAL_INWARD",
    desc: "Inbound charcoal / shell receipt, weighment, and batch registration."
  },
  {
    id: "Area:RawMaterialQC",
    label: "Raw Material QC",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "raw-material-qc",
    processStep: "RAW_MATERIAL_QC",
    desc: "Incoming inspection gate before kiln eligibility."
  },
  {
    id: "Area:KilnActivation",
    label: "Kiln Activation",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "kiln-feed",
    processStep: "KILN_FEED",
    desc: "Feed charging, activation, and cooling on rotary kiln lines."
  },
  {
    id: "Area:PostProcessing",
    label: "Post-Processing",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "execution",
    processStep: "SCREENING",
    desc: "Screening, grade separation, and optional additional process steps."
  },
  {
    id: "Area:QualityLab",
    label: "Quality Laboratory",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "quality-testing",
    processStep: "QUALITY_TESTING",
    desc: "CTC, iodine, mesh, and batch release testing."
  },
  {
    id: "Area:FinishedGoods",
    label: "Finished Goods",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    processStep: "FG_PACKING",
    desc: "Bagging, lot labeling, and stock registration."
  },
  {
    id: "Area:Logistics",
    label: "Logistics & Dispatch",
    level: 3,
    kind: "area",
    parent: "Site:AC_Plant",
    flowPath: "dispatch",
    processStep: "DISPATCH",
    desc: "Outbound shipment authorization and customer delivery."
  },
  {
    id: "Cell:Inbound",
    label: "Inbound Cell",
    level: 2,
    kind: "process_cell",
    parent: "Area:RawMaterial",
    desc: "Process cell for material receipt and GRN."
  },
  {
    id: "Cell:KilnLine",
    label: "Kiln Line",
    level: 2,
    kind: "process_cell",
    parent: "Area:KilnActivation",
    desc: "Pyrolysis, steam activation, and residence-time control."
  },
  {
    id: "Cell:Screening",
    label: "Screening Cell",
    level: 2,
    kind: "process_cell",
    parent: "Area:PostProcessing",
    flowPath: "screening",
    processStep: "SCREENING",
    desc: "Mesh classification and yield capture."
  },
  {
    id: "Cell:QCLab",
    label: "QC Cell",
    level: 2,
    kind: "process_cell",
    parent: "Area:QualityLab",
    desc: "In-process and finished-goods quality checks."
  },
  {
    id: "Cell:DispatchDock",
    label: "Dispatch Dock",
    level: 2,
    kind: "process_cell",
    parent: "Area:Logistics",
    desc: "Weighbridge, invoice, and vehicle loading."
  },
  {
    id: "Unit:Kiln01",
    label: "RES-KILN-01",
    level: 1,
    kind: "equipment",
    parent: "Cell:KilnLine",
    desc: "Primary activation kiln — equipment master resource."
  },
  {
    id: "Unit:Screen01",
    label: "Screening Unit",
    level: 1,
    kind: "equipment",
    parent: "Cell:Screening",
    desc: "Vibrating screen for mesh cut (e.g. 8x30)."
  },
  {
    id: "Material:RawBatch",
    label: "Raw Material Batch",
    level: 1,
    kind: "material",
    parent: "Cell:Inbound",
    desc: "Charcoal / shell lot at inward — traceability root."
  },
  {
    id: "Material:ProductionLot",
    label: "Production Lot",
    level: 1,
    kind: "lot",
    parent: "Cell:KilnLine",
    desc: "Shop-floor lot (LOT-AC-*) executing routing operations."
  },
  {
    id: "Material:FinishedGoodsBag",
    label: "Finished Goods Bag",
    level: 1,
    kind: "material",
    parent: "Area:FinishedGoods",
    desc: "Packed FG batch linked to dispatch document."
  },
  {
    id: "Control:RoutingOperation",
    label: "Routing Operation",
    level: 0,
    kind: "operation",
    parent: "Material:ProductionLot",
    desc: "mst.routing_operation — process step definition per product route."
  },
  {
    id: "Control:OperationParameter",
    label: "Operation Parameter",
    level: 0,
    kind: "parameter",
    parent: "Control:RoutingOperation",
    desc: "mst.routing_operation_parameter — capture limits and data types."
  },
  {
    id: "Control:ProcessExecution",
    label: "Process Execution",
    level: 0,
    kind: "workorder",
    parent: "Material:ProductionLot",
    desc: "exec.operation_execution — work order / shop-floor execution instance."
  },
  {
    id: "Control:ParameterReading",
    label: "Parameter Reading",
    level: 0,
    kind: "parameter",
    parent: "Control:ProcessExecution",
    desc: "exec.parameter_reading — captured kiln / QC values."
  },
  {
    id: "Control:ModbusTelemetry",
    label: "Modbus Telemetry",
    level: 0,
    kind: "sensor",
    parent: "Unit:Kiln01",
    desc: "Live T1–T4, pressure, steam flow from smart-modbus-sim."
  },
  {
    id: "Party:Supplier",
    label: "Supplier",
    level: 4,
    kind: "party",
    parent: "Enterprise:GR_CARBONS",
    desc: "External feedstock vendor — supplies raw material batches."
  },
  {
    id: "Party:Customer",
    label: "Customer",
    level: 4,
    kind: "party",
    parent: "Enterprise:GR_CARBONS",
    desc: "Buyer of finished activated carbon — dispatch destination."
  }
];

/** Subject → predicate → object (ISA-95 / KG traceability chain). */
export const AC_ISA95_TRIPLES = [
  ["Party:Supplier", "supplies", "Material:RawBatch"],
  ["Material:RawBatch", "receivedAt", "Area:RawMaterial"],
  ["Material:RawBatch", "inspectedBy", "Area:RawMaterialQC"],
  ["Material:RawBatch", "issuedTo", "Unit:Kiln01"],
  ["Unit:Kiln01", "activates", "Material:ProductionLot"],
  ["Material:ProductionLot", "executes", "Control:ProcessExecution"],
  ["Control:ProcessExecution", "implements", "Control:RoutingOperation"],
  ["Control:RoutingOperation", "captures", "Control:OperationParameter"],
  ["Control:ProcessExecution", "records", "Control:ParameterReading"],
  ["Unit:Kiln01", "monitoredBy", "Control:ModbusTelemetry"],
  ["Material:ProductionLot", "screenedAt", "Cell:Screening"],
  ["Material:ProductionLot", "testedBy", "Cell:QCLab"],
  ["Material:ProductionLot", "produces", "Material:FinishedGoodsBag"],
  ["Material:FinishedGoodsBag", "dispatchedTo", "Party:Customer"],
  ["Area:Logistics", "fulfills", "Party:Customer"],
  ["Material:ProductionLot", "tracedBy", "Site:AC_Plant"]
];

export const ISA95_KIND_PALETTE = {
  enterprise: "from-indigo-500/15 border-indigo-400/40 text-indigo-200",
  site: "from-violet-500/15 border-violet-400/40 text-violet-200",
  area: "from-cyan-500/15 border-cyan-400/40 text-cyan-200",
  process_cell: "from-sky-500/15 border-sky-400/40 text-sky-200",
  equipment: "from-amber-500/15 border-amber-400/40 text-amber-200",
  material: "from-emerald-500/15 border-emerald-400/40 text-emerald-200",
  lot: "from-teal-500/15 border-teal-400/40 text-teal-200",
  operation: "from-blue-500/15 border-blue-400/40 text-blue-200",
  parameter: "from-green-500/15 border-green-400/40 text-green-200",
  workorder: "from-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200",
  sensor: "from-orange-500/15 border-orange-400/40 text-orange-200",
  party: "from-pink-500/15 border-pink-400/40 text-pink-200"
};

const entityById = Object.fromEntries(AC_ISA95_ENTITIES.map((e) => [e.id, e]));

export function getAcIsa95Entity(id) {
  return entityById[id] || null;
}

export function getAcIsa95Children(parentId) {
  return AC_ISA95_ENTITIES.filter((e) => e.parent === parentId);
}

export function getAcIsa95RootEntities() {
  return AC_ISA95_ENTITIES.filter((e) => e.parent == null);
}

export function getAcIsa95OutgoingTriples(entityId) {
  return AC_ISA95_TRIPLES.filter(([subject]) => subject === entityId);
}

export function getAcIsa95IncomingTriples(entityId) {
  return AC_ISA95_TRIPLES.filter(([, , object]) => object === entityId);
}

/** Map dashboard process-flow path to ontology entity id. */
export function entityIdForFlowPath(flowPath) {
  const match = AC_ISA95_ENTITIES.find((e) => e.flowPath === flowPath);
  return match?.id || null;
}

export function labelForEntityId(id) {
  return getAcIsa95Entity(id)?.label || id.split(":").pop() || id;
}
