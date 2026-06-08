import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Triggers data reload when the user navigates to a page or returns to the tab.
 */
export function useAcPageRefresh() {
  const location = useLocation();
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    const bump = () => setFocusTick((n) => n + 1);
    window.addEventListener("focus", bump);
    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    locationKey: location.key,
    pathname: location.pathname,
    focusTick
  };
}

export default useAcPageRefresh;
