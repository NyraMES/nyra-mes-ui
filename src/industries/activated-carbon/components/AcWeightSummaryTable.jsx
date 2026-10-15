function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AcWeightSummaryTable({
  ourKg,
  bagTotal,
  pendingKg,
  className = ""
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm min-w-[20rem]">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-3 font-medium">Our weight (KG)</th>
            <th className="py-2 pr-3 font-medium">Sum of bags (KG)</th>
            <th className="py-2 font-medium">Pending (KG)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-2 pr-3 font-mono">{formatKg(ourKg)}</td>
            <td className="py-2 pr-3 font-mono">{formatKg(bagTotal)}</td>
            <td className="py-2 font-mono font-medium">{formatKg(pendingKg)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
