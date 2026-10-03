/** Post-release production path (Raw Material is complete before this). */

export const AC_ACTIVATION_FLOW_STEPS = [
  {
    id: "feasibility",
    label: "Feasibility Gate",
    hint: "LOT-AC-* checks",
    pathSuffix: "/feasibility"
  },
  {
    id: "kiln_feed",
    label: "Kiln Feed",
    hint: "Charge activation kiln",
    pathSuffix: "/kiln-feed"
  },
  {
    id: "routing",
    label: "Lot Routing",
    hint: "Generate work orders",
    pathSuffix: "/routing"
  },
  {
    id: "execution",
    label: "Execution",
    hint: "Activation · screening · QC",
    pathSuffix: "/execution"
  }
];
