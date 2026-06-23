import { Link } from "react-router-dom";

import KilnTelemetryPanel from "../components/KilnTelemetryPanel";
import { SectionHeader } from "../../../workflow/ui";

function KilnTelemetryPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Activated Carbon"
        title="Kiln Telemetry"
        subtitle="Live Modbus simulation readings, quality flags, and parameter trends"
        right={
          <Link to="/activated-carbon/dashboard" className="wf-btn wf-btn-ghost inline-flex items-center gap-2">
            <IconBack />
            Back to Dashboard
          </Link>
        }
      />
      <KilnTelemetryPanel />
    </div>
  );
}

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export default KilnTelemetryPage;
