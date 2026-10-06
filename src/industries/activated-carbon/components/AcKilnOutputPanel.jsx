import { useEffect, useState } from "react";

import { createAcKilnOutputBag, fetchAcKilnOutputBags, formatAcApiError } from "../../../services/activatedCarbonApi";
import useBusyGuard from "../hooks/useBusyGuard";
import AcAlert from "./AcAlert";

function printBagLabel(bag, kilnTitle) {
  const html = `<!doctype html><html><head><title>${bag.bag_code}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#0f172a}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0}</style>
    </head><body>
    <h1>${bag.bag_code}</h1>
    <p>${kilnTitle}</p>
    <p>Weight: ${Number(bag.quantity_kg).toFixed(2)} kg</p>
    ${bag.order_code ? `<p>Inward: ${bag.order_code}</p>` : ""}
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
  lotCode = null
}) {
  const [weight, setWeight] = useState("");
  const [bags, setBags] = useState([]);
  const [error, setError] = useState("");
  const { busy: saving, run } = useBusyGuard();

  const reload = async () => {
    if (!kilnCode) {
      setBags([]);
      return;
    }
    const data = await fetchAcKilnOutputBags(kilnCode);
    setBags(data?.bags || []);
  };

  useEffect(() => {
    reload().catch(() => setBags([]));
  }, [kilnCode]);

  const totalKg = bags.reduce((sum, row) => sum + (Number(row.quantity_kg) || 0), 0);

  const handleAdd = () =>
    run(async () => {
      const qty = Number(weight);
      if (!kilnCode || !Number.isFinite(qty) || qty <= 0) {
        setError("Enter output weight in kg.");
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
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight (kg)"
              disabled={saving}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              style={{ color: "#0f172a", background: "#fff" }}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !kilnCode}
              className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-sm font-semibold mb-2">Counters — output</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full border border-slate-200 px-3 py-1"
              style={{ background: "#fff", color: "#0f172a" }}
            >
              No. of bags: {bags.length}
            </span>
            <span className="rounded-full bg-blue-600 text-white px-3 py-1">
              Weight: {totalKg.toFixed(2)} kg
            </span>
          </div>
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
                      <td className="py-1.5 pr-2 tabular-nums">{Number(bag.quantity_kg).toFixed(0)}</td>
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
