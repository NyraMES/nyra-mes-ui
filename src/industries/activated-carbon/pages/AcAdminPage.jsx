import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createAcSupplier, fetchAcSuppliers, formatAcApiError } from "../../../services/activatedCarbonApi";
import { useAuth } from "../../../auth/AuthContext";
import AcAlert from "../components/AcAlert";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcFriendlyRegistryList from "../components/AcFriendlyRegistryList";
import AcSimpleMasterForm from "../components/AcSimpleMasterForm";
import AcDestoningCtcPanel from "../components/AcDestoningCtcPanel";
import AcKilnSetpointsPanel from "../components/AcKilnSetpointsPanel";
import AcWorkOrdersPanel from "../components/AcWorkOrdersPanel";
import AcInStockWorkOrderPanel from "../components/AcInStockWorkOrderPanel";
import { userCanAccessAcAdmin } from "../utils/acPrivileges";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";
import AcUsersPage from "./AcUsersPage";

import "../styles/acMasters.css";

const ADMIN_TABS = [
  { id: "users", label: "Users", hint: "Create plant logins" },
  { id: "suppliers", label: "Suppliers", hint: "Who delivers raw material" },
  { id: "destoning-ctc", label: "Destoner CTC allocation", hint: "Daily destoner CTC" },
  { id: "kiln-parameters", label: "Kiln parameters", hint: "Standing kiln setpoints" },
  { id: "work-orders", label: "Work orders", hint: "Grade, CTC, and quantity" },
  { id: "in-stock-work-order", label: "Stock Reallocation", hint: "Move stock to the same grade" }
];

function adminTabFromSearch(search, tabs) {
  const tab = new URLSearchParams(search || "").get("tab");
  if (tab === "customers" || tab === "kiln-ctc") return "work-orders";
  if (tabs.some((row) => row.id === tab)) return tab;
  return tabs[0]?.id || "users";
}

function AcAdminPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = userCanAccessAcAdmin(user?.roles || [], user);
  const tabs = canManage ? ADMIN_TABS : [];
  const tab = adminTabFromSearch(location.search, tabs.length ? tabs : ADMIN_TABS);

  const [suppliers, setSuppliers] = useState([]);
  const [supplierName, setSupplierName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [idsDialog, setIdsDialog] = useState({
    open: false,
    title: "Record created",
    subtitle: "",
    items: []
  });

  const selectTab = (id) => {
    navigate({ pathname: location.pathname, search: `?tab=${id}` }, { replace: true });
  };

  const showCreatedIds = (title, subtitle, items) => {
    setIdsDialog({ open: true, title, subtitle, items });
  };

  const closeIdsDialog = () => {
    setIdsDialog((prev) => ({ ...prev, open: false, items: [] }));
  };

  const reloadSuppliers = async () => {
    setSuppliers(await fetchAcSuppliers());
  };

  useEffect(() => {
    if (tab !== "suppliers") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await reloadSuppliers();
      } catch (err) {
        if (!cancelled) setError(formatAcApiError(err, "Could not load records"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const handleSaveSupplier = async () => {
    if (!canManage || !supplierName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const row = await createAcSupplier({ supplier_name: supplierName.trim() });
      showCreatedIds(
        "Supplier created",
        "Supplier code assigned from sequence (SUP-AC-*).",
        [
          { label: "Supplier code", value: row.supplier_code },
          { label: "Supplier name", value: row.supplier_name },
          { label: "Status", value: row.status || "ACTIVE" }
        ]
      );
      setSupplierName("");
      await reloadSuppliers();
    } catch (err) {
      setError(formatAcApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <AcCreatedIdsDialog
        open={idsDialog.open}
        title={idsDialog.title}
        subtitle={idsDialog.subtitle}
        items={idsDialog.items}
        continueLabel="Done"
        onContinue={closeIdsDialog}
        onClose={closeIdsDialog}
      />
      <SectionHeader
        title="Admin"
        subtitle="Users, suppliers, destoner CTC allocation, kiln parameters, work orders, and stock reallocation."
      />

      <div className="ac-masters-tabs flex flex-wrap gap-2 mb-6 border-b border-white/15">
        {ADMIN_TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px text-left ${
              tab === row.id ? "ac-masters-tab--active" : ""
            }`}
            onClick={() => selectTab(row.id)}
            title={row.hint}
          >
            <span className="block">{row.label}</span>
            <span className="block text-[10px] font-normal opacity-70">{row.hint}</span>
          </button>
        ))}
      </div>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      {tab === "users" ? <AcUsersPage embedded /> : null}
      {tab === "destoning-ctc" ? <AcDestoningCtcPanel canEdit={canManage} /> : null}
      {tab === "kiln-parameters" ? <AcKilnSetpointsPanel canEdit={canManage} /> : null}
      {tab === "work-orders" ? <AcWorkOrdersPanel canEdit={canManage} /> : null}
      {tab === "in-stock-work-order" ? <AcInStockWorkOrderPanel canEdit={canManage} /> : null}

      {tab === "suppliers" ? (
        <>
          <div className="mb-6">
            <AcSimpleMasterForm
              step={1}
              title="Add a supplier"
              helpText="Suppliers deliver raw material to your plant. Enter their name — the system assigns a supplier code automatically."
              fieldLabel="Supplier company name"
              placeholder="e.g. Coastal Shell Traders"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              onSave={handleSaveSupplier}
              saving={saving}
              saveLabel="Add supplier"
            />
          </div>
          <WfCard>
            <WfCardHeader
              title="Supplier list"
              subtitle={`${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} registered`}
            />
            <WfCardBody>
              {loading ? (
                <p className="text-sm text-slate-600">Loading suppliers…</p>
              ) : (
                <AcFriendlyRegistryList
                  items={suppliers}
                  idKey="supplier_id"
                  nameKey="supplier_name"
                  codeKey="supplier_code"
                  emptyLabel="No suppliers yet. Add one using the form above — they appear when recording raw material inward."
                />
              )}
            </WfCardBody>
          </WfCard>
        </>
      ) : null}
    </div>
  );
}

export default AcAdminPage;
