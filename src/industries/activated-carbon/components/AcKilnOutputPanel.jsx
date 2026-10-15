import { useEffect, useRef, useState } from "react";

import { createAcKilnOutputBag, fetchAcKilnOutputBags, formatAcApiError } from "../../../services/activatedCarbonApi";
import useBusyGuard from "../hooks/useBusyGuard";
import { formatKilnParameters } from "../constants/kilnParameters";
import AcAlert from "./AcAlert";

function printBagLabel(bag, kilnTitle) {
  const html = `<!doctype html><html><head><title>${bag.bag_code}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#0f172a}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0}</style>
    </head><body>
    <h1>${bag.bag_code}</h1>
    <p>${kilnTitle}</p>
    <p>Weight: ${Number(bag.quantity_kg).toFixed(2)} kg</p>
    ${bag.order_code ? `<p>Inward: ${bag.order_code}</p>` : ""}
    ${bag.work_order_code ? `<p>Work order: ${bag.work_order_code}</p>` : ""}
    <p>${bag.created_at ? new Date(bag.created_at).toLocaleString() : ""}</p>
    </body></html>`;
  const win = window.open("", "_blank", "width=420,height=320");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export default function AcKilnOutputPanel({
  kilnCode,
  kilnTitle = "Kiln output",
  lotCode = null,
  refreshToken = 0,
  liveTick = 0,
  onBalance = null,
  onFeed = null
}) {
  const [weight, setWeight] = useState("");
  const [bags, setBags] = useState([]);
  const [loadedKg, setLoadedKg] = useState(0);
  const [outputKg, setOutputKg] = useState(0);
  const [remainingKg, setRemainingKg] = useState(0);
  const [currentParameters, setCurrentParameters] = useState("");
  const [error, setError] = useState("");
  const { busy: saving, run } = useBusyGuard();
  const requestSeq = useRef(0);

  const reload = async () => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    if (!kilnCode) {
      setBags([]);
      setLoadedKg(0);
      setOutputKg(0);
      setRemainingKg(0);
      setCurrentParameters("");
      onBalance?.({ loadedKg: 0, outputKg: 0, remainingKg: 0 });
      onFeed?.([]);
      return;
    }
    const data = await fetchAcKilnOutputBags(kilnCode);
    if (requestId !== requestSeq.current) return;
    const nextBags = data?.bags || [];
    const nextIn = Number(data?.loaded_kg || 0);
    const nextOut = Number(data?.total_kg ?? nextBags.reduce((sum, row) => sum + (Number(row.quantity_kg) || 0), 0));
    const nextRemain = Number(data?.remaining_kg || 0);
    setBags(nextBags);
    setLoadedKg(nextIn);
    setOutputKg(nextOut);
    setRemainingKg(nextRemain);
    setCurrentParameters(formatKilnParameters(data?.current_parameters));
    setError("");
    onBalance?.({ loadedKg: nextIn, outputKg: nextOut, remainingKg: nextRemain });
    onFeed?.(data?.feed_events || []);
  };

  useEffect(() => {
    reload().catch((e) => {
      setError(formatAcApiError(e, "Could not load kiln output"));
    });
  }, [kilnCode, refreshToken, liveTick]);

  const handleAdd = () =>
    run(async () => {
      const qty = Number(weight);
      if (!kilnCode || !Number.isFinite(qty) || qty <= 0) {
        setError("Enter output weight in kg.");
        return;
      }
      if (loadedKg <= 0) {
        setError("Nothing is in the kiln yet. Load feed first, then output can come off as the kiln runs.");
        return;
      }
      if (qty > remainingKg + 0.001) {
        setError(
          `Output cannot exceed what is still in the kiln (${remainingKg.toFixed(2)} KG). Fed ${loadedKg.toFixed(2)} KG so far.`
        );
        return;
      }
      setError("");
      await createAcKilnOutputBag({
        kiln_resource_code: kilnCode,
        quantity_kg: qty,
        lot_code: lotCode || undefined
      });
      setWeight("");
      await reload();
    }).catch((e) => {
      setError(formatAcApiError(e, "Could not add kiln output bag"));
    });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4" style={{ color: "#0f172a" }}>
      <div className="space-y-3">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-sm font-semibold mb-2">{kilnTitle} output</p>
          {error ? <AcAlert variant="error">{error}</AcAlert> : null}
          <p className="text-xs mb-2" style={{ color: "#475569" }}>
            {loadedKg > 0
              ? "Feed can keep going. Take output whenever something is still in the kiln."
              : "Load feed to start the kiln. Output can come off while feed continues."}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight (kg)"
              disabled={saving || remainingKg <= 0}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              style={{ color: "#0f172a", background: "#fff" }}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !kilnCode || remainingKg <= 0}
              className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-sm font-semibold mb-2">Kiln balance</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-blue-600 text-white px-3 py-1">
              Out: {outputKg.toFixed(2)} kg
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{
                background: remainingKg > 0 ? "#ecfdf5" : "#fff",
                borderColor: remainingKg > 0 ? "#6ee7b7" : "#e2e8f0",
                color: "#0f172a"
              }}
            >
              Still in kiln: {remainingKg.toFixed(2)} kg
            </span>
            <span
              className="rounded-full border border-slate-200 px-3 py-1"
              style={{ background: "#fff", color: "#0f172a" }}
            >
              Output bags: {bags.length}
            </span>
          </div>
          {currentParameters ? (
            <p className="text-xs mt-2 mb-0" style={{ color: "#0f172a" }}>
              Current kiln settings: {currentParameters}
            </p>
          ) : (
            <p className="text-xs mt-2 mb-0" style={{ color: "#64748b" }}>
              Current kiln settings are not saved yet. Set them under Admin — Kiln parameters.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
        <p className="text-sm font-semibold mb-2">List of outputs</p>
        {bags.length === 0 ? (
          <p className="text-xs" style={{ color: "#64748b" }}>
            Add a weight to generate a kiln output bag. Codes are KA/KB_date_sequence from a database counter.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs" style={{ color: "#0f172a" }}>
              <thead>
                <tr className="text-left" style={{ color: "#475569" }}>
                  <th className="py-1 pr-2 font-medium">Label</th>
                  <th className="py-1 pr-2 font-medium">Work order</th>
                  <th className="py-1 pr-2 font-medium">Weight (kg)</th>
                  <th className="py-1 font-medium">Print</th>
                </tr>
              </thead>
              <tbody>
                {bags
                  .slice()
                  .reverse()
                  .map((bag) => (
                    <tr key={bag.bag_code} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2">
                        <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 font-mono">
                          {bag.bag_code}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 font-mono">{bag.work_order_code || "—"}</td>
                      <td className="py-1.5 pr-2 tabular-nums">
                        {Number(bag.quantity_kg).toFixed(0)}
                        {formatKilnParameters(bag.kiln_parameters) ? (
                          <span className="block text-[10px] text-slate-500">
                            {formatKilnParameters(bag.kiln_parameters)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() => printBagLabel(bag, kilnTitle)}
                          className="text-slate-600 hover:text-blue-700"
                          title={`Print ${bag.bag_code}`}
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
