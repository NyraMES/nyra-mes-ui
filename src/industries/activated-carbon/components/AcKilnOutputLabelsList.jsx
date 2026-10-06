import { useEffect, useState } from "react";

import { fetchAcKilnOutputBags } from "../../../services/activatedCarbonApi";

export default function AcKilnOutputLabelsList({ kilnCode, title = "Kiln output labels" }) {
  const [bags, setBags] = useState([]);

  useEffect(() => {
    if (!kilnCode) {
      setBags([]);
      return;
    }
    fetchAcKilnOutputBags(kilnCode)
      .then((data) => setBags(data?.bags || []))
      .catch(() => setBags([]));
  }, [kilnCode]);

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 px-4 py-3" style={{ color: "#0f172a" }}>
      <p className="text-sm font-semibold mb-2">{title}</p>
      {bags.length === 0 ? (
        <p className="text-xs" style={{ color: "#64748b" }}>
          No kiln output bags yet. Add a weight on the kiln output panel above.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {bags
            .slice()
            .reverse()
            .map((bag) => (
              <li
                key={bag.bag_code}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs"
              >
                {bag.bag_code}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
