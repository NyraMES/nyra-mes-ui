import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AcInboundProcessPanel from "../components/AcInboundProcessPanel";
import AcInwardRecordsTable from "../components/AcInwardRecordsTable";
import AcAlert from "../components/AcAlert";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function RawMaterialInboundPrepPage({ focusOrderId = null, refreshToken = 0 }) {
  const [listTick, setListTick] = useState(refreshToken);
  useEffect(() => {
    setListTick(refreshToken);
  }, [refreshToken]);

  return (
    <div className="space-y-4">
      <AcAlert variant="info">
        After <strong>Gate receipt</strong> on the previous tab, complete all four prep steps here
        (Lab → RMS inward → crusher performance → RM outward). Raw Material QC is not required.
        Then open{" "}
        <Link to="/activated-carbon/raw-material?tab=release" className="underline font-medium">
          Release to Production
        </Link>
        .
      </AcAlert>

      <AcInboundProcessPanel
        focusOrderId={focusOrderId}
        refreshToken={refreshToken}
        alwaysVisible
        onStepCompleted={() => setListTick((n) => n + 1)}
      />

      <WfCard>
        <WfCardHeader
          title="What comes later"
          subtitle="Not on this tab — after release"
        />
        <WfCardBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Activation (pre-kiln, kiln, destoning) and post-activation screening run on{" "}
            <strong>Feasibility</strong> and <strong>Execution</strong> after you release a
            production lot. Those steps are configured under Masters → Materials &amp; steps as
            shop-floor routing.
          </p>
        </WfCardBody>
      </WfCard>

      <AcInwardRecordsTable refreshToken={listTick} className="" />
    </div>
  );
}

export default RawMaterialInboundPrepPage;
