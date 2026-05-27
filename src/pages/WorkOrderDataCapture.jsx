import { useEffect, useRef, useState } from "react";

import WorkOrderCaptureForm from "../components/WorkOrderCaptureForm";
import MesCard from "../components/mes/MesCard";
import MesPageHeader from "../components/mes/MesPageHeader";
import api from "../services/api";

function WorkOrderDataCapture() {
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderId, setWorkOrderId] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    api
      .get("/work-orders")
      .then((r) => setWorkOrders(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWorkOrders([]));
  }, []);

  const loadTemplate = () => {
    if (workOrderId.trim()) {
      setLoadedId(workOrderId.trim());
    }
  };

  return (
    <div className="max-w-4xl">
      <MesPageHeader
        eyebrow="Shop Floor · Execution"
        title="Work Order Data Capture"
        subtitle="Load the parameters linked to the work order routing operation and enter actual shop-floor values."
      />

      <MesCard title="Select Work Order" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Work Order ID
            </label>
            <div className="flex gap-2">
              <input
                list="work-order-ids"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                value={workOrderId}
                onChange={(e) => setWorkOrderId(e.target.value)}
                placeholder="WO-0001"
              />
              <datalist id="work-order-ids">
                {workOrders.map((wo) => (
                  <option key={wo.work_order_id} value={wo.work_order_id} />
                ))}
              </datalist>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg bg-[#08264a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
            onClick={loadTemplate}
          >
            Load Parameters
          </button>
        </div>
      </MesCard>

      {loadedId && (
        <MesCard title="Capture Values" subtitle={`Work order ${loadedId}`}>
          <WorkOrderCaptureForm
            ref={formRef}
            workOrderId={loadedId}
            captureStage="execution"
            theme="mes"
          />
        </MesCard>
      )}
    </div>
  );
}

export default WorkOrderDataCapture;
