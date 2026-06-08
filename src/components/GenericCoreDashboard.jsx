import { Link } from "react-router-dom";

import { useAppContext } from "../context/AppContext";
import MesCard from "./mes/MesCard";
import MesPageHeader from "./mes/MesPageHeader";

function GenericCoreDashboard() {
  const { context } = useAppContext();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <MesPageHeader
        eyebrow="Nyra MES · Core"
        title="Dashboard"
        subtitle={
          context.fromFallback
            ? "Generic workspace view — select an industry from the home page when context is available."
            : "Core manufacturing dashboard for this workspace."
        }
      />

      <MesCard title="Getting started" className="mb-6">
        <p className="text-sm text-slate-700 mb-4">
          No industry-specific module is configured for this workspace. Return to
          the home page to choose a featured industry template.
        </p>
        <Link
          to="/"
          className="inline-block text-sm font-medium text-[#08264a] hover:underline"
        >
          ← Back to home
        </Link>
      </MesCard>
    </div>
  );
}

export default GenericCoreDashboard;
