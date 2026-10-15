import { useEffect, useState } from "react";

import AcInboundProcessPanel from "../components/AcInboundProcessPanel";
import AcInwardRecordsTable from "../components/AcInwardRecordsTable";

function RawMaterialInboundPrepPage({
  focusOrderId = null,
  refreshToken = 0,
  onlyCodes = null,
  onReadyForRelease = null
}) {
  const [listTick, setListTick] = useState(refreshToken);
  useEffect(() => {
    setListTick(refreshToken);
  }, [refreshToken]);

  return (
    <div className="space-y-4">
      <AcInboundProcessPanel
        focusOrderId={focusOrderId}
        refreshToken={refreshToken}
        onlyCodes={onlyCodes}
        alwaysVisible
        onStepCompleted={() => setListTick((n) => n + 1)}
        onReadyForRelease={onReadyForRelease}
      />

      <AcInwardRecordsTable refreshToken={listTick} className="" />
    </div>
  );
}

export default RawMaterialInboundPrepPage;
