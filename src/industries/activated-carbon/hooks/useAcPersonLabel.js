import { useEffect, useState } from "react";

import { fetchAcUserNicknames } from "../../../services/activatedCarbonApi";

let cached = null;
let pending = null;

export function invalidateAcPersonLabels() {
  cached = null;
  pending = null;
}

function loadNicknames() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchAcUserNicknames()
      .then((rows) => {
        const map = {};
        for (const row of rows || []) {
          const name = String(row.display_name || "").trim();
          if (!name) continue;
          for (const key of [row.username, row.email, row.cognito_sub]) {
            const id = String(key || "").trim().toLowerCase();
            if (id) map[id] = name;
          }
        }
        cached = map;
        return map;
      })
      .catch(() => {
        pending = null;
        return {};
      });
  }
  return pending;
}

export function personLabel(map, stored) {
  const raw = String(stored || "").trim();
  if (!raw) return "";
  return map?.[raw.toLowerCase()] || raw;
}

/** Resolve a stored user id to the plant nickname. */
export default function useAcPersonLabel() {
  const [map, setMap] = useState(cached || {});

  useEffect(() => {
    let cancelled = false;
    loadNicknames().then((next) => {
      if (!cancelled) setMap(next || {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (stored) => personLabel(map, stored);
}
