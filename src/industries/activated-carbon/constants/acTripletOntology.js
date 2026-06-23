/**
 * Activated Carbon triplet ontology URIs (aligned with kg.triple_store_staging / migration 006).
 * Staged on raw material QC save via nyra-mes-api adapter.
 */
export const AC_TRIPLET_PREDICATES = {
  supplies: "urn:nyra:predicate:supplies",
  testedBy: "urn:nyra:predicate:tested_by",
  captures: "urn:nyra:predicate:captures",
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
    screen: "Bag traceability",
    subject: (code) => acInwardBagObjectUri(code),
    object: (code) => acInwardSubjectUri(code),
    predicates: ["containedIn"],
    api: "POST /api/activated-carbon/inward-bags"
  },
  {
    screen: "Raw Material QC",
    subject: (code) => acInwardSubjectUri(code),
    object: (code) => acRawMaterialQcObjectUri(code),
    predicates: ["testedBy", "captures", "hasStonesKg", "hasUnburntKg", "hasMinus20Kg"],
    api: "POST /api/activated-carbon/raw-material-qc"
  },
  {
    screen: "Screening",
    subject: (code) => acProductionLotSubjectUri(code),
    object: (code) => acScreeningObjectUri(code),
    predicates: ["screenedAt"],
    api: "POST /api/activated-carbon/screening"
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
