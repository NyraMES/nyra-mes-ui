import { useLocation } from "react-router-dom";

import useIndustryBasePath from "./useIndustryBasePath";

/**
 * Industry-aware workflow "next step" links for shared feasibility / execution screens.
 * Keeps automotive-oem routes unchanged while AC skips scheduling → inspection.
 */
export function useWorkflowNavPaths() {
  const base = useIndustryBasePath();
  const { pathname } = useLocation();

  if (pathname.startsWith("/activated-carbon")) {
    return {
      afterFeasibility: `${base}/kiln-feed`,
      afterFeasibilityLabel: "Proceed to Kiln Feed →",
      afterExecution: `${base}/quality-testing`,
      afterExecutionLabel: "Proceed to Quality Testing →",
      prerequisiteForExecution: `${base}/feasibility`,
      prerequisiteLabel: "Feasibility Gate"
    };
  }

  return {
    afterFeasibility: `${base}/scheduling`,
    afterFeasibilityLabel: "Proceed to Schedule →",
    afterExecution: `${base}/inspection`,
    afterExecutionLabel: "Proceed to Inspection →",
    prerequisiteForExecution: `${base}/scheduling`,
    prerequisiteLabel: "Scheduling"
  };
}

export default useWorkflowNavPaths;
