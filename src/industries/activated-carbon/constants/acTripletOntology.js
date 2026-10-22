/**
 * Activated Carbon triplet ontology URIs (aligned with kg.triple_store_staging / migration 006).
 * Staged on raw material QC save via nyra-mes-api adapter.
 */
export const AC_TRIPLET_PREDICATES = {
  supplies: "urn:nyra:predicate:supplies",
  testedBy: "urn:nyra:predicate:tested_by",
  captures: "urn:nyra:predicate:captures",
  usedEquipment: "urn:nyra:predicate:usedEquipment",
  containedIn: "urn:nyra:predicate:contained_in",
  hasStonesKg: "urn:nyra:hasStonesKg",
  hasUnburntKg: "urn:nyra:hasUnburntKg",
  hasMinus20Kg: "urn:nyra:hasMinus20Kg"
};

export function acInwardSubjectUri(orderCode) {
  return `urn:nyra:ac:inward:${orderCode}`;
}

export function acRawMaterialQcObjectUri(orderCode) {
  return `urn:nyra:ac:rawMaterialQc:${orderCode}`;
}

export function acProductionLotSubjectUri(lotCode) {
  return `urn:nyra:ac:lot:${lotCode}`;
}

export function acScreeningObjectUri(executionCode) {
  return `urn:nyra:ac:screening:${executionCode}`;
}

export function acQualityCheckObjectUri(checkCode) {
  return `urn:nyra:ac:qualityCheck:${checkCode}`;
}

export function acInwardBagObjectUri(bagCode) {
  return `urn:nyra:ac:inwardBag:${bagCode}`;
}

export const AC_VOLATILITY_PARAMETER = "urn:nyra:ac:parameter:VOLATILITY";
export const AC_AD_VALUE_PARAMETER = "urn:nyra:ac:parameter:AD_VALUE";

export const AC_INWARD_RECEIPT_PARAMETERS = {
  DC_NUMBER: "urn:nyra:ac:parameter:DC_NUMBER",
  SUPPLIER_WEIGHT_KG: "urn:nyra:ac:parameter:SUPPLIER_WEIGHT_KG",
  OUR_WEIGHT_KG: "urn:nyra:ac:parameter:OUR_WEIGHT_KG",
  SUPPLIER_VALUE_INR: "urn:nyra:ac:parameter:SUPPLIER_VALUE_INR",
  RECEIVED_QTY_KG: "urn:nyra:ac:parameter:RECEIVED_QTY_KG",
  WEIGHT_TO_CRUSHER_KG: "urn:nyra:ac:parameter:WEIGHT_TO_CRUSHER_KG",
  WEIGHT_VARIANCE_COMMENT: "urn:nyra:ac:parameter:WEIGHT_VARIANCE_COMMENT"
};

/** Inward crusher performance — mesh shares as % on urn:nyra:ac:inward:{order_code}. */
export const AC_CRUSHER_PERFORMANCE_PARAMETERS = {
  ROTARY: "urn:nyra:ac:parameter:ROTARY",
  CRUSHER_GRADE: "urn:nyra:ac:parameter:CRUSHER_GRADE",
  MESH_PLUS_2_PCT: "urn:nyra:ac:parameter:MESH_PLUS_2_PCT",
  MESH_2_3_PCT: "urn:nyra:ac:parameter:MESH_2_3_PCT",
  MESH_3_4_PCT: "urn:nyra:ac:parameter:MESH_3_4_PCT",
  MESH_4_6_PCT: "urn:nyra:ac:parameter:MESH_4_6_PCT",
  MESH_6_10_PCT: "urn:nyra:ac:parameter:MESH_6_10_PCT",
  MESH_10_12_PCT: "urn:nyra:ac:parameter:MESH_10_12_PCT",
  MESH_12_14_PCT: "urn:nyra:ac:parameter:MESH_12_14_PCT",
  MESH_MINUS_14_PCT: "urn:nyra:ac:parameter:MESH_MINUS_14_PCT",
  MOISTURE_PCT: "urn:nyra:ac:parameter:MOISTURE_PCT",
  DUST_PCT: "urn:nyra:ac:parameter:DUST_PCT"
};

/**
 * ISA-95 trace chain steps staged as KG triples on save (API adapter).
 * Raw material QC uses AC_TRIPLET_PREDICATES; post-activation uses lot-scoped URIs.
 */
