import { useLocation } from "react-router-dom";

/** Base path for the active industry module (`/automotive-oem`, `/activated-carbon`, or `/workflow`). */
export function useIndustryBasePath() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/automotive-oem")) return "/automotive-oem";
  if (pathname.startsWith("/activated-carbon")) return "/activated-carbon";
  return "/workflow";
}

export default useIndustryBasePath;
