import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  KpiTile,
  OntologyEdge,
  EmptyState
} from "../ui";


function CustomerMaster() {
  const navigate = useNavigate();
  const { update } = useWorkflow();

  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState("Automobile OEM");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([
        api.get("/customer"),
        api.get("/orders").catch(() => ({ data: [] }))
      ]);
      setCustomers(c.data || []);
      setOrders(o.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const canSave = customerName.trim() && customerType.trim();

  const createCustomer = async () => {
    if (!canSave) return;
    try {
      await api.post("/customer", {
        customer_name: customerName.trim(),
        customer_type: customerType.trim()
      });
      setCustomerName("");
      setCustomerType("Automobile OEM");
      await loadAll();
    } catch (e) {
      alert(e.response?.data?.detail || "Error creating customer");
    }
  };

  const startWorkflow = (c) => {
    update({
      customerId: c.customer_id,
      customerName: c.customer_name
    });
    navigate("/workflow/customer-order");
  };

  // Counts
  const ordersByCustomer = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const k = o.customer_id;
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [orders]);

  const typeBreakdown = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      const t = c.customer_type || "Unspecified";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.customer_id || "").toLowerCase().includes(q) ||
        (c.customer_name || "").toLowerCase().includes(q) ||
        (c.customer_type || "").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const activeCount = Object.keys(ordersByCustomer).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Master Data · Customers"
        title="Customer entities"
        subtitle="The originating node in the manufacturing graph. Every order, lot and dispatch traces back to a customer."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Customers" value={customers.length} sub="Total in system" accent="blue" icon={<IconUsers />} />
        <KpiTile label="With Orders" value={activeCount} sub="Active relationships" accent="cyan" icon={<IconLink />} />
        <KpiTile label="Customer Types" value={typeBreakdown.length} sub="Distinct segments" accent="indigo" icon={<IconLayers />} />
        <KpiTile label="Total Orders" value={orders.length} sub="Across customers" accent="violet" icon={<IconOrder />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Add Customer"
            subtitle="Captured customer becomes a node in the ontology graph"
            icon={<IconUserPlus />}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 wf-info-banner">
                Customer ID is assigned automatically from the customer sequence when you save.
              </div>
              <div>
                <label className="wf-label">Customer Name</label>
                <input
                  className="wf-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Tata Motors"
                />
              </div>
              <div>
                <label className="wf-label">Customer Type</label>
                <select
                  className="wf-select"
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                >
                  <option>Automobile OEM</option>
                  <option>Tier-1 Supplier</option>
                  <option>Tier-2 Supplier</option>
                  <option>Aftermarket</option>
                  <option>Industrial</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-400">
                After saving you can immediately <span className="text-cyan-300 font-medium">start a new order</span> from the list below.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerType("Automobile OEM");
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  disabled={!canSave}
                  onClick={createCustomer}
                >
                  Save Customer
                </button>
              </div>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Customer relationships" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Customer" to="Order" label="places" />
              <OntologyEdge from="Customer" to="Part" label="orders" />
              <OntologyEdge from="Customer" to="Dispatch" label="receives" />
              <OntologyEdge from="Customer" to="Traceability" label="terminus of" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Type Breakdown" subtitle="Distinct customer segments" icon={<IconLayers />} />
            <WfCardBody>
              {typeBreakdown.length === 0 ? (
                <EmptyState title="No customers yet" hint="Add a customer to see segment mix." icon={<IconUsers />} />
              ) : (
                <div className="space-y-2">
                  {typeBreakdown.map((row) => {
                    const pct = customers.length ? (row.count / customers.length) * 100 : 0;
                    return (
                      <div key={row.type} className="flex items-center gap-3">
                        <div className="text-xs text-slate-300 w-32 truncate">{row.type}</div>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-indigo-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-200 w-8 text-right">{row.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader
          title="Customer Directory"
          subtitle={`${filtered.length} of ${customers.length} shown`}
          icon={<IconList />}
          right={
            <div className="flex items-center gap-2">
              <div className="relative">
                <IconSearchInline />
                <input
                  className="wf-input pl-9"
                  placeholder="Search customers…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ minWidth: 240 }}
                />
              </div>
            </div>
          }
        />
        <WfCardBody>
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={customers.length === 0 ? "No customers yet" : "No matches"}
              hint={customers.length === 0 ? "Add a customer above to anchor the workflow." : "Try a different search term."}
              icon={<IconUsers />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-semibold">Customer ID</th>
                    <th className="text-left py-2 px-3 font-semibold">Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Type</th>
                    <th className="text-left py-2 px-3 font-semibold">Open Orders</th>
                    <th className="text-right py-2 px-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const oc = ordersByCustomer[c.customer_id] || 0;
                    return (
                      <tr key={c.customer_id} className="border-b border-white/5 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-200">{c.customer_id}</td>
                        <td className="py-2.5 px-3 text-slate-100">{c.customer_name}</td>
                        <td className="py-2.5 px-3">
                          <StatusPill kind="info">{c.customer_type || "—"}</StatusPill>
                        </td>
                        <td className="py-2.5 px-3">
                          {oc > 0 ? (
                            <span className="text-slate-200 font-mono">{oc}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                            onClick={() => startWorkflow(c)}
                          >
                            Start Order →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

function IconUsers()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 19c0-2.5 2.5-4 4-4s4 1.5 4 4"/></svg>; }
function IconUserPlus() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="4"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M19 8v6M16 11h6"/></svg>; }
function IconLink()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>; }
function IconLayers()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>; }
function IconOrder()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>; }
function IconAtom()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconList()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }
function IconSearchInline() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default CustomerMaster;
