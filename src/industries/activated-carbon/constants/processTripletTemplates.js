import { AC_TRIPLET_PREDICATES } from "./acTripletOntology";

/** Subject URI templates — {lot_code} and {execution_code} resolved at shop-floor save. */
export const AC_TRIPLET_SUBJECT_TEMPLATES = [
  {
    value: "urn:nyra:ac:lot:{lot_code}",
    label: "Production lot (urn:nyra:ac:lot:{lot_code})"
  },
  {
    value: "urn:nyra:ac:execution:{execution_code}",
    label: "Operation execution (urn:nyra:ac:execution:{execution_code})"
  }
];

export const AC_OBJECT_DATATYPE_OPTIONS = [
  {
    value: "http://www.w3.org/2001/XMLSchema#decimal",
    label: "Number (decimal)"
  },
  {
    value: "http://www.w3.org/2001/XMLSchema#string",
    label: "Text (string)"
  },
  {
    value: "http://www.w3.org/2001/XMLSchema#boolean",
    label: "Yes / No (boolean)"
  }
];

/** Default execution capture triplets per standard AC process step. */
export const DEFAULT_EXECUTION_TRIPLETS_BY_STEP = {
  KILN_FEED: [
    {
      key: "kiln_resource_code",
      label: "Kiln assigned",
      unit: "",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "assignedTo",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#string"
    },
    {
      key: "charge_kg",
      label: "Charge quantity",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  PYROLYSIS: [
    {
      key: "pyrolysis_peak_temp_c",
      label: "Pyrolysis peak temperature",
      unit: "°C",
      default_value: "650",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  BAG_SPLIT: [
    {
      key: "bag_weight_kg",
      label: "Bag weight",
      unit: "KG",
      default_value: "",
      used_at: "inbound",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  CRUSHING: [
    {
      key: "input_lump_size_mm",
      label: "Input lump size",
      unit: "mm",
      default_value: "40",
      used_at: "inbound",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "target_output_size_mm",
      label: "Target output size",
      unit: "mm",
      default_value: "12",
      used_at: "inbound",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "crush_output_kg",
      label: "Crushed output mass",
      unit: "KG",
      default_value: "",
      used_at: "inbound",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "crush_yield_pct",
      label: "Crushing yield",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "moisture_after_crush_pct",
      label: "Moisture after crush",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "dust_generation_pct",
      label: "Dust / fines generated",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_plus_2_pct",
      label: "+2",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_2_3_pct",
      label: "2/3",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_3_4_pct",
      label: "3/4",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_4_6_pct",
      label: "4/6",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_6_10_pct",
      label: "6/10",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_10_12_pct",
      label: "10/12",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_12_14_pct",
      label: "12/14",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "mesh_minus_14_pct",
      label: "-14",
      unit: "%",
      default_value: "",
      used_at: "inbound",
      mandatory: false,
      operation_code: "IN-CRUSHER",
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:inward:{order_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  ACTIVATION: [
    {
      key: "activation_steam_kg_h",
      label: "Activation steam rate",
      unit: "kg/h",
      default_value: "1200",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "activation_temp_c",
      label: "Activation temperature",
      unit: "°C",
      default_value: "850",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  SCREENING: [
    {
      key: "screen_mesh_size",
      label: "Target mesh size",
      unit: "mesh",
      default_value: "8x30",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#string"
    },
    {
      key: "good_kg",
      label: "Good fraction",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  GRADE_SEPARATION: [
    {
      key: "grade_code",
      label: "Product grade",
      unit: "",
      default_value: "8x30",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#string"
    },
    {
      key: "separated_kg",
      label: "Grade mass separated",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "grade_yield_pct",
      label: "Grade yield",
      unit: "%",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "overs_grade_kg",
      label: "Overs (recycle)",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: false,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "fines_grade_kg",
      label: "Fines (sub-grade)",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: false,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  DESTONING: [
    {
      key: "stone_removed_kg",
      label: "Stone / grit removed",
      unit: "KG",
      default_value: "",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    },
    {
      key: "destoning_yield_pct",
      label: "Yield after destoning",
      unit: "%",
      default_value: "",
      used_at: "execution",
      mandatory: false,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ],
  QC: [
    {
      key: "iodine_mg_g",
      label: "Iodine number",
      unit: "mg/g",
      default_value: "950",
      used_at: "execution",
      mandatory: true,
      ontology_predicate: "captures",
      subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
      object_datatype: "http://www.w3.org/2001/XMLSchema#decimal"
    }
  ]
};

export function suggestPredicateUriFromKey(key) {
  const base = String(key || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (!base) return "";
  return `urn:nyra:has${base}`;
}

export function resolvePredicateUri(ontologyPredicate, customPredicateUri, key) {
  if (customPredicateUri?.startsWith("urn:")) return customPredicateUri;
  if (ontologyPredicate && AC_TRIPLET_PREDICATES[ontologyPredicate]) {
    return AC_TRIPLET_PREDICATES[ontologyPredicate];
  }
  if (ontologyPredicate?.startsWith("urn:")) return ontologyPredicate;
  return suggestPredicateUriFromKey(key) || undefined;
}

export function buildTripletPreview(param) {
  const subject = param.subject_uri_template || "urn:nyra:ac:lot:{lot_code}";
  const predicate =
    resolvePredicateUri(param.ontology_predicate, param.predicate_uri, param.key) ||
    "urn:nyra:predicate:captures";
  const objectLabel = param.label || param.key || "value";
  const unit = param.unit ? ` ${param.unit}` : "";
  return {
    subject_uri: subject,
    predicate_uri: predicate,
    object_label: `${objectLabel} (captured at execution)`,
    object_hint: param.key ? `{${param.key}}${unit}` : `{value}${unit}`,
    object_datatype: param.object_datatype || "http://www.w3.org/2001/XMLSchema#decimal"
  };
}

export function defaultExecutionParametersForStep(processStep) {
  const step = (processStep || "").toUpperCase();
  return (DEFAULT_EXECUTION_TRIPLETS_BY_STEP[step] || []).map((row) => ({ ...row }));
}

export function normalizeTripletParameter(raw) {
  const key = (raw.key || "").trim();
  const ontology_predicate = raw.ontology_predicate || "captures";
  return {
    key,
    label: (raw.label || key).trim(),
    unit: raw.unit?.trim() || undefined,
    default_value: raw.default_value?.trim() || undefined,
    used_at: raw.used_at || "execution",
    mandatory: raw.mandatory !== false,
    process_step: raw.process_step,
    operation_code: raw.operation_code || undefined,
    ontology_predicate,
    predicate_uri: resolvePredicateUri(ontology_predicate, raw.predicate_uri, key),
    subject_uri_template: raw.subject_uri_template || "urn:nyra:ac:lot:{lot_code}",
    object_datatype:
      raw.object_datatype || "http://www.w3.org/2001/XMLSchema#decimal"
  };
}