export const AC_ONTOLOGY_TRACE_STEPS = [
  {
    screen: "Raw Material Inward",
    subject: (code) => acInwardSubjectUri(code),
    predicates: ["supplies", "captures"],
    api: "POST /api/activated-carbon/raw-material-inward"
  },
  {
    screen: "Initial QC",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => `urn:nyra:ac:initialQc:${code}`,
    predicates: ["testedBy", "captures"],
    api: "POST /api/activated-carbon/raw-material-initial-qc"
  },
  {
    screen: "Bag split",
    subject: (code) => acInwardBagObjectUri(code),
    object: (code) => acInwardSubjectUri(code),
    predicates: ["containedIn", "generatedFrom"],
    api: "POST /api/activated-carbon/inward-bags"
  },
  {
    screen: "Lab (volatility on inward)",
    subject: (code) => acInwardBagObjectUri(code),
    object: () => AC_VOLATILITY_PARAMETER,
    predicates: ["testedBy", "captures"],
    api: "POST /api/activated-carbon/raw-material-inbound-execution (IN-LAB)"
  },
  {
    screen: "Drying",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => `urn:nyra:ac:drying:${code}`,
    predicates: ["captures", "generatedFrom"],
    api: "POST /api/activated-carbon/raw-material-inbound-execution (IN-DRYING)"
  },
  {
    screen: "GRN",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => `urn:nyra:ac:crusherOutput:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/raw-material-crusher-output"
  },
  {
    screen: "Grade separation",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => `urn:nyra:ac:gradeSeparation:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/raw-material-grade-separation"
  },
  {
    screen: "Crushing / Sizing",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => `urn:nyra:ac:crushing:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/raw-material-crushing"
  },
  {
    screen: "Raw Material QC (auto-passed after GRN — no separate screen)",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => acRawMaterialQcObjectUri(code),
    predicates: ["testedBy", "captures", "hasStonesKg", "hasUnburntKg", "hasMinus20Kg"],
    api: "POST /api/activated-carbon/raw-material-inbound-execution (IN-RM-OUT)"
  },
  {
    screen: "Feasibility Gate",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => `urn:nyra:ac:feasibility:${code}`,
    predicates: ["feasibilityChecked"],
    api: "POST /api/activated-carbon/lots/{lot_code}/feasibility/run"
  },
  {
    screen: "Execution — Kiln Feed",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => `urn:nyra:ac:kilnFeed:${code}`,
    predicates: ["chargedTo"],
    api: "POST /api/activated-carbon/kiln-feed"
  },
  {
    screen: "Execution — Kiln feed quality",
    subject: (code) => `urn:nyra:ac:inwardBag:${code}`,
    object: (code) => `urn:nyra:ac:parameter:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/kiln-feed-bag-qc"
  },
  {
    screen: "Execution — Kiln readings",
    subject: (code) => `urn:nyra:ac:kilnReading:${code}`,
    object: (code) => `urn:nyra:ac:kiln:${code}`,
    predicates: ["usedEquipment", "captures"],
    api: "POST /api/activated-carbon/kiln-parameters"
  },
  {
    screen: "Execution — Kiln output",
    subject: (code) => `urn:nyra:ac:kilnOutBag:${code}`,
    object: (code) => `urn:nyra:ac:kiln:${code}`,
    predicates: ["containedIn", "generatedFrom"],
    api: "POST /api/activated-carbon/kiln-output"
  },
  {
    screen: "Execution — Kiln output quality",
    subject: (code) => `urn:nyra:ac:kilnOutBag:${code}`,
    object: (code) => `urn:nyra:ac:parameter:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/kiln-output-bag-qc"
  },
  {
    screen: "Execution — Destoning",
    subject: (code) => `urn:nyra:ac:destonBag:${code}`,
    object: (code) => `urn:nyra:ac:kilnOutBag:${code}`,
    predicates: ["generatedFrom", "containedIn", "captures", "usedEquipment"],
    api: "POST /api/activated-carbon/destoning/output"
  },
  {
    screen: "Screening after Destoning",
    subject: (code) => `urn:nyra:ac:sadBag:${code}`,
    object: (code) => `urn:nyra:ac:destonBag:${code}`,
    predicates: ["generatedFrom", "containedIn", "captures"],
    api: "POST /api/activated-carbon/post-activation/screening_after_destoning/output"
  },
  {
    screen: "Execution — Destoning quality",
    subject: (code) => `urn:nyra:ac:destonBag:${code}`,
    object: (code) => `urn:nyra:ac:parameter:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/destoning-bag-qc"
  },
  {
    screen: "Execution — Routing",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => `urn:nyra:ac:routing:${code}`,
    predicates: ["generates"],
    api: "POST /api/activated-carbon/routing/generate"
  },
  {
    screen: "Screening",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => acScreeningObjectUri(code),
    predicates: ["screenedAt"],
    api: "POST /api/activated-carbon/screening"
  },
  {
    screen: "Execution — Post activation live load",
    subject: (code) => `urn:nyra:ac:screenBag:${code}`,
    object: (code) => `urn:nyra:ac:destonBag:${code}`,
    predicates: ["generatedFrom", "containedIn", "captures"],
    api: "POST /api/activated-carbon/post-activation/{process}/output"
  },
  {
    screen: "Grade separation",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => `urn:nyra:ac:gradeSeparation:${code}`,
    predicates: ["captures"],
    api: "POST /api/activated-carbon/grade-separation"
  },
  {
    screen: "Quality Testing",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => acQualityCheckObjectUri(code),
    predicates: ["testedBy", "captures"],
    api: "POST /api/activated-carbon/quality-testing"
  },
  {
    screen: "Dispatch",
    subject: (code) => acProductionLotSubjectUri(code),
    predicates: ["dispatchedTo"],
    api: "POST /api/activated-carbon/dispatches"
  }
];

/**
 * ISA-95 L3 machine utilization bands (Masters config).
 * Not shop-floor capture — inward ORD-* and lot urn:nyra:ac:lot:* subjects stay unchanged.
 * Defaults match AC_ISA95_KPI_ONTOLOGY.thresholds.
 */
export const AC_ISA95_UTILIZATION_RAG = {
  greenMinPct: 90,
  amberMinPct: 70,
  redBelowPct: 70,
  isa95Area: "Site:AC_Plant"
};
