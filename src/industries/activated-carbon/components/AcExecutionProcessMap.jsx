import { useEffect, useState } from "react";

import { fetchAcKilnOutputBags } from "../../../services/activatedCarbonApi";
import { AC_TERMINAL_INSTOCK } from "../constants/acRawMaterialProcessCatalog";
import { acProcessTabKey, acProcessTabLabel } from "../utils/acExecutionOperations";
import { GR_COCONUT_SHELL_NAME } from "../utils/acGrCoconutShell";

import "../styles/rawMaterialFlow.css";

function statusLabel(status) {
  return status || "Pending";
}

export default function AcExecutionProcessMap({
  operations = [],
  activeId,
  onSelect,
  bagCount = 0,
  kilnCode = "",
  materialName = GR_COCONUT_SHELL_NAME
}) {
  const [loadedBags, setLoadedBags] = useState(bagCount);

  useEffect(() => {
    setLoadedBags(bagCount);
  }, [bagCount]);

  useEffect(() => {
    if (!kilnCode) return;
    fetchAcKilnOutputBags(kilnCode)
      .then((data) => setLoadedBags(data?.bag_count ?? data?.bags?.length ?? 0))
      .catch(() => {});
  }, [kilnCode]);

  if (!operations.length) return null;
  const bags = loadedBags || bagCount;

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500">
            Process map
          </div>
          <div className="text-sm font-semibold text-slate-900">{materialName}</div>
        </div>
        <p className="text-xs text-slate-500 m-0">
          Continue from kiln output bags. Click a step to record it.
        </p>
      </div>

      <div className="ac-rm-flow-diagram-wrap">
        <div className="ac-rm-flow-diagram" aria-label={`${materialName} process map`}>
          <div className="ac-rm-flow-diagram-segment">
            <div className="ac-rm-flow-node ac-rm-flow-node--material">
              <div className="ac-rm-flow-node-kicker">From kiln</div>
              <div className="ac-rm-flow-node-title">Kiln output bags</div>
              <div className="ac-rm-flow-node-step">
                {bags > 0 ? `${bags} bag${bags === 1 ? "" : "s"}` : "Add bags above"}
              </div>
            </div>
          </div>

          {operations.map((op, index) => {
            const id = acProcessTabKey(op);
            const selected = Boolean(id) && id === activeId;
            const done = String(op.status || "").toLowerCase().includes("complete");
            return (
              <div key={id || op.operation_code || index} className="ac-rm-flow-diagram-segment">
                <div className="ac-rm-flow-link" aria-hidden="true" />
                <button
                  type="button"
                  className={`ac-rm-flow-node ac-rm-flow-node--process${
                    selected ? " ac-rm-flow-node--active" : ""
                  }${done ? " ac-rm-flow-node--done" : ""}`}
                  onClick={() => id && onSelect?.(id)}
                >
                  <div className="ac-rm-flow-node-kicker">P{index + 1}</div>
                  <div className="ac-rm-flow-node-title">{acProcessTabLabel(op)}</div>
                  <div className="ac-rm-flow-node-step">{statusLabel(op.status)}</div>
                </button>
              </div>
            );
          })}

          <div className="ac-rm-flow-diagram-segment">
            <div className="ac-rm-flow-link" aria-hidden="true" />
            <div className="ac-rm-flow-node ac-rm-flow-node--instock">
              <div className="ac-rm-flow-node-kicker">Terminal</div>
              <div className="ac-rm-flow-node-title">{AC_TERMINAL_INSTOCK.operation_name}</div>
              <div className="ac-rm-flow-node-step">{AC_TERMINAL_INSTOCK.description}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
