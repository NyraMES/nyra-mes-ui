import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createMesCoreCustomerOrder,
  fetchMesCoreCustomerOrders,
  fetchMesCoreCustomers,
  fetchMesCoreProducts,
} from "../../services/mesCoreApi";
import { formatApiError } from "../../services/api";
import { useAppContext } from "../../context/AppContext";
import { isDemoReadOnly } from "../../config/demoMode";
import {
  DEMO_ORDER_CODE,
  loadDemoWalkthroughContext,
  workflowContextFromOrder,
} from "../../utils/demoWalkthrough";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  OntologyEdge,
  ContextBanner,
  GeneratedIdsDialog
} from "../ui";


function CustomerOrderWorkflow() {
  const navigate = useNavigate();
  const { context, update, markStage } = useWorkflow();
  const { context: appContext } = useAppContext();

  const [customerId, setCustomerId] = useState(context.customerId || "");
  const [partId, setPartId] = useState(context.partId || "");
  const [quantity, setQuantity] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState("Created");

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [parts, setParts] = useState([]);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const demoReadOnly = isDemoReadOnly(appContext);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoadingData(true);
    setLoadError("");
    try {
      const [o, c, p] = await Promise.all([
        fetchMesCoreCustomerOrders(),
        fetchMesCoreCustomers(),
        fetchMesCoreProducts(),
      ]);
      setOrders(o || []);
      setCustomers(c || []);
      setParts(p || []);
    } catch (e) {
      console.error(e);
      const status = e?.response?.status;
      if (status === 401) {
        setLoadError("Could not load customers and parts. Sign in again, then refresh this page.");
      } else if (status === 403) {
        setLoadError("Your account does not have permission to load master data. Ask an admin to add you to a MES role group.");
      } else {
        setLoadError(formatApiError(e, "Could not load customers and parts. Check that the API is running."));
      }
    } finally {
      setLoadingData(false);
    }
  };

  const missingFields = useMemo(() => {
    const missing = [];
    if (!customerId) missing.push("Customer");
    if (!partId) missing.push("Part");
    if (!Number(quantity) || Number(quantity) <= 0) missing.push("Quantity");
    if (!deliveryDate) missing.push("Planned delivery date");
    return missing;
  }, [customerId, partId, quantity, deliveryDate]);

  const canSave = missingFields.length === 0;

  const submit = async () => {
    setFormError("");
    if (demoReadOnly) {
      setFormError("Demo is read-only. Click “Start demo walkthrough” to continue with ORD-DEMO-1042.");
      return;
    }
    if (!canSave) {
      setFormError(`Complete: ${missingFields.join(", ")}.`);
      return;
    }
    setSubmitting(true);
    try {
      const { order, line } = await createMesCoreCustomerOrder({
        customer_id: customerId,
        product_id: partId,
        quantity: Number(quantity),
        delivery_date: deliveryDate,
        status,
      });
      const createdOrderId = order.order_id;
      const lineId = line.order_line_id;

      const customer = customers.find((c) => c.customer_id === customerId);
      const part = parts.find((p) => p.product_id === partId);

      update({
        orderId: createdOrderId,
        orderLineId: lineId,
        plannedQuantity: Number(quantity),
        customerId,
        customerName: customer?.customer_name || customer?.customer_code || customerId,
        partId: part?.part_code || partId,
      });
      markStage("customer-order");

      setIdsDialog({
        open: true,
        items: [
          { label: "Customer Order", value: createdOrderId },
          { label: "Order Line", value: line.order_line_code || lineId },
          { label: "Planned Delivery", value: deliveryDate }
        ]
      });
    } catch (e) {
      console.error(e);
      alert(formatApiError(e, "Error creating order"));
    } finally {
      setSubmitting(false);
    }
  };

  const startDemoWalkthrough = async (targetPath = "/workflow/production-order") => {
    setDemoLoading(true);
    setFormError("");
    try {
      const demo = await loadDemoWalkthroughContext();
      update({
        ...demo,
      });
      markStage("customer-order");
      navigate(targetPath);
    } catch (e) {
      console.error(e);
      alert(formatApiError(e, e.message || "Could not load demo walkthrough"));
    } finally {
      setDemoLoading(false);
    }
  };

  const continueWithOrder = (order) => {
    try {
      const ctx = workflowContextFromOrder(order, customers, parts);
      update(ctx);
      markStage("customer-order");
      navigate("/workflow/production-order");
    } catch (e) {
      alert(e.message || "Cannot continue with this order");
    }
  };

  const selectedCustomer = customers.find(
    (c) => c.customer_id === customerId || c.customer_code === customerId
  );
  const selectedPart = parts.find((p) => p.product_id === partId);

  return (
    <div className="space-y-6">
      <GeneratedIdsDialog
        open={idsDialog.open}
        title="Customer order created"
        subtitle="These IDs were assigned from the order sequence. Continue to release production."
        items={idsDialog.items}
        continueLabel="Continue to Production Order →"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
          loadAll();
          navigate("/workflow/production-order");
        }}
      />
      <SectionHeader
        eyebrow="Stage 01 · Customer Order"
        title="Capture customer demand"
        subtitle="Origin of the manufacturing workflow. The order anchors the downstream production, routing, quality and dispatch graph."
      />

      {demoReadOnly && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-amber-100">
            <strong>Demo mode</strong> — creating customers/orders is disabled. Use the pre-seeded{" "}
            <span className="font-mono text-amber-200">{DEMO_ORDER_CODE}</span> walkthrough (Apex Automotive → BRK-PAD-450).
          </div>
          <button
            type="button"
            className="wf-btn wf-btn-primary shrink-0"
            disabled={demoLoading || loadingData}
            onClick={() => startDemoWalkthrough("/workflow/production-order")}
          >
            {demoLoading ? "Loading…" : "Start demo walkthrough →"}
          </button>
        </div>
      )}

      {context.orderId && (
        <ContextBanner
          label="Continuing workflow"
          items={[
            { label: "Customer", value: context.customerName },
            { label: "Order", value: context.orderId },
            { label: "Part", value: context.partId }
          ]}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="New Customer Order"
            subtitle="Order → Customer · Order → Part · Order → Quantity"
            icon={<IconOrder />}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 wf-info-banner">
                Order and line IDs are assigned automatically from system sequences when you save.
              </div>

              {loadError && (
                <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError}
                </div>
              )}

              {!loadingData && !loadError && customers.length === 0 && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  No customers found. Create one first in{" "}
                  <Link to="/workflow/masters/customers" className="font-semibold underline">
                    Customer Master
                  </Link>
                  .
                </div>
              )}

              {!loadingData && !loadError && parts.length === 0 && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  No parts found. Create one first in{" "}
                  <Link to="/workflow/masters/parts" className="font-semibold underline">
                    Part Master
                  </Link>
                  .
                </div>
              )}

              <div>
                <label className="wf-label">Customer</label>
                <select
                  className="wf-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">-- Select customer --</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_code || c.customer_id} · {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="wf-label">Part</label>
                <select
                  className="wf-select"
                  value={partId}
                  onChange={(e) => setPartId(e.target.value)}
                >
                  <option value="">-- Select part --</option>
                  {parts.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.part_code || p.part_id} · {p.part_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="wf-label">Quantity</label>
                <input
                  type="number"
                  className="wf-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="wf-label">Planned Delivery Date *</label>
                <input
                  type="date"
                  required
                  className="wf-input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                {!deliveryDate && (
                  <div className="text-xs text-amber-700 mt-1">
                    Required — pick a planned delivery date to enable save.
                  </div>
                )}
              </div>

              <div>
                <label className="wf-label">Status</label>
                <select
                  className="wf-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Created">Created</option>
                  <option value="Planned">Planned</option>
                  <option value="Released">Released</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {canSave ? (
                  <>
                    Ready to save. Next:{" "}
                    <span className="font-medium text-slate-700">Production Order</span> auto-loads this order line.
                  </>
                ) : (
                  <>Still needed: {missingFields.join(" · ")}</>
                )}
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {formError && (
                  <div className="text-xs text-red-600 text-right">{formError}</div>
                )}
                <div className="flex gap-2">
                <button type="button" className="wf-btn wf-btn-ghost" onClick={() => {
                  setCustomerId(""); setPartId(""); setQuantity(""); setDeliveryDate(""); setFormError("");
                }}>
                  Clear
                </button>
                <button
                  type="button"
                  className={`wf-btn wf-btn-primary${canSave ? " wf-btn-primary-ready" : ""}`}
                  disabled={submitting || demoReadOnly}
                  title={demoReadOnly ? "Use Start demo walkthrough above" : undefined}
                  onClick={submit}
                >
                  Create &amp; Continue →
                </button>
                </div>
              </div>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader
              title="Ontology"
              subtitle="Relationships this order will create"
              icon={<IconAtom />}
            />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Customer" to="Order" label="places" />
              <OntologyEdge from="Order" to="OrderLine" label="contains" />
              <OntologyEdge from="OrderLine" to="Part" label="for" />
              <OntologyEdge from="Order" to="ProductionOrder" label="triggers" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Context Preview" subtitle="Captured workflow state" icon={<IconPreview />} />
            <WfCardBody className="space-y-3">
              <PreviewRow label="Customer" value={selectedCustomer?.customer_name || customerId || "—"} />
              <PreviewRow label="Part" value={selectedPart ? `${selectedPart.part_code || ""} · ${selectedPart.part_name}` : "—"} />
              <PreviewRow label="Order ID" value={context.orderId || "Assigned on save"} />
              <PreviewRow label="Quantity" value={quantity || "—"} />
              <PreviewRow label="Delivery" value={deliveryDate || "—"} />
              <div className="mt-2 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Validation</span>
                <StatusPill kind={canSave ? "ok" : "neutral"}>
                  {canSave ? "Ready" : "Incomplete"}
                </StatusPill>
              </div>
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader title="Existing Customer Orders" subtitle={`${orders.length} orders in system`} icon={<IconList />} />
        <WfCardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                  <th className="text-left py-2 px-3 font-semibold">Order ID</th>
                  <th className="text-left py-2 px-3 font-semibold">Customer</th>
                  <th className="text-left py-2 px-3 font-semibold">Status</th>
                  <th className="text-left py-2 px-3 font-semibold">Order Date</th>
                  <th className="text-left py-2 px-3 font-semibold">Delivery</th>
                  <th className="text-left py-2 px-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="border-b border-white/5 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-900">{o.order_id}</td>
                    <td className="py-2.5 px-3 text-slate-700">{o.customer_code || o.customer_id}</td>
                    <td className="py-2.5 px-3"><StatusPill kind="info">{o.status || "—"}</StatusPill></td>
                    <td className="py-2.5 px-3 text-slate-600">{o.order_date || "—"}</td>
                    <td className="py-2.5 px-3 text-slate-600">{o.delivery_date || "—"}</td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        className="wf-btn wf-btn-ghost text-xs py-1 px-2"
                        onClick={() => continueWithOrder(o)}
                      >
                        Continue →
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 font-medium truncate text-right">{value}</span>
    </div>
  );
}

function IconOrder()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>; }
function IconAtom()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconPreview() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconList()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }

export default CustomerOrderWorkflow;
