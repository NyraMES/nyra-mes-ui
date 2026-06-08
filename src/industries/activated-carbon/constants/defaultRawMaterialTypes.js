/** Default feedstock → finished product routing (demo seed alignment). */
export const DEFAULT_RAW_MATERIAL_TYPES = [
  {
    product_code: "RAW-COCO-SHELL",
    product_name: "Coconut Shell",
    finished_product_code: "AC-GRAN-8x30",
    finished_product_name: "Granular Activated Carbon 8x30",
    routing_code: "RT-AC-8x30-V1",
    routing_version: 1,
    operations: [
      {
        operation_sequence: 1,
        operation_name: "Pyrolysis / Carbonization",
        operation_code: "OP-PYROLYSIS",
        process_step: "PYROLYSIS"
      },
      {
        operation_sequence: 2,
        operation_name: "Steam Activation",
        operation_code: "OP-ACTIVATION",
        process_step: "ACTIVATION"
      },
      {
        operation_sequence: 3,
        operation_name: "Screening & Classification",
        operation_code: "OP-SCREENING",
        process_step: "SCREENING"
      },
      {
        operation_sequence: 4,
        operation_name: "Quality Testing",
        operation_code: "OP-QC",
        process_step: "QC"
      }
    ],
    process_parameters: [
      {
        key: "target_iodine_mg_g",
        label: "Target iodine number",
        unit: "mg/g",
        default_value: "950",
        used_at: "feasibility"
      },
      {
        key: "activation_steam_kg_h",
        label: "Activation steam rate",
        unit: "kg/h",
        default_value: "1200",
        used_at: "execution"
      },
      {
        key: "pyrolysis_peak_temp_c",
        label: "Pyrolysis peak temperature",
        unit: "°C",
        default_value: "650",
        used_at: "execution"
      },
      {
        key: "min_residence_min",
        label: "Minimum residence time",
        unit: "min",
        default_value: "45",
        used_at: "feasibility"
      }
    ]
  }
];

export const AC_STANDARD_OPERATIONS = [
  {
    operation_sequence: 1,
    operation_name: "Pyrolysis / Carbonization",
    operation_code: "OP-PYROLYSIS",
    process_step: "PYROLYSIS"
  },
  {
    operation_sequence: 2,
    operation_name: "Steam Activation",
    operation_code: "OP-ACTIVATION",
    process_step: "ACTIVATION"
  },
  {
    operation_sequence: 3,
    operation_name: "Screening & Classification",
    operation_code: "OP-SCREENING",
    process_step: "SCREENING"
  },
  {
    operation_sequence: 4,
    operation_name: "Quality Testing",
    operation_code: "OP-QC",
    process_step: "QC"
  }
];
