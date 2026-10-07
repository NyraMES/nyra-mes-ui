import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { userCanAccessAcMasters } from "../utils/acPrivileges";
import {
  createAcKiln,
  createAcKilnParameter,
  createAcRawMaterialType,
  createAcResource,
  fetchAcMasters,
  fetchAcRawMaterialTypes,
  formatAcApiError,
  markAcRawMaterialTypeObsolete,
  updateAcRawMaterialType,
  updateAcResource,
  fetchAcUtilizationRag,
  saveAcUtilizationRag
} from "../../../services/activatedCarbonApi";
import { AC_KILN_PARAMETER_DEFINITIONS } from "../constants/kilnParameters";
import { AC_KILN_UOM_OPTIONS } from "../constants/uomOptions";
import RawMaterialProcessFlowEditor from "../components/RawMaterialProcessFlowEditor";
import AcAlert from "../components/AcAlert";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcManufacturingFlowGuide from "../components/AcManufacturingFlowGuide";
import AcInboundAdminPanel from "../components/AcInboundAdminPanel";
import AcOntologyAdminPanel from "../components/AcOntologyAdminPanel";
import AcPermissionNotice from "../components/AcPermissionNotice";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";
import { keepGrCoconutShellTypes } from "../utils/acGrCoconutShell";

import "../styles/acMasters.css";

const STATION_LABELS = {
  destoning: "Destoning",
  screening: "Screening",
  dedusting: "De-dusting",
  crushing: "Crushing",
  demagnetisation: "De-magnetisation",
  blending: "Blending",
  fg_qc: "Finished Goods"
};

