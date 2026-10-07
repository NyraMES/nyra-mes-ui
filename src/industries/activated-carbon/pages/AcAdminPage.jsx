import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  createAcCustomer,
  createAcSupplier,
  fetchAcCustomers,
  fetchAcSuppliers,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { useAuth } from "../../../auth/AuthContext";
import AcAlert from "../components/AcAlert";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcFriendlyRegistryList from "../components/AcFriendlyRegistryList";
import AcPermissionNotice from "../components/AcPermissionNotice";
import AcSimpleMasterForm from "../components/AcSimpleMasterForm";
import { userCanAccessAcAdmin } from "../utils/acPrivileges";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";
import AcUsersPage from "./AcUsersPage";

import "../styles/acMasters.css";

const TABS = [
  { id: "users", label: "Users", hint: "Create plant logins" },
  { id: "customers", label: "Customer", hint: "Who you sell to" },
  { id: "suppliers", label: "Supplier", hint: "Who delivers raw material" }
];

function adminTabFromSearch(search) {
  const tab = new URLSearchParams(search || "").get("tab");
  if (TABS.some((row) => row.id === tab)) return tab;
  return "users";
}

function AcAdminPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = userCanAccessAcAdmin(user?.roles || [], user);
  const tab = adminTabFromSearch(location.search);

  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customerName, setCustomerName] = useState("");
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

  const reloadCustomers = async () => {
    setCustomers(await fetchAcCustomers());
  };

  const reloadSuppliers = async () => {
    setSuppliers(await fetchAcSuppliers());
  };

  useEffect(() => {
    if (tab !== "customers" && tab !== "suppliers") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (tab === "customers") await reloadCustomers();
        if (tab === "suppliers") await reloadSuppliers();
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

  const handleSaveCustomer = async () => {
    if (!canManage || !customerName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const row = await createAcCustomer({ customer_name: customerName.trim() });
      showCreatedIds(
        "Customer created",
        "Customer code assigned from sequence (CUST-AC-*).",
        [
          { label: "Customer code", value: row.customer_code },
          { label: "Customer name", value: row.customer_name },
          { label: "Status", value: row.status || "ACTIVE" }
        ]
      );
      setCustomerName("");
      await reloadCustomers();
    } catch (err) {
      setError(formatAcApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

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
        subtitle="Users, customers, and suppliers for this plant."
      />

      <div className="ac-masters-tabs flex flex-wrap gap-2 mb-6 border-b border-white/15">
        {TABS.map((row) => (
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

      {tab === "customers" ? (
        <>
          {canManage ? (
            <div className="mb-6">
              <AcSimpleMasterForm
                step={1}
                title="Add a customer"
                helpText="Type the company name only. The system creates a customer code for you — no need to remember numbers."
                fieldLabel="Customer company name"
                placeholder="e.g. Acme Carbon Ltd"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onSave={handleSaveCustomer}
                saving={saving}
                saveLabel="Add customer"
              />
            </div>
          ) : (
            <AcPermissionNotice
              title="Cannot add customers"
              message="Only an Administrator can register new customers."
            />
          )}
          <WfCard>
            <WfCardHeader
              title="Customer list"
              subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"} registered`}
            />
            <WfCardBody>
              {loading ? (
                <p className="text-sm text-slate-600">Loading customers…</p>
              ) : (
                <AcFriendlyRegistryList
                  items={customers}
                  idKey="customer_id"
                  nameKey="customer_name"
                  codeKey="customer_code"
                  emptyLabel="No customers yet. Add one using the form above."
                />
              )}
            </WfCardBody>
          </WfCard>
        </>
      ) : null}

      {tab === "suppliers" ? (
        <>
          {canManage ? (
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
          ) : (
            <AcPermissionNotice
              title="Cannot add suppliers"
              message="Only an Administrator can register new suppliers."
            />
          )}
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
