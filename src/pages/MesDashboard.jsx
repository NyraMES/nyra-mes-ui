import { Link } from "react-router-dom";

import MesCard from "../components/mes/MesCard";
import MesPageHeader from "../components/mes/MesPageHeader";

const MODULES = [
  {
    to: "/process-library",
    title: "Process Library",
    desc: "Reusable processes loaded from the API — add, edit, and deactivate master data.",
    step: "1"
  },
  {
    to: "/part-master",
    title: "Part Master",
    desc: "Register parts before defining routings for new products.",
    step: "2"
  },
  {
    to: "/route-entry",
    title: "Route Entry",
    desc: "Define part routings, link processes, and attach data capture templates.",
    step: "3"
  },
  {
    to: "/work-order-data-capture",
    title: "Work Order Data Capture",
    desc: "Operators capture shop-floor data from routing-linked templates.",
    step: "4"
  }
];

function MesDashboard() {
  return (
    <div className="max-w-5xl">
      <MesPageHeader
        eyebrow="Nyra MES · Ontology Studio"
        title="Dashboard"
        subtitle="End-to-end flow: Part → Route → Process → Data Capture Template → Work Order Execution"
      />

      <MesCard title="Ontology-driven manufacturing flow" className="mb-6">
        <ol className="space-y-2 text-sm text-slate-700">
          <li>1. Maintain the <strong>Process Library</strong> (seeded + new processes from API)</li>
          <li>2. Create a <strong>Part</strong> in Part Master</li>
          <li>3. Open <strong>Route Entry</strong> — link processes and templates per operation</li>
          <li>4. Save the routing — work orders inherit operation templates</li>
          <li>5. At execution, <strong>Work Order Data Capture</strong> renders the form automatically</li>
        </ol>
      </MesCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#08264a] hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#08264a] text-sm font-bold text-white">
              {m.step}
            </div>
            <h2 className="text-base font-semibold text-slate-900 group-hover:text-[#08264a]">
              {m.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{m.desc}</p>
            <span className="mt-4 inline-block text-sm font-medium text-[#08264a]">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default MesDashboard;