function CapacityCell({ row, canEdit, onSave }) {
  const current = row.monthly_capacity_kg ?? 15000;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const dirty = String(current) !== String(value).trim();

  useEffect(() => {
    setValue(String(row.monthly_capacity_kg ?? 15000));
  }, [row.monthly_capacity_kg, row.resource_id]);

  if (!canEdit) {
    return <span className="tabular-nums">{Number(current).toLocaleString()} kg</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min="1"
        className="w-[6.5rem] rounded border border-slate-300 px-2 py-1 text-slate-900 tabular-nums"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
      />
      <button
        type="button"
        className="text-xs font-medium text-blue-800 disabled:text-slate-400"
        disabled={!dirty || saving}
        onClick={async () => {
          const n = parseInt(value, 10);
          if (!Number.isFinite(n) || n < 1) return;
          setSaving(true);
          try {
            await onSave(row, n);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "…" : "Save"}
      </button>
    </span>
  );
}

function ResourceTable({ rows, emptyLabel, showHeadcount = false, showStation = false, canEdit = false, onSaveCapacity }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-600">{emptyLabel}</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="py-2">Code</th>
          <th className="py-2">Name</th>
          {showStation ? <th className="py-2">Process</th> : null}
          {showStation ? <th className="py-2">Machines</th> : null}
          {showStation ? <th className="py-2">Monthly capacity</th> : null}
          {showHeadcount ? <th className="py-2">Available operators</th> : null}
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.resource_id || r.resource_code} className="border-b border-slate-100">
            <td className="py-2 font-mono">{r.resource_code}</td>
            <td className="py-2">{r.resource_name}</td>
            {showStation ? (
              <td className="py-2 text-slate-700">{STATION_LABELS[r.station] || r.station || "—"}</td>
            ) : null}
            {showStation ? (
              <td className="py-2 text-slate-700 tabular-nums">{r.unit_count ?? 1}</td>
            ) : null}
            {showStation ? (
              <td className="py-2 text-slate-700">
                <CapacityCell row={r} canEdit={canEdit} onSave={onSaveCapacity} />
              </td>
            ) : null}
            {showHeadcount ? (
              <td className="py-2 text-slate-700">{r.headcount ?? "—"}</td>
            ) : null}
            <td className="py-2">{r.status || "ACTIVE"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KilnTable({ kilns, equipment, emptyLabel, canEdit = false, onSaveCapacity }) {
  if (!kilns?.length) {
    return <p className="text-sm text-slate-600">{emptyLabel}</p>;
  }
  const eqByResource = new Map(
    (equipment || [])
      .filter((eq) => eq.resource_id)
      .map((eq) => [String(eq.resource_id), eq])
  );
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="py-2">Kiln name</th>
          <th className="py-2">Reference</th>
          <th className="py-2">Machine ID</th>
          <th className="py-2">Monthly capacity</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {kilns.map((k) => {
          const eq = eqByResource.get(String(k.resource_id));
          return (
            <tr key={k.resource_id || k.resource_code} className="border-b border-slate-100">
              <td className="py-2 text-slate-900">{k.resource_name}</td>
              <td className="py-2 font-mono text-slate-700">{k.resource_code}</td>
              <td className="py-2 font-mono text-slate-600">{eq?.equipment_code || "—"}</td>
              <td className="py-2 text-slate-700">
                <CapacityCell row={k} canEdit={canEdit} onSave={onSaveCapacity} />
              </td>
              <td className="py-2">{k.status || "ACTIVE"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MastersPage() {
  const { user } = useAuth();
  const canManageMasters = userCanAccessAcMasters(user?.roles || [], user);
  const canConfigureProcess = canManageMasters;

  const location = useLocation();
  const navigate = useNavigate();
  const defaultTab = "raw-material-types";
  const initialTab =
    new URLSearchParams(location.search).get("tab") || defaultTab;
  const [tab, setTab] = useState(initialTab);
  const [kilnParams, setKilnParams] = useState(AC_KILN_PARAMETER_DEFINITIONS);
  const [routingMaster, setRoutingMaster] = useState(null);
  const [rawMaterialTypes, setRawMaterialTypes] = useState([]);
  const [plantResources, setPlantResources] = useState({
    kilns: [],
    machines: [],
    tools: [],
    labor_pools: [],
    equipment: []
  });
  const [kilnName, setKilnName] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceType, setResourceType] = useState("TOOL");
  const [laborHeadcount, setLaborHeadcount] = useState("4");
  const [resourceStation, setResourceStation] = useState("screening");
  const [resourceUnitCount, setResourceUnitCount] = useState("1");
  const [resourceMonthlyCapacity, setResourceMonthlyCapacity] = useState("15000");
  const [kilnMonthlyCapacity, setKilnMonthlyCapacity] = useState("15000");
  const [ragGreen, setRagGreen] = useState("90");
  const [ragAmber, setRagAmber] = useState("70");
  const [ragRed, setRagRed] = useState("70");
  const [paramKey, setParamKey] = useState("");
  const [paramLabel, setParamLabel] = useState("");
  const [paramUnit, setParamUnit] = useState("");
  const [paramUnitCustom, setParamUnitCustom] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [idsDialog, setIdsDialog] = useState({
    open: false,
    title: "Record created",
    subtitle: "",
    items: []
  });

  const showCreatedIds = (title, subtitle, items) => {
    setIdsDialog({ open: true, title, subtitle, items });
  };

  const closeIdsDialog = () => {
    setIdsDialog((prev) => ({ ...prev, open: false, items: [] }));
  };

  const reloadKilnParams = async () => {
    const masters = await fetchAcMasters();
    if (masters.kiln_parameter_definitions?.length) {
      setKilnParams(masters.kiln_parameter_definitions);
    }
    setRoutingMaster(masters.routing_master || null);
    setPlantResources({
      kilns: masters.kilns || [],
      machines: masters.machines || [],
      tools: masters.tools || [],
      labor_pools: masters.labor_pools || [],
      equipment: masters.equipment || []
    });
    setRawMaterialTypes(keepGrCoconutShellTypes(await fetchAcRawMaterialTypes()));
    try {
      const rag = await fetchAcUtilizationRag();
      if (rag) {
        setRagGreen(String(rag.green_min_pct ?? 90));
        setRagAmber(String(rag.amber_min_pct ?? 70));
        setRagRed(String(rag.red_below_pct ?? rag.amber_min_pct ?? 70));
      }
    } catch {
      /* dashboard still uses ISA-95 defaults */
    }
  };

  useEffect(() => {
    const nextTab = new URLSearchParams(location.search).get("tab");
    if (nextTab) setTab(nextTab);
  }, [location.search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await reloadKilnParams();
      } catch (e) {
        setError(formatAcApiError(e, "Failed to load masters data"));
      } finally {
        setLoading(false);
      }
    })();
  }, [location.key]);

  const handleSaveKilnParameter = async () => {
    if (!paramLabel.trim()) return;
    const key =
      paramKey.trim() ||
      paramLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    if (!key) return;
    const unit =
      paramUnit === "__custom__"
        ? paramUnitCustom.trim()
        : paramUnit.trim();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await createAcKilnParameter({
        key,
        label: paramLabel.trim(),
        unit: unit || undefined
      });
      setSuccess(`Parameter ${row.key} added to catalog`);
      setParamKey("");
      setParamLabel("");
      setParamUnit("");
      setParamUnitCustom("");
      await reloadKilnParams();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRawMaterialType = async (payload) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await createAcRawMaterialType(payload);
      showCreatedIds(
        "Raw material type saved",
        "Codes assigned from PostgreSQL sequences.",
        [
          { label: "Raw material code", value: row.product_code },
          { label: "Raw material name", value: row.product_name },
          { label: "Finished product code", value: row.finished_product_code || "—" },
          { label: "Routing code", value: row.routing_code || "—" }
        ]
      );
      await reloadKilnParams();
      return row;
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRawMaterialType = async (productId, payload) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await updateAcRawMaterialType(productId, payload);
      setSuccess(`Routing map saved for ${row.product_name}`);
      await reloadKilnParams();
      return row;
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRawMaterialTypeObsolete = async (productId) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await markAcRawMaterialTypeObsolete(productId);
      setSuccess(
        `${row.product_name} marked obsolete — historical reports unchanged; new inward blocked.`
      );
      await reloadKilnParams();
      return row;
    } catch (e) {
      setError(formatAcApiError(e, "Could not mark material obsolete"));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKiln = async () => {
    if (!kilnName.trim()) {
      setError("Enter a kiln name (e.g. Activation Kiln 02).");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await createAcKiln({
        kiln_name: kilnName.trim(),
        monthly_capacity_kg: parseInt(kilnMonthlyCapacity, 10) || 15000
      });
      showCreatedIds(
        "Kiln registered",
        "Resource and equipment codes assigned automatically (RES-KILN-* / EQ-KILN-*).",
        [
          { label: "Kiln resource", value: row.resource_code },
          { label: "Equipment", value: row.equipment_code },
          { label: "Kiln name", value: row.resource_name || kilnName.trim() },
          { label: "Monthly capacity", value: `${row.monthly_capacity_kg ?? 15000} kg` },
          { label: "Status", value: row.status || "ACTIVE" }
        ]
      );
      setKilnName("");
      setKilnMonthlyCapacity("15000");
      await reloadKilnParams();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResource = async () => {
    if (!resourceName.trim()) {
      setError("Enter a resource name.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        resource_name: resourceName.trim(),
        resource_type: resourceType,
        status: "ACTIVE"
      };
      if (resourceType === "LABOR") {
        const n = parseInt(laborHeadcount, 10);
        if (!Number.isFinite(n) || n < 1) {
          setError("Enter available operators (1 or more) for the labor pool.");
          setSaving(false);
          return;
        }
        payload.headcount = n;
      }
      if (resourceType === "MACHINE") {
        if (!resourceStation) {
          setError("Select which process this machine is used on.");
          setSaving(false);
          return;
        }
        const n = parseInt(resourceUnitCount, 10);
        if (!Number.isFinite(n) || n < 1) {
          setError("Enter how many machines (1 or more).");
          setSaving(false);
          return;
        }
        payload.station = resourceStation;
        payload.unit_count = n;
        const cap = parseInt(resourceMonthlyCapacity, 10);
        if (!Number.isFinite(cap) || cap < 1) {
          setError("Enter monthly designed capacity in kg (1 or more).");
          setSaving(false);
          return;
        }
        payload.monthly_capacity_kg = cap;
      }
      const row = await createAcResource(payload);
      const items = [
        { label: "Resource code", value: row.resource_code },
        { label: "Name", value: row.resource_name },
        { label: "Type", value: row.resource_type },
        { label: "Status", value: row.status || "ACTIVE" }
      ];
      if (row.equipment_code) {
        items.splice(1, 0, { label: "Equipment", value: row.equipment_code });
      }
      if (row.headcount != null) {
        items.push({ label: "Available operators", value: String(row.headcount) });
      }
      if (row.station) {
        items.push({ label: "Process", value: STATION_LABELS[row.station] || row.station });
      }
      if (row.unit_count != null) {
        items.push({ label: "Machines", value: String(row.unit_count) });
      }
      if (row.monthly_capacity_kg != null) {
        items.push({ label: "Monthly capacity", value: `${row.monthly_capacity_kg} kg` });
      }
      showCreatedIds(
        "Plant resource registered",
        "Codes use 3-digit suffixes (e.g. RES-LAB-001). Labor capacity is a headcount, not hours.",
        items
      );
      setResourceName("");
      setResourceMonthlyCapacity("15000");
      await reloadKilnParams();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonthlyCapacity = async (row, kg) => {
    setError("");
    setSuccess("");
    try {
      await updateAcResource(row.resource_id, { monthly_capacity_kg: kg });
      setSuccess(
        `Monthly designed capacity for ${row.resource_name || row.resource_code} set to ${kg.toLocaleString()} kg`
      );
      await reloadKilnParams();
    } catch (e) {
      setError(formatAcApiError(e, "Could not save monthly capacity"));
      throw e;
    }
  };

  const handleSaveUtilizationRag = async () => {
    const green = parseInt(ragGreen, 10);
    const amber = parseInt(ragAmber, 10);
    const red = parseInt(ragRed, 10);
    if (![green, amber, red].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
      setError("Red, amber, and green limits must be between 0 and 100.");
      return;
    }
    if (amber > green) {
      setError("Amber % must be less than green %.");
      return;
    }
    if (red > amber) {
      setError("Red-below % cannot be higher than amber %.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await saveAcUtilizationRag({
        green_min_pct: green,
        amber_min_pct: amber,
        red_below_pct: red
      });
      setRagGreen(String(row.green_min_pct));
      setRagAmber(String(row.amber_min_pct));
      setRagRed(String(row.red_below_pct));
      setSuccess(
        `Utilization range saved — red below ${row.red_below_pct}%, amber from ${row.amber_min_pct}%, green from ${row.green_min_pct}%.`
      );
    } catch (e) {
      setError(formatAcApiError(e, "Could not save utilization range"));
    } finally {
      setSaving(false);
    }
  };

  const tabs = useMemo(
    () => [
      { id: "raw-material-types", label: "Materials & steps", hint: "Super Admin only" },
      { id: "plant-resources", label: "Machines & kilns", hint: "Plant equipment" },
      { id: "routing", label: "Routing reference", hint: "Read-only summary" },
      { id: "kiln-parameters", label: "Kiln readings", hint: "Shift data fields" },
      { id: "inbound-settings", label: "Inbound settings", hint: "Rotaries & RMS outward" },
      { id: "ontology-ui", label: "Advanced settings", hint: "Super Admin" }
    ],
    []
  );

  const selectTab = (id) => {
    setTab(id);
    navigate({ pathname: location.pathname, search: `?tab=${id}` }, { replace: true });
  };

  if (tab === "customers" || tab === "suppliers") {
    return <Navigate to={`/activated-carbon/admin?tab=${tab}`} replace />;
  }

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
        eyebrow="Setup"
        title="Plant setup"
        subtitle="Raw materials, machines, routing, and kiln readings. Customers and suppliers are under Admin."
      />

      {!canManageMasters && !canConfigureProcess ? (
        <AcPermissionNotice
          title="You can view setup data"
          message="Your account can look up materials and plant equipment. Ask a Super Administrator if something needs to be added or changed."
        />
      ) : null}

      {canManageMasters && !canConfigureProcess ? (
        <AcPermissionNotice
          variant="info"
          title="Administrator access"
          message="You can view plant setup. Adding new raw materials or changing process steps requires nyraservices."
        />
      ) : null}

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <div className="ac-masters-tabs flex flex-wrap gap-2 mb-4 border-b border-white/15">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px text-left ${
              tab === t.id ? "ac-masters-tab--active" : ""
            }`}
            onClick={() => selectTab(t.id)}
            title={t.hint}
          >
            <span className="block">{t.label}</span>
            <span className="block text-[10px] font-normal opacity-70">{t.hint}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Loading masters…</p>
      ) : null}

      {tab === "raw-material-types" && (
        <>
          <WfCard className="mb-6">
            <WfCardHeader
              title="Raw materials and production steps"
              subtitle="Coconut Shell (GR) — Raw material to finished goods. Other raw material types are not used for this plant."
            />
            <WfCardBody>
              {loading ? (
                <p className="text-sm text-slate-600">Loading…</p>
              ) : (
                <RawMaterialProcessFlowEditor
                  materialTypes={rawMaterialTypes}
                  onCreate={handleSaveRawMaterialType}
                  onUpdate={handleUpdateRawMaterialType}
                  onMarkObsolete={handleMarkRawMaterialTypeObsolete}
                  saving={saving}
                  canEdit={canConfigureProcess}
                />
              )}
            </WfCardBody>
          </WfCard>
        </>
      )}

      {tab === "plant-resources" && (
        <>
          {canManageMasters ? (
            <>
              <WfCard className="mb-6">
                <WfCardHeader
                  title="Add activation kiln"
                  subtitle="Enter a name only — codes are assigned automatically."
                />
                <WfCardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <label className="text-sm block">
                      <span className="block mb-1 font-medium text-slate-700">Kiln name</span>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                        value={kilnName}
                        onChange={(e) => setKilnName(e.target.value)}
                        placeholder="e.g. Activation Kiln 02"
                      />
                    </label>
                    <label className="text-sm block">
                      <span className="block mb-1 font-medium text-slate-700">Monthly designed capacity (kg)</span>
                      <input
                        type="number"
                        min="1"
                        className="w-full max-w-[10rem] rounded border border-slate-300 px-3 py-2"
                        value={kilnMonthlyCapacity}
                        onChange={(e) => setKilnMonthlyCapacity(e.target.value)}
                      />
                    </label>
                  </div>
                  <AcSaveBar
                    onSave={handleSaveKiln}
                    saving={saving}
                    saveLabel="Add kiln"
                    disabled={!kilnName.trim()}
                  />
                </WfCardBody>
              </WfCard>

              <WfCard className="mb-6">
                <WfCardHeader
                  title="Register plant resource"
                  subtitle="Name and type only — the system assigns codes for you."
                />
                <WfCardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <label className="text-sm block">
                      <span className="block mb-1 font-medium text-slate-700">Name</span>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                        value={resourceName}
                        onChange={(e) => setResourceName(e.target.value)}
                        placeholder="e.g. Vibrating Screen Line 2"
                      />
                    </label>
                    <label className="text-sm block">
                      <span className="block mb-1 font-medium text-slate-700">Type</span>
                      <select
                        className="w-full rounded border border-slate-300 px-3 py-2"
                        value={resourceType}
                        onChange={(e) => setResourceType(e.target.value)}
                      >
                        <option value="MACHINE">Machine</option>
                        <option value="TOOL">Tool</option>
                        <option value="LABOR">Labor pool</option>
                      </select>
                    </label>
                    {resourceType === "MACHINE" && (
                      <>
                        <label className="text-sm block">
                          <span className="block mb-1 font-medium text-slate-700">Used on</span>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2"
                            value={resourceStation}
                            onChange={(e) => setResourceStation(e.target.value)}
                          >
                            {Object.entries(STATION_LABELS).map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm block">
                          <span className="block mb-1 font-medium text-slate-700">How many machines?</span>
                          <input
                            type="number"
                            min="1"
                            className="w-full max-w-[8rem] rounded border border-slate-300 px-3 py-2"
                            value={resourceUnitCount}
                            onChange={(e) => setResourceUnitCount(e.target.value)}
                          />
                        </label>
                        <label className="text-sm block">
                          <span className="block mb-1 font-medium text-slate-700">Monthly designed capacity (kg)</span>
                          <input
                            type="number"
                            min="1"
                            className="w-full max-w-[10rem] rounded border border-slate-300 px-3 py-2"
                            value={resourceMonthlyCapacity}
                            onChange={(e) => setResourceMonthlyCapacity(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                    {resourceType === "LABOR" && (
                      <label className="text-sm block sm:col-span-2">
                        <span className="block mb-1 font-medium text-slate-700">
                          How many operators in this pool?
                        </span>
                        <input
                          type="number"
                          min="1"
                          className="w-full max-w-[8rem] rounded border border-slate-300 px-3 py-2"
                          value={laborHeadcount}
                          onChange={(e) => setLaborHeadcount(e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <AcSaveBar
                    onSave={handleSaveResource}
                    saving={saving}
                    saveLabel="Add resource"
                    disabled={!resourceName.trim()}
                  />
                </WfCardBody>
              </WfCard>
            </>
          ) : (
            <AcPermissionNotice
              title="View only"
              message="Only a Plant Administrator can register kilns and other equipment."
            />
          )}

          <WfCard className="mb-6">
            <WfCardHeader
              title="Utilization range (red / amber / green)"
              subtitle="ISA-95 L3 bands for month-to-date output vs monthly designed capacity. Does not change inward or lot triplet subjects."
            />
            <WfCardBody>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                <label className="text-sm block">
                  <span className="block mb-1 font-medium text-red-700">Red below (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={ragRed}
                    onChange={(e) => setRagRed(e.target.value)}
                    disabled={!canManageMasters}
                  />
                </label>
                <label className="text-sm block">
                  <span className="block mb-1 font-medium text-amber-700">Amber from (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={ragAmber}
                    onChange={(e) => setRagAmber(e.target.value)}
                    disabled={!canManageMasters}
                  />
                </label>
                <label className="text-sm block">
                  <span className="block mb-1 font-medium text-green-700">Green from (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={ragGreen}
                    onChange={(e) => setRagGreen(e.target.value)}
                    disabled={!canManageMasters}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2 max-w-2xl">
                Default ISA-95: red below 70%, amber 70–90%, green 90% and above of designed monthly kg.
              </p>
              {canManageMasters ? (
                <AcSaveBar onSave={handleSaveUtilizationRag} saving={saving} saveLabel="Save range" />
              ) : null}
            </WfCardBody>
          </WfCard>

          <WfCard className="mb-6">
            <WfCardHeader
              title="Activation kilns"
              subtitle="Registered kilns on your plant floor."
            />
            <WfCardBody>
              <KilnTable
                kilns={plantResources.kilns}
                equipment={plantResources.equipment}
                emptyLabel="No kilns registered yet."
                canEdit={canManageMasters}
                onSaveCapacity={handleSaveMonthlyCapacity}
              />
            </WfCardBody>
          </WfCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <WfCard>
              <WfCardHeader
                title="Other machines"
                subtitle="Screens, conveyors, etc. (not activation kilns). Process time drives equipment occupancy."
              />
              <WfCardBody>
                <ResourceTable
                  rows={plantResources.machines}
                  emptyLabel="No other machines registered."
                  showStation
                  canEdit={canManageMasters}
                  onSaveCapacity={handleSaveMonthlyCapacity}
                />
              </WfCardBody>
            </WfCard>

            <WfCard>
              <WfCardHeader
                title="Tools"
                subtitle="RES-TOOL-* — required per routing operation at feasibility."
              />
              <WfCardBody>
                <ResourceTable rows={plantResources.tools} emptyLabel="No tools registered." />
              </WfCardBody>
            </WfCard>
          </div>

          <WfCard>
            <WfCardHeader
              title="Workforce / labor pools"
              subtitle="Operator headcount (how many people) vs machine process time (how long the kiln runs)."
            />
            <WfCardBody>
              <ResourceTable
                rows={plantResources.labor_pools}
                emptyLabel="No labor pools registered."
                showHeadcount
              />
            </WfCardBody>
          </WfCard>
        </>
      )}

      {tab === "routing" && (
        <WfCard>
          <WfCardHeader
            title="Finished product routing (reference only)"
            subtitle="Read-only seed summary — not the editable routing map."
          />
          <WfCardBody>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <strong>To edit Raw → P1 → P2 → … → Finished goods,</strong> open the{" "}
              <button
                type="button"
                className="font-semibold underline text-blue-800"
                onClick={() => selectTab("raw-material-types")}
              >
                Material &amp; routing
              </button>{" "}
              tab (raw material dropdown on the left, finished product on the right, process flow
              in the center).
            </div>
            {!routingMaster ? (
              <p className="text-sm text-slate-600">
                No routing loaded from API. Default types still use{" "}
                <code className="font-mono text-xs">RT-AC-8x30-V1</code> for product{" "}
                <code className="font-mono text-xs">AC-GRAN-8x30</code>. Run your local seed
                script or add types under <strong>Material &amp; routing</strong>.
              </p>
            ) : (
              <div className="wf-light-panel rounded-xl p-4 space-y-4">
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <strong>Per raw material (Material &amp; routing tab):</strong> Super Admin
                  defines which shop-floor processes apply to each feedstock — kiln feed,
                  screening, destoning, QC — with tracking fields and mandatory/optional flags.
                  Inward and incoming QC are always required on the Raw Material page.
                  <br />
                  <strong>Routing Builder (menu):</strong> optional workspace template reference
                  only — execution follows the raw material type definition above.
                </p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Routing code</dt>
                    <dd className="font-mono text-slate-900">{routingMaster.routing_code}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Version</dt>
                    <dd className="text-slate-900">{routingMaster.routing_version || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Product</dt>
                    <dd className="text-slate-900">
                      {routingMaster.product_code}
                      {routingMaster.product_name ? ` · ${routingMaster.product_name}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Seed file</dt>
                    <dd className="font-mono text-xs text-slate-700">
                      {routingMaster.seed_script || "scripts/db/nyra_sam_carbons_demo_tenant.sql"}
                    </dd>
                  </div>
                </dl>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 w-12">Seq</th>
                      <th className="py-2">Operation</th>
                      <th className="py-2">Code</th>
                      <th className="py-2">Process step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(routingMaster.operations || []).map((op) => (
                      <tr key={op.operation_code} className="border-b border-slate-100">
                        <td className="py-2 text-slate-600">{op.operation_sequence}</td>
                        <td className="py-2 text-slate-900">{op.operation_name}</td>
                        <td className="py-2 font-mono text-slate-700">{op.operation_code}</td>
                        <td className="py-2 font-mono text-slate-600">{op.process_step || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500">
                  Supplier inward receipts are separate from customer sales. After QC, release
                  material to a <strong>make-to-stock</strong> production order, then kiln feed
                  lots on this route (<strong>{routingMaster.product_code}</strong>). Finished
                  goods accumulate in stock when execution completes; customer POs consume stock
                  or receive a tentative date from raw availability.
                </p>
              </div>
            )}
          </WfCardBody>
        </WfCard>
      )}

      {tab === "kiln-parameters" && (
        <>
          {canManageMasters ? (
            <WfCard className="mb-6">
              <WfCardHeader
                title="Add kiln reading field"
                subtitle="New fields appear when operators enter kiln data each shift."
              />
              <WfCardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <label className="text-sm block md:col-span-2">
                    <span className="block mb-1 font-medium text-slate-700">
                      What should operators read on the form?
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 bg-white"
                      value={paramLabel}
                      onChange={(e) => setParamLabel(e.target.value)}
                      placeholder="e.g. CO₂ level (%)"
                    />
                  </label>
                  <label className="text-sm block">
                    <span className="block mb-1 font-medium text-slate-700">Unit</span>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                      value={paramUnit}
                      onChange={(e) => setParamUnit(e.target.value)}
                    >
                      {AC_KILN_UOM_OPTIONS.map((opt) => (
                        <option key={opt.value || "none"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm block">
                    <span className="block mb-1 font-medium text-slate-700">
                      Short code (optional)
                    </span>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                      value={paramKey}
                      onChange={(e) => setParamKey(e.target.value)}
                      placeholder="Auto-generated if blank"
                    />
                  </label>
                  {paramUnit === "__custom__" && (
                    <label className="text-sm block md:col-span-2">
                      <span className="block mb-1 font-medium text-slate-700">Custom unit</span>
                      <input
                        className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                        value={paramUnitCustom}
                        onChange={(e) => setParamUnitCustom(e.target.value)}
                        placeholder="e.g. m³/h"
                      />
                    </label>
                  )}
                </div>
                <AcSaveBar
                  onSave={handleSaveKilnParameter}
                  saving={saving}
                  saveLabel="Add field"
                  disabled={!paramLabel.trim()}
                />
              </WfCardBody>
            </WfCard>
          ) : (
            <AcPermissionNotice
              title="View only"
              message="Only a Plant Administrator can add new kiln reading fields."
            />
          )}

          <WfCard>
            <WfCardHeader
              title="Kiln parameter catalog"
              subtitle="Parameters captured on Execution → Kiln Parameters each shift."
            />
            <WfCardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2">Parameter</th>
                    <th className="py-2">Field key</th>
                    <th className="py-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {kilnParams.map((p) => (
                    <tr key={p.key} className="border-b border-slate-100">
                      <td className="py-2 text-slate-900">{p.label}</td>
                      <td className="py-2 font-mono text-slate-700">{p.key}</td>
                      <td className="py-2 text-slate-600">{p.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WfCardBody>
          </WfCard>
        </>
      )}

      {tab === "inbound-settings" &&
        (canManageMasters || canConfigureProcess ? (
          <AcInboundAdminPanel />
        ) : (
          <AcPermissionNotice
            title="Inbound settings"
            message="Rotary inventory and RM outward splits can be changed by a Plant Administrator or Super Administrator."
          />
        ))}

      {tab === "ontology-ui" &&
        (canConfigureProcess ? (
          <AcOntologyAdminPanel />
        ) : (
          <AcPermissionNotice
            title="Advanced settings — Super Administrator only"
            message="Dashboard layout and ontology configuration can only be changed by a Super Administrator."
          />
        ))}

      <details className="mt-10 wf-ac-flow-guide-collapse">
        <summary className="text-sm font-medium text-slate-300 cursor-pointer py-2">
          Need help? How the plant workflow fits together
        </summary>
        <AcManufacturingFlowGuide className="mt-2" />
      </details>
    </div>
  );
}

export default MastersPage;
