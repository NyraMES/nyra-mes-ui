import { useCallback, useRef, useState } from "react";

/** Ignore a second click until the first save/load finishes. */
export default function useBusyGuard() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn) => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
