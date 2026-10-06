import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import WorkOrderCaptureForm from "../../components/WorkOrderCaptureForm";
import AcExecutionParameterCapture from "../../industries/activated-carbon/components/AcExecutionParameterCapture";
import AcExecutionKilnFeedPanel from "../../industries/activated-carbon/components/AcExecutionKilnFeedPanel";
import AcProcessMapTabs from "../../industries/activated-carbon/components/AcProcessMapTabs";
import AcKilnOutputLabelsList from "../../industries/activated-carbon/components/AcKilnOutputLabelsList";
import AcExecutionScreeningPanel from "../../industries/activated-carbon/components/AcExecutionScreeningPanel";
import AcExecutionGradeSeparationPanel from "../../industries/activated-carbon/components/AcExecutionGradeSeparationPanel";
import AcExecutionQualityPanel from "../../industries/activated-carbon/components/AcExecutionQualityPanel";
import { formatApiError } from "../../services/api";
import {
  appendMesCoreParameterReadings,
  completeMesCoreExecution,
  fetchMesCoreExecutionSummary,
  fetchMesCoreProductionLots,
  holdMesCoreExecution,
  resumeMesCoreExecution,
  startMesCoreExecution,
} from "../../services/mesCoreApi";
import { fetchAcMasters, fetchAcRoutingLots, createAcScreening, createAcGradeSeparation, createAcQualityTest, formatAcLotOptionLabel } from "../../services/activatedCarbonApi";
import useAcPageRefresh from "../../industries/activated-carbon/hooks/useAcPageRefresh";
import {
  normalizeAcExecutionOperations,
  summarizeAcExecution,
  getAcExecutionUiFlags,
  resolveAcExecutionOperatorName,
  buildAcParameterReadings,
  resolveAcProcessStep,
  isAcOptionalOperation,
  hasAcStepSpecificCapture,
  isAcKilnFeedUiStep,
  isAcKilnFeedQualityStep,
  isAcKilnOutputQualityStep,
  isAcKilnTempStep,
  isAcDestoningStep,
  isAcDestoningQualityStep,
  isAcPostActivationLiveStep,
  isAcPostActivationQualityStep,
  postActivationProcessKey,
  acProcessTabKey,
  acProcessMapTabs,
  acProcessTabsForStage,
  acExecutionStageOf,
  unlockAcAnyOrderStart
} from "../../industries/activated-carbon/utils/acExecutionOperations";
import AcKilnFeedQualityPanel from "../../industries/activated-carbon/components/AcKilnFeedQualityPanel";
import AcKilnOutputQualityPanel from "../../industries/activated-carbon/components/AcKilnOutputQualityPanel";
import AcDestoningPanel from "../../industries/activated-carbon/components/AcDestoningPanel";
import AcDestoningQualityPanel from "../../industries/activated-carbon/components/AcDestoningQualityPanel";
import AcPostActivationLivePanel from "../../industries/activated-carbon/components/AcPostActivationLivePanel";
import AcPostActivationQualityPanel from "../../industries/activated-carbon/components/AcPostActivationQualityPanel";
import AcSectionReportsPanel from "../../industries/activated-carbon/components/AcSectionReportsPanel";
import AcKilnParametersPanel from "../../industries/activated-carbon/components/AcKilnParametersPanel";
import {
  loadAcProductRoutingForExecution,
  loadAcShopProcessMapForExecution
} from "../../industries/activated-carbon/utils/acRoutingResolver";
import useWorkflowNavPaths from "../../hooks/useWorkflowNavPaths";
import { useAuth } from "../../auth/AuthContext";
import {
  acExecutionStagesForRoles,
  acOperationVisibleForRoles,
  userCanAccessAcActivation,
  userIsAcQualityOnly
} from "../../industries/activated-carbon/utils/acPrivileges";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  ContextBanner,
  OntologyEdge,
  EmptyState
} from "../ui";
import FlowDiagram from "../FlowDiagram";


const EMPTY_AC_ROLES = [];

function statusKind(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) return "ok";
  if (s.includes("progress")) return "info";
  if (s.includes("hold")) return "neutral";
  if (s.includes("ready")) return "warn";
  return "neutral";
}

function mapWoStatus(dbStatus) {
  const s = String(dbStatus || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (s === "released" || s === "ready") return "Ready";
  if (s === "inprogress") return "In Progress";
  if (s === "completed") return "Completed";
  if (s === "onhold") return "On Hold";
  return dbStatus || "Pending";
}

function recomputeCanStart(ops) {
  const sorted = [...ops].sort((a, b) => (a.seq ?? 999999) - (b.seq ?? 999999));
  return sorted.map((op) => {
    if (op.status !== "Ready") return { ...op, can_start: false };
    const seq = op.seq ?? 999999;
    const blocked = sorted.some(
      (p) => (p.seq ?? 999999) < seq && p.status !== "Completed"
    );
    return { ...op, can_start: !blocked };
  });
}

function applyWoToOperations(ops, woCode, wo, { anyOrder = false } = {}) {
  if (!wo) return ops;
  const merged = ops.map((op) => {
    const id = op.work_order_id || op.lot_operation_id;
    if (id !== woCode) return op;
    const status = mapWoStatus(wo.work_order_status);
    return {
      ...op,
      status,
      work_order_status: wo.work_order_status,
      started_at: wo.started_at,
      completed_at: wo.completed_at,
      actual_output_quantity: wo.actual_output_quantity,
      scrap_quantity: wo.scrap_quantity,
      rework_quantity: wo.rework_quantity,
      operator_name: wo.operator_name ?? op.operator_name,
      actual_machine_id: wo.actual_machine_id ?? op.actual_machine_id,
      actual_labor_pool_code: wo.actual_labor_pool_code ?? op.actual_labor_pool_code,
      actual_tool_codes: wo.actual_tool_codes ?? op.actual_tool_codes,
      downtime_minutes: wo.downtime_minutes ?? op.downtime_minutes,
      can_start: false
    };
  });
  return anyOrder ? unlockAcAnyOrderStart(merged) : recomputeCanStart(merged);
}

function ExecutionScreen({ variant = "default" }) {
  const { context, markStage, update } = useWorkflow();
  const nav = useWorkflowNavPaths();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const acRoles = user?.roles || EMPTY_AC_ROLES;
  const { locationKey } = useAcPageRefresh();
  const isAcExecution = pathname.startsWith("/activated-carbon");
  const isAcUnified = isAcExecution && variant === "ac-unified";
  const execStage =
    new URLSearchParams(search || "").get("stage") === "post_activation"
      ? "post_activation"
      : "activation";
  const acExecTab = isAcUnified ? new URLSearchParams(search || "").get("tab") || "" : "";
  const acReportsOpen = acExecTab === "reports";
  const acQualityOnly = isAcUnified && userIsAcQualityOnly(acRoles);
  const acKilnParamsOpen =
    execStage === "activation" && acExecTab === "kiln-parameters" && !acQualityOnly;
  const setAcExecTab = (tab) => {
    const params = new URLSearchParams(search || "");
    if (tab) params.set("tab", tab);
    else params.delete("tab");
    const next = params.toString();
    navigate({ pathname, search: next ? `?${next}` : "" }, { replace: true });
  };
  const acCanRunMachines = isAcUnified && !acQualityOnly;

  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const [operatorName, setOperatorName] = useState("");
  const [summary, setSummary] = useState(null);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [appendSaving, setAppendSaving] = useState(false);
  const appendCaptureRef = useRef(null);
  const [executionReady, setExecutionReady] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState("");

  const [outputQty, setOutputQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [downtimeMin, setDowntimeMin] = useState("");
  const [machineId, setMachineId] = useState("");
  const [laborPoolCode, setLaborPoolCode] = useState("");
  const [selectedToolCodes, setSelectedToolCodes] = useState([]);
  const [plantResources, setPlantResources] = useState({
    machines: [],
    tools: [],
    labor_pools: []
  });
  const [holdReason, setHoldReason] = useState("");
  const captureRef = useRef(null);
  const stepExtraRef = useRef(null);
  const loadGenRef = useRef(0);

  useEffect(() => {
    const loader = isAcUnified
      ? async () => {
          const { fetchAcExecutionLots } = await import("../../services/activatedCarbonApi");
          return fetchAcExecutionLots();
        }
      : isAcExecution
        ? fetchAcRoutingLots
        : fetchMesCoreProductionLots;
    loader()
      .then((rows) => setLots(rows || []))
      .catch(() => setLots([]));
    fetchAcMasters()
      .then((masters) => {
        setPlantResources({
          machines: masters.machines || masters.kilns || [],
          tools: masters.tools || [],
          labor_pools: masters.labor_pools || []
        });
        if (isAcUnified && !lotId) {
          const types = masters.raw_material_types || [];
          const type =
            types.find((t) => String(t.product_code || "").toUpperCase() === "RAW-COCO-SHELL") ||
            types.find((t) => !t.is_obsolete && t.operations?.length);
          if (type?.operations?.length) {
            const mapped = unlockAcAnyOrderStart(
              normalizeAcExecutionOperations([], {
                operations: type.operations,
                process_parameters: type.process_parameters || []
              })
            );
            setOperations((prev) => (prev.length ? prev : mapped));
          }
        }
      })
      .catch(() => {});
  }, [locationKey, isAcExecution, isAcUnified]);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId, lotId]);

  useEffect(() => {
    if (!isAcUnified || lotId || !lots.length) return;
    const charged = lots.find((row) => {
      const meta = row.metadata || row.metadata_ || {};
      return Boolean(
        meta.charged_at ||
          row.charged_at ||
          meta.kiln_live_status === "IN_KILN" ||
          (row.kiln_feed_events || []).length
      );
    });
    const pick = charged || lots[0];
    const code = pick?.lot_id || pick?.lot_code;
    if (code) selectLot(code);
  }, [isAcUnified, lots, lotId]);

  const selectLot = (value) => {
    setLotId(value);
    if (value) update({ lotId: value });
  };

  useEffect(() => {
    if (lotId) loadSummary({ sync: !isAcUnified });
    else {
      setSummary(null);
      setOperations([]);
      setSelectedWoId("");
    }
  }, [lotId]);

  const woId = (op) => op?.work_order_id || op?.lot_operation_id;
  const tabKey = (op) => (isAcUnified ? acProcessTabKey(op) : woId(op));

  const sortedOperations = useMemo(() => {
    return [...operations].sort((a, b) => {
      const sa = a.seq ?? 999999;
      const sb = b.seq ?? 999999;
      if (sa !== sb) return sa - sb;
      return String(woId(a)).localeCompare(String(woId(b)));
    });
  }, [operations]);

  const nextStartableOp = useMemo(
    () => sortedOperations.find((o) => o.can_start && o.status === "Ready") || null,
    [sortedOperations]
  );

  const pickDefaultWoId = (ops, preferId) => {
    const pool = isAcUnified ? acProcessTabsForStage(ops, execStage) : ops;
    if (preferId && pool.some((o) => tabKey(o) === preferId || woId(o) === preferId)) {
      return preferId;
    }
    if (isAcUnified && execStage === "activation") {
      const feed = pool.find((o) => isAcKilnFeedUiStep(o));
      if (feed) return tabKey(feed);
    }
    const inProgress = pool.find((o) => o.status === "In Progress");
    if (inProgress) return tabKey(inProgress);
    const onHold = pool.find((o) => o.status === "On Hold");
    if (onHold) return tabKey(onHold);
    const nextUp = pool.find((o) => o.can_start && o.status === "Ready");
    if (nextUp) return tabKey(nextUp);
    return pool.length ? tabKey(pool[0]) : "";
  };

  const loadSummary = async (options = {}) => {
    if (!lotId) return;
    const { sync = false, silent = false, preserveSelection = false, preferId } = options;
    const keepId = preserveSelection ? (preferId ?? selectedWoId) : "";
    const gen = ++loadGenRef.current;
    if (!silent) setLoading(true);
    try {
      const routingPromise = isAcExecution
        ? isAcUnified
          ? loadAcShopProcessMapForExecution(lotId).catch(() =>
              loadAcProductRoutingForExecution(lotId).catch(() => null)
            )
          : loadAcProductRoutingForExecution(lotId).catch(() => null)
        : Promise.resolve(null);

      const [dRaw, productRouting] = await Promise.all([
        fetchMesCoreExecutionSummary(lotId, { sync }),
        routingPromise
      ]);
      if (gen !== loadGenRef.current) return;

      const d = dRaw || {};
      let ops = Array.isArray(d.operations) ? d.operations : [];

      setExecutionReady(!!d.execution_ready);

      if (isAcExecution) {
        ops = normalizeAcExecutionOperations(ops, productRouting);
        if (isAcUnified) ops = unlockAcAnyOrderStart(ops);
      }

      const baseSummary = {
        lot_id: d.lot_id,
        production_order_id: d.production_order_id,
        part_id: d.part_id,
        part_name: d.part_name,
        lot_status: d.lot_status,
        schedules_count: d.schedules_count ?? 0,
        operations_ready: d.operations_ready ?? 0,
        operations_on_hold: d.operations_on_hold ?? 0,
        operations_total: d.operations_total ?? 0,
        operations_completed: d.operations_completed ?? 0
      };

      if (gen !== loadGenRef.current) return;
      setSummary(isAcExecution ? summarizeAcExecution(baseSummary, ops) : baseSummary);
      setOperations(ops);
      setSelectedWoId(pickDefaultWoId(ops, keepId));
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      if (e.response?.status !== 404) console.error(e);
      setSummary(null);
      setOperations([]);
      setExecutionReady(false);
      setSelectedWoId("");
    } finally {
      if (gen === loadGenRef.current && !silent) setLoading(false);
    }
  };

  const refreshInBackground = (preferId) => {
    void loadSummary({
      sync: false,
      silent: true,
      preserveSelection: true,
      preferId
    });
  };

  const allProcessTabOps = useMemo(
    () => (isAcUnified ? acProcessMapTabs(sortedOperations) : sortedOperations),
    [isAcUnified, sortedOperations]
  );

  const processTabOps = useMemo(() => {
    const rows = isAcUnified ? acProcessTabsForStage(allProcessTabOps, execStage) : allProcessTabOps;
    if (!isAcUnified) return rows;
    return rows.filter((op) => acOperationVisibleForRoles(op, acRoles));
  }, [isAcUnified, allProcessTabOps, execStage, acRoles]);

  const selectedOp = useMemo(
    () =>
      (isAcUnified ? processTabOps : sortedOperations).find(
        (o) => tabKey(o) === selectedWoId || woId(o) === selectedWoId
      ) || null,
    [isAcUnified, processTabOps, sortedOperations, selectedWoId]
  );

  const acUiFlags = useMemo(() => {
    if (!isAcExecution || !selectedOp) return null;
    return getAcExecutionUiFlags(selectedOp);
  }, [isAcExecution, selectedOp]);

  const selectedLot = useMemo(
    () => lots.find((l) => (l.lot_id || l.lot_code) === lotId) || null,
    [lots, lotId]
  );

  const activeProcessStep = useMemo(
    () => resolveAcProcessStep(selectedOp),
    [selectedOp]
  );

  useEffect(() => {
    if (!isAcUnified) return;
    const allowed = acExecutionStagesForRoles(acRoles);
    if (allowed.includes(execStage)) return;
    if (!allowed.length) {
      navigate("/activated-carbon/raw-material?tab=inward", { replace: true });
      return;
    }
    navigate(`/activated-carbon/execution?stage=${allowed[0]}`, { replace: true });
  }, [isAcUnified, execStage, acRoles, navigate]);

  useEffect(() => {
    if (!isAcUnified || !allProcessTabOps.length) return;
    if (acReportsOpen || acKilnParamsOpen) return;
    const current = processTabOps.find(
      (o) => tabKey(o) === selectedWoId || woId(o) === selectedWoId
    );
    if (current && acExecutionStageOf(current) === execStage) return;
    const id = pickDefaultWoId(processTabOps, selectedWoId);
    if (id && id !== selectedWoId) setSelectedWoId(id);
  }, [isAcUnified, execStage, allProcessTabOps, processTabOps, selectedWoId, acReportsOpen, acKilnParamsOpen]);

  useEffect(() => {
    if (!selectedOp) return;
    const planned = selectedOp.planned_resources || {};
    setMachineId(
      selectedOp.actual_machine_id ||
        selectedOp.assigned_machine_id ||
        planned.machine_code ||
        ""
    );
    setLaborPoolCode(
      selectedOp.actual_labor_pool_code || planned.labor_pool_code || ""
    );
    const tools =
      selectedOp.actual_tool_codes?.length
        ? selectedOp.actual_tool_codes
        : planned.tool_codes || [];
    setSelectedToolCodes(Array.isArray(tools) ? tools : []);
    setHoldReason("");
    if (selectedOp.operator_name) {
      setOperatorName(selectedOp.operator_name);
    }
    if (selectedOp.status === "Completed") {
      setOutputQty(String(selectedOp.actual_output_quantity ?? ""));
      setScrapQty(String(selectedOp.scrap_quantity ?? ""));
      if (selectedOp.downtime_minutes != null) {
        setDowntimeMin(String(selectedOp.downtime_minutes));
      }
    } else {
      setOutputQty("");
      setScrapQty("");
      setDowntimeMin("");
    }
  }, [selectedWoId, selectedOp]);

  const flowSteps = useMemo(() => {
    return sortedOperations.map((op) => {
      const s = (op.status || "").toLowerCase();
      let status = "pending";
      if (s.includes("complete")) status = "done";
      else if (s.includes("progress")) status = "active";
      else if (s.includes("hold")) status = "pending";
      else if (s.includes("ready")) status = "pending";
      return {
        id: woId(op),
        title: op.operation_name,
        code: op.operation_code,
        seq: op.seq,
        status,
        meta: op.status
      };
    });
  }, [sortedOperations]);

  const startOp = async () => {
    if (!selectedOp || acting) return;
    if (selectedOp.status !== "Ready") return;
    const id = woId(selectedOp);
    if (!id) {
      if (isAcUnified) {
        alert("Load the kiln first so this process-map step can be started.");
      }
      return;
    }

    setActing(true);
    try {
      if (isAcExecution) {
        const flags = acUiFlags || getAcExecutionUiFlags(selectedOp);
        if (flags.machine_required && !machineId.trim()) {
          alert("Select a machine to start.");
          return;
        }
        if (flags.labor_required && !laborPoolCode.trim()) {
          alert("Select a labor pool (crew) to start.");
          return;
        }
      } else if (!operatorName.trim()) {
        alert("Enter operator name to start.");
        return;
      }

      const flags = isAcExecution ? acUiFlags || getAcExecutionUiFlags(selectedOp) : null;
      const res = await startMesCoreExecution(id, {
        operator_name: isAcExecution
          ? resolveAcExecutionOperatorName(selectedOp, laborPoolCode)
          : operatorName.trim() || undefined,
        machine_id: flags?.skip_machine ? undefined : machineId.trim() || undefined,
        labor_pool_code: flags?.skip_labor ? undefined : laborPoolCode.trim() || undefined,
        tool_codes:
          flags?.skip_tools || !selectedToolCodes.length ? undefined : selectedToolCodes
      });
      setOperations((ops) => applyWoToOperations(ops, id, res, { anyOrder: isAcUnified }));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error starting operation"));
    } finally {
      setActing(false);
    }
  };

  const holdOp = async () => {
    if (!selectedOp || acting) return;
    const reason = holdReason.trim();
    if (!reason) {
      alert("Enter a reason for putting this operation on hold (e.g. material not available).");
      return;
    }
    const id = woId(selectedOp);
    setActing(true);
    try {
      const res = await holdMesCoreExecution(id, { reason });
      setHoldReason("");
      setOperations((ops) => applyWoToOperations(ops, id, res, { anyOrder: isAcUnified }));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error putting operation on hold"));
    } finally {
      setActing(false);
    }
  };

  const resumeOp = async () => {
    if (!selectedOp || acting) return;
    const id = woId(selectedOp);
    setActing(true);
    try {
      const res = await resumeMesCoreExecution(id);
      setOperations((ops) => applyWoToOperations(ops, id, res, { anyOrder: isAcUnified }));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error resuming operation"));
    } finally {
      setActing(false);
    }
  };

  const ensureOpStarted = async () => {
    if (!selectedOp || selectedOp.status !== "Ready" || !selectedOp.can_start) return true;
    const id = woId(selectedOp);
    if (!id) return false;

    if (isAcExecution) {
      const flags = acUiFlags || getAcExecutionUiFlags(selectedOp);
      if (flags.machine_required && !machineId.trim()) {
        alert("Select a machine, then complete this step.");
        return false;
      }
      if (flags.labor_required && !laborPoolCode.trim()) {
        alert("Select a labor pool (crew), then complete this step.");
        return false;
      }
    } else if (!operatorName.trim()) {
      alert("Enter operator name to start.");
      return false;
    }

    const flags = isAcExecution ? acUiFlags || getAcExecutionUiFlags(selectedOp) : null;
    const res = await startMesCoreExecution(id, {
      operator_name: isAcExecution
        ? resolveAcExecutionOperatorName(selectedOp, laborPoolCode)
        : operatorName.trim() || undefined,
      machine_id: flags?.skip_machine ? undefined : machineId.trim() || undefined,
      labor_pool_code: flags?.skip_labor ? undefined : laborPoolCode.trim() || undefined,
      tool_codes:
        flags?.skip_tools || !selectedToolCodes.length ? undefined : selectedToolCodes
    });
    setOperations((ops) => applyWoToOperations(ops, id, res, { anyOrder: isAcUnified }));
    setSelectedWoId(id);
    return true;
  };

  const completeOp = async ({ skipOptional = false } = {}) => {
    if (!selectedOp || acting) return;
    const id = woId(selectedOp);
    if (!id) return;
    if (!skipOptional && !(Number(outputQty) > 0)) {
      alert("Enter actual output quantity before completing.");
      return;
    }

    if (!skipOptional && captureRef.current?.hasTemplates) {
      if (!captureRef.current.validate()) {
        alert("Fill in all mandatory capture parameters before completing.");
        return;
      }
    }

    if (
      !skipOptional &&
      isAcUnified &&
      stepExtraRef.current?.validate &&
      !stepExtraRef.current.validate()
    ) {
      const stepHint =
        activeProcessStep === "SCREENING"
          ? "Enter Good fraction (KG) in the screening form."
          : activeProcessStep === "GRADE_SEPARATION"
            ? "Enter grade code and separated mass in the grade separation form."
          : activeProcessStep === "QC"
            ? "Complete the quality test fields."
            : "Fill in all required fields for this step.";
      alert(`${stepHint} Then click Complete again.`);
      return;
    }

    setActing(true);
    try {
      if (!skipOptional && selectedOp.status === "Ready" && selectedOp.can_start) {
        const started = await ensureOpStarted();
        if (!started) return;
      }

      if (!skipOptional && isAcUnified && stepExtraRef.current?.getPayload) {
        const extra = stepExtraRef.current.getPayload();
        const production_lot_id = selectedLot?.production_lot_id || selectedLot?.lot_id || lotId;
        if (activeProcessStep === "SCREENING") {
          await createAcScreening({ production_lot_id, ...extra });
        } else if (activeProcessStep === "GRADE_SEPARATION") {
          await createAcGradeSeparation({ production_lot_id, ...extra });
        } else if (activeProcessStep === "QC") {
          if (!production_lot_id) {
            alert(
              "Select a production lot with a valid ID before quality testing. Refresh the page and pick the lot again."
            );
            return;
          }
          await createAcQualityTest({ production_lot_id, ...extra });
        }
      }

      if (!skipOptional && captureRef.current?.hasTemplates) {
        const saved = await captureRef.current.submit();
        if (!saved) return;
      }

      const flags = isAcExecution ? acUiFlags || getAcExecutionUiFlags(selectedOp) : null;
      const capturedParams =
        !skipOptional && isAcExecution && captureRef.current?.getValues
          ? captureRef.current.getValues()
          : null;
      const downtimeVal = downtimeMin.trim() ? Number(downtimeMin) : undefined;
      const parameterReadings =
        isAcExecution && capturedParams && selectedOp?.parameters?.length
          ? buildAcParameterReadings(selectedOp.parameters, capturedParams)
          : undefined;
      const res = await completeMesCoreExecution(id, {
        actual_output_quantity: skipOptional ? 0 : Number(outputQty) || 0,
        scrap_quantity: skipOptional ? 0 : Number(scrapQty) || 0,
        rework_quantity: 0,
        operator_name: isAcExecution
          ? resolveAcExecutionOperatorName(selectedOp, laborPoolCode)
          : operatorName.trim() || undefined,
        machine_id: flags?.skip_machine ? undefined : machineId.trim() || undefined,
        downtime_minutes: downtimeVal,
        ...(parameterReadings?.length ? { parameter_readings: parameterReadings } : {})
      });
      const woPayload = {
        ...res,
        downtime_minutes:
          res?.downtime_minutes != null ? res.downtime_minutes : downtimeVal,
        actual_machine_id:
          flags?.skip_machine
            ? undefined
            : res?.actual_machine_id || machineId.trim() || undefined
      };
      const updated = applyWoToOperations(operations, id, woPayload, { anyOrder: isAcUnified });
      setOperations(updated);
      const nextId = pickDefaultWoId(updated, null);
      setSelectedWoId(nextId);
      markStage("execution");
      refreshInBackground(nextId);
    } catch (e) {
      alert(formatApiError(e, "Error completing operation"));
    } finally {
      setActing(false);
    }
  };

  const skipOptionalOp = async () => {
    if (!selectedOp || acting || !isAcOptionalOperation(selectedOp)) return;
    if (selectedOp.status === "Ready" && selectedOp.can_start) {
      setActing(true);
      try {
        const id = woId(selectedOp);
        const flags = acUiFlags || getAcExecutionUiFlags(selectedOp);
        await startMesCoreExecution(id, {
          operator_name: resolveAcExecutionOperatorName(selectedOp, laborPoolCode),
          machine_id: flags?.skip_machine ? undefined : machineId.trim() || undefined,
          labor_pool_code: flags?.skip_labor ? undefined : laborPoolCode.trim() || undefined
        });
        setOutputQty("0");
        setScrapQty("0");
        await completeOp({ skipOptional: true });
      } catch (e) {
        alert(formatApiError(e, "Could not skip optional step"));
        setActing(false);
      }
      return;
    }
    if (selectedOp.status === "In Progress") {
      setOutputQty("0");
      setScrapQty("0");
      await completeOp({ skipOptional: true });
    }
  };

  const appendSupplementaryReadings = async () => {
    if (!selectedOp || appendSaving) return;
    const id = woId(selectedOp);
    if (!id || !selectedOp.parameters?.length) return;
    const captured = appendCaptureRef.current?.getValues?.() || {};
    const readings = buildAcParameterReadings(selectedOp.parameters, captured);
    if (!readings.length) {
      alert("Enter at least one parameter value to save.");
      return;
    }
    setAppendSaving(true);
    try {
      await appendMesCoreParameterReadings(id, readings);
      await loadSummary({ silent: true, preserveSelection: true, preferId: id });
    } catch (e) {
      alert(formatApiError(e, "Could not save supplementary readings"));
    } finally {
      setAppendSaving(false);
    }
  };

  const completableOps = isAcUnified
    ? processTabOps.filter((o) => !isAcPostActivationQualityStep(o))
    : sortedOperations;
  const allComplete =
    completableOps.length > 0 && completableOps.every((o) => o.status === "Completed");

  const canActOnSelected =
    !isAcUnified &&
    selectedOp &&
    !isAcKilnFeedUiStep(selectedOp) &&
    ["Ready", "In Progress", "On Hold"].includes(selectedOp.status);

  return (
    <div className="space-y-6">
      {isAcUnified ? (
      <SectionHeader
        eyebrow={execStage === "post_activation" ? "Post-activation" : "Activation"}
        title="Execution"
        subtitle={
          execStage === "post_activation"
            ? "Screening through finished goods. Choose a step from the process map on the right."
            : "Kiln feed first, then output, destoning, and kiln parameters. Choose a step from the process map on the right."
        }
      />
      ) : (
      <SectionHeader
        eyebrow="Stage 07 · Work Order Execution"
        title="Shop floor — operation by operation"
        subtitle="After scheduling, run each routing step here: start, record output/scrap, complete, or put on hold if material or machine is not ready."
        right={
          allComplete && (
            <Link to={nav.afterExecution} className="wf-btn wf-btn-primary">
              {nav.afterExecutionLabel}
            </Link>
          )
        }
      />
      )}

      {isAcExecution && allComplete && !isAcUnified && (
        <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-semibold">All four shop-floor routing steps are complete.</span>{" "}
          Record finished-goods test results on{" "}
          <Link to={nav.afterExecution} className="underline font-medium">
            Quality Testing
          </Link>
          , then proceed to dispatch when stock is ready.
        </div>
      )}

      {!isAcUnified && (
      <ContextBanner
        items={[
          { label: "Lot", value: lotId || "—" },
          { label: "Part", value: summary?.part_name || context.partId || "—" },
          { label: "Schedules", value: summary ? String(summary.schedules_count) : "—" },
          { label: "Routing steps", value: summary ? String(summary.operations_total) : "—" },
          { label: "Ready", value: summary ? String(summary.operations_ready) : "—" },
          { label: "On hold", value: summary ? String(summary.operations_on_hold ?? 0) : "—" },
          { label: "Selected", value: selectedOp?.operation_name || "—" }
        ]}
      />
      )}

      {lotId && !loading && summary && !isAcUnified && (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            executionReady || allComplete
              ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-100"
              : "bg-amber-500/10 border-amber-400/30 text-amber-100"
          ].join(" ")}
        >
          {allComplete ? (
            <>
              <span className="font-semibold">Routing complete.</span>{" "}
              {summary.operations_completed} of {summary.operations_total} steps finished.
              {isAcExecution
                ? " Kiln and crew were released when each step was completed — the kiln is free for the next lot."
                : " Machine and crew resources were released when each step was completed."}
            </>
          ) : executionReady ? (
            <>
              <span className="font-semibold">Shop floor ready.</span>{" "}
              {isAcUnified
                ? "Kiln feed is live above. Remaining steps are tabs from this lot’s process map and can be run in any order."
                : isAcExecution
                ? "Run each routing step in order. Production steps use labor pool + machine; QC steps need parameters only."
                : "Select each operation in routing order, start it, enter production data, then complete — or put on hold if material/machine is not available. Machine is pre-filled from scheduling when assigned."}
            </>
          ) : operations.length === 0 ? (
            <>
              <span className="font-semibold">Not ready yet.</span>{" "}
              {isAcUnified ? (
                <>
                  Load the kiln above — work orders are created automatically after Load.
                </>
              ) : (
                <>
                  Finish{" "}
                  <Link to={nav.prerequisiteForExecution} className="underline text-cyan-200">
                    {nav.prerequisiteLabel}
                  </Link>{" "}
                  for this lot, then return here — work orders sync automatically.
                </>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold">In progress.</span>{" "}
              {summary.operations_completed} of {summary.operations_total} completed.
            </>
          )}
        </div>
      )}

      {loading && lotId && !isAcUnified && (
        <div className="text-sm text-slate-400 text-center py-4">
          Syncing schedules → work orders for lot {lotId}…
        </div>
      )}

      {isAcUnified ? (
        <AcProcessMapTabs
          operations={processTabOps}
          activeId={acReportsOpen ? "reports" : acKilnParamsOpen ? "kiln-parameters" : selectedWoId}
          showReports
          showKilnParameters={execStage === "activation" && !acQualityOnly}
          onSelect={(id) => {
            if (id === "reports") {
              setAcExecTab("reports");
              return;
            }
            if (id === "kiln-parameters") {
              setAcExecTab("kiln-parameters");
              return;
            }
            setAcExecTab("");
            setSelectedWoId(id);
          }}
        />
      ) : null}

      <div className={isAcUnified ? (acReportsOpen ? "grid grid-cols-1 gap-4" : "wf-ac-gate-receipt-grid wf-ac-gate-receipt-grid--wide") : "grid grid-cols-1 gap-5 lg:grid-cols-3"}>
        <WfCard className={isAcUnified ? "" : "lg:col-span-2"} glow>
          {!isAcUnified && (
          <WfCardHeader
            title="Routing Operations"
            subtitle={
              summary
                ? `Lot ${summary.lot_id} · ${summary.part_name || summary.part_id}`
                : "Pick a lot to run"
            }
            icon={<IconPlay />}
            right={
              selectedOp && (
                <StatusPill kind={statusKind(selectedOp.status)}>{selectedOp.status}</StatusPill>
              )
            }
          />
          )}
          <WfCardBody className="space-y-5">
            <div className={`grid grid-cols-1 gap-3 ${isAcExecution ? "" : "md:grid-cols-3"}`}>
              {!isAcUnified && (
              <div className={isAcExecution ? "" : "md:col-span-2"}>
                <label className="wf-label">Lot</label>
                <select className="wf-select" value={lotId} onChange={(e) => selectLot(e.target.value)}>
                  <option value="">-- Pick lot --</option>
                  {lots.map((l) => {
                    const id = l.lot_id || l.lot_code;
                    return (
                      <option key={id} value={id}>
                        {formatAcLotOptionLabel(l)}
                      </option>
                    );
                  })}
                </select>
              </div>
              )}
              {!isAcExecution && (
                <div>
                  <label className="wf-label">Operator (required to start)</label>
                  <input
                    className="wf-input"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Shop floor user"
                  />
                </div>
              )}
            </div>

            {sortedOperations.length === 0 && !loading && !acReportsOpen && !acKilnParamsOpen && (
              <EmptyState
                title="No work orders for this lot"
                hint={
                  isAcUnified
                    ? "Load the kiln above. Process-map tabs appear from this lot’s routing."
                    : isAcExecution
                      ? "Open Lot Routing, generate work orders for this lot, then return here."
                      : "Schedule this lot in Scheduling — each operation becomes a shop-floor work order you run here."
                }
                icon={<IconPlay />}
              />
            )}

            {!isAcUnified && sortedOperations.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Select operation (routing order)
                </div>
                {nextStartableOp && (
                  <div className="text-xs text-cyan-200/90">
                    Next to run: step {nextStartableOp.seq} · {nextStartableOp.operation_name}
                  </div>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {sortedOperations.map((op) => {
                    const id = woId(op);
                    const selected = id === selectedWoId;
                    const isNext = nextStartableOp && woId(nextStartableOp) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedWoId(id)}
                        className={[
                          "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                          selected
                            ? "border-cyan-400/50 bg-cyan-500/10"
                            : isNext
                              ? "border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/60"
                              : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600"
                        ].join(" ")}
                      >
                        <span className="w-7 h-7 rounded-md bg-slate-900/70 border border-slate-700/50 flex items-center justify-center font-mono text-[10px] text-slate-400 shrink-0">
                          {op.seq}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-slate-100 truncate">{op.operation_name}</span>
                          <span className="block text-[10px] text-slate-500 font-mono truncate">
                            {op.operation_code}
                            {isAcExecution && (op.parameters?.length || 0) > 0
                              ? ` · ${op.parameters.length} param(s)`
                              : ""}
                            {!isAcExecution && op.assigned_machine_id ? ` · ${op.assigned_machine_id}` : ""}
                            {op.actual_labor_pool_code ? ` · ${op.actual_labor_pool_code}` : ""}
                            {op.status === "Completed" &&
                            op.downtime_minutes != null &&
                            op.downtime_minutes !== ""
                              ? ` · downtime ${op.downtime_minutes}m`
                              : ""}
                          </span>
                        </span>
                        {isNext && (
                          <span className="text-[10px] uppercase tracking-wide text-emerald-300 font-semibold shrink-0">
                            Next
                          </span>
                        )}
                        <StatusPill kind={statusKind(op.status)}>{op.status}</StatusPill>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isAcUnified && acReportsOpen && (
              <div className="space-y-3">
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  onClick={() => setAcExecTab("")}
                >
                  ← Back to execution
                </button>
                <AcSectionReportsPanel
                  section={execStage === "post_activation" ? "post_activation" : "activation"}
                />
              </div>
            )}

            {isAcUnified &&
              !acReportsOpen &&
              !acKilnParamsOpen &&
              !acQualityOnly &&
              (isAcKilnFeedUiStep(selectedOp) ||
                (!processTabOps.length && userCanAccessAcActivation(acRoles))) && (
              <AcExecutionKilnFeedPanel
                lot={selectedLot}
                lots={lots}
                onSelectLot={(code) => {
                  if (code) selectLot(code);
                }}
                onCharged={(updated) => {
                  if (!updated) return;
                  setLots((prev) => {
                    let found = false;
                    const next = (prev || []).map((row) => {
                      const sameCode =
                        (row.lot_id || row.lot_code) === (updated.lot_code || updated.lot_id);
                      const samePk =
                        row.production_lot_id &&
                        updated.production_lot_id &&
                        row.production_lot_id === updated.production_lot_id;
                      if (!sameCode && !samePk) return row;
                      found = true;
                      return {
                        ...row,
                        ...updated,
                        metadata: { ...(row.metadata || {}), ...(updated.metadata || {}) }
                      };
                    });
                    return found ? next : [...next, updated];
                  });
                }}
              />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcKilnFeedQualityStep(selectedOp) && (
              <AcKilnFeedQualityPanel
                parameters={selectedOp.parameters || []}
                lot={selectedLot}
              />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcKilnOutputQualityStep(selectedOp) && (
              <AcKilnOutputQualityPanel
                parameters={selectedOp.parameters || []}
                kilnCode={
                  selectedLot?.kiln_resource_code ||
                  selectedLot?.metadata?.kiln_resource_code ||
                  ""
                }
                lot={selectedLot}
              />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcDestoningStep(selectedOp) && acCanRunMachines && (
              <AcDestoningPanel lot={selectedLot} />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcDestoningQualityStep(selectedOp) && (
              <AcDestoningQualityPanel parameters={selectedOp.parameters || []} />
            )}

            {isAcUnified && !acReportsOpen && acKilnParamsOpen && (
              <AcKilnParametersPanel />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcPostActivationLiveStep(selectedOp) && (
              <AcPostActivationLivePanel
                processKey={postActivationProcessKey(selectedOp)}
                lot={selectedLot}
                canRun={acCanRunMachines}
              />
            )}

            {isAcUnified && !acReportsOpen && !acKilnParamsOpen && isAcPostActivationQualityStep(selectedOp) && (
              <AcPostActivationQualityPanel />
            )}

            {isAcUnified &&
              !acReportsOpen &&
              !acKilnParamsOpen &&
              selectedOp &&
              !isAcKilnFeedUiStep(selectedOp) &&
              !isAcKilnFeedQualityStep(selectedOp) &&
              !isAcKilnOutputQualityStep(selectedOp) &&
              !isAcKilnTempStep(selectedOp) &&
              !isAcDestoningStep(selectedOp) &&
              !isAcDestoningQualityStep(selectedOp) &&
              !isAcPostActivationLiveStep(selectedOp) &&
              !isAcPostActivationQualityStep(selectedOp) && (
              <AcKilnOutputLabelsList
                kilnCode={
                  selectedLot?.kiln_resource_code ||
                  selectedLot?.metadata?.kiln_resource_code ||
                  ""
                }
                title={`${selectedOp.operation_name} — kiln output labels`}
              />
            )}

            {selectedOp && selectedOp.status === "Completed" && !isAcUnified && !isAcKilnFeedUiStep(selectedOp) && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 space-y-4">
                <div className="text-sm font-semibold text-emerald-100">{selectedOp.operation_name} — completed</div>
                {selectedOp.captured_readings?.length > 0 && (
                  <div className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-3">
                    <div className="text-xs font-semibold text-slate-200 mb-2">Recorded parameters</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {selectedOp.captured_readings.map((r, idx) => (
                        <li key={`${r.parameter_code}-${idx}`}>
                          <span className="font-mono text-slate-100">{r.parameter_name || r.parameter_code}</span>
                          {": "}
                          {r.reading_value != null
                            ? `${r.reading_value}${r.uom ? ` ${r.uom}` : ""}`
                            : r.reading_text ?? "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300">
                  <div>Output: <span className="font-mono">{selectedOp.actual_output_quantity ?? 0}</span></div>
                  <div>Scrap: <span className="font-mono">{selectedOp.scrap_quantity ?? 0}</span></div>
                  <div>Rework: <span className="font-mono">{selectedOp.rework_quantity ?? 0}</span></div>
                  <div>
                    Downtime:{" "}
                    <span className="font-mono text-amber-200">
                      {selectedOp.downtime_minutes != null && selectedOp.downtime_minutes !== ""
                        ? `${selectedOp.downtime_minutes} min`
                        : "—"}
                    </span>
                  </div>
                  {selectedOp.operator_name && !isAcExecution && (
                    <div>Operator: <span className="font-mono">{selectedOp.operator_name}</span></div>
                  )}
                  {!acUiFlags?.skip_machine &&
                    (selectedOp.actual_machine_id || selectedOp.assigned_machine_id) && (
                    <div>
                      Machine:{" "}
                      <span className="font-mono">
                        {selectedOp.actual_machine_id || selectedOp.assigned_machine_id}
                      </span>
                    </div>
                  )}
                  {selectedOp.actual_labor_pool_code && (
                    <div>
                      Crew:{" "}
                      <span className="font-mono">{selectedOp.actual_labor_pool_code}</span>
                    </div>
                  )}
                  {selectedOp.actual_tool_codes?.length > 0 && (
                    <div className="md:col-span-2">
                      Tools:{" "}
                      <span className="font-mono">
                        {selectedOp.actual_tool_codes.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {isAcExecution && selectedOp.parameters?.length > 0 && (
                  <div className="rounded-xl border border-cyan-400/20 bg-slate-900/50 p-4">
                    <AcExecutionParameterCapture
                      ref={appendCaptureRef}
                      parameters={selectedOp.parameters}
                      readOnly={false}
                      allowEmpty
                      title="Add supplementary readings"
                      subtitle="Optional: record lab or follow-up values after this step was completed (Masters / admin)."
                    />
                    <button
                      type="button"
                      className="wf-btn wf-btn--primary mt-3"
                      disabled={appendSaving}
                      onClick={appendSupplementaryReadings}
                    >
                      {appendSaving ? "Saving…" : "Save additional readings"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedOp && canActOnSelected && (
              <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-400/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-blue-300 font-semibold">
                      Step {selectedOp.seq}
                    </div>
                    <div className="text-xl font-bold text-slate-100 mt-1">{selectedOp.operation_name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">{selectedOp.operation_code}</div>
                    {selectedOp.assigned_work_center_id && (
                      <div className="text-xs text-slate-500 mt-1">
                        Work center: {selectedOp.assigned_work_center_id}
                      </div>
                    )}
                  </div>
                  <StatusPill kind={statusKind(selectedOp.status)}>{selectedOp.status}</StatusPill>
                </div>

                {selectedOp.status === "On Hold" && selectedOp.hold_reason && (
                  <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-sm text-amber-100">
                    On hold: {selectedOp.hold_reason}
                  </div>
                )}

                {selectedOp.status === "Ready" && !selectedOp.can_start && !isAcUnified && (
                  <div className="mt-3 rounded-lg bg-slate-800/60 border border-slate-600/40 px-3 py-2 text-sm text-slate-300">
                    Complete the previous routing step before starting this one.
                  </div>
                )}

                {(selectedOp.status === "Ready" || selectedOp.status === "In Progress") && (
                  <div className="mt-4">
                    <label className="wf-label">Hold reason (for Put on hold)</label>
                    <input
                      className="wf-input"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Material not available, machine breakdown…"
                    />
                  </div>
                )}

                {isAcUnified &&
                  (selectedOp.status === "Ready" || selectedOp.status === "In Progress") &&
                  !(selectedOp.parameters?.length > 0) &&
                  activeProcessStep === "GRADE_SEPARATION" &&
                  !isAcPostActivationLiveStep(selectedOp) && (
                    <div className="mt-4">
                      <AcExecutionGradeSeparationPanel
                        key={`grade-${selectedWoId}`}
                        ref={stepExtraRef}
                        readOnly={selectedOp.status === "Completed"}
                      />
                    </div>
                  )}

                {isAcUnified &&
                  (selectedOp.status === "Ready" || selectedOp.status === "In Progress") &&
                  !(selectedOp.parameters?.length > 0) &&
                  activeProcessStep === "SCREENING" &&
                  !isAcPostActivationLiveStep(selectedOp) && (
                    <div className="mt-4">
                      <AcExecutionScreeningPanel
                        key={`screening-${selectedWoId}`}
                        ref={stepExtraRef}
                        readOnly={selectedOp.status === "Completed"}
                      />
                    </div>
                  )}

                {isAcUnified &&
                  (selectedOp.status === "Ready" || selectedOp.status === "In Progress") &&
                  !(selectedOp.parameters?.length > 0) &&
                  activeProcessStep === "QC" &&
                  !isAcPostActivationLiveStep(selectedOp) && (
                    <div className="mt-4">
                      <AcExecutionQualityPanel
                        key={`qc-${selectedWoId}`}
                        ref={stepExtraRef}
                        lot={selectedLot}
                        readOnly={selectedOp.status === "Completed"}
                      />
                    </div>
                  )}

                {(selectedOp.status === "Ready" || selectedOp.status === "In Progress") &&
                  !(
                    isAcUnified &&
                    hasAcStepSpecificCapture(activeProcessStep) &&
                    !(selectedOp.parameters?.length > 0)
                  ) && (
                  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-900/50 p-4">
                    {isAcExecution ? (
                      <AcExecutionParameterCapture
                        ref={captureRef}
                        parameters={selectedOp.parameters || []}
                        readOnly={selectedOp.status !== "In Progress"}
                        title="Capture parameters"
                        subtitle={
                          selectedOp.status === "In Progress"
                            ? "Enter actual values defined for this process on the raw material type."
                            : "Review parameters that must be recorded when this operation runs."
                        }
                        emptyHint={
                          isAcUnified
                            ? "Add tracking fields for this process in Masters → Material & routing, then re-run feasibility for new lots."
                            : undefined
                        }
                      />
                    ) : (
                      <WorkOrderCaptureForm
                        ref={captureRef}
                        workOrderId={woId(selectedOp)}
                        capturedBy={operatorName}
                        captureStage="execution"
                        theme="workflow"
                        title="Capture parameters"
                        subtitle={
                          selectedOp.status === "In Progress"
                            ? "Enter actual values for each parameter defined during routing."
                            : "Review parameters that must be recorded when this operation runs."
                        }
                        readOnly={selectedOp.status !== "In Progress"}
                        showSubmitButton={false}
                      />
                    )}
                  </div>
                )}

                {selectedOp.status === "Ready" &&
                  selectedOp.can_start &&
                  !acUiFlags?.is_gate_step &&
                  (acUiFlags?.machine_required ||
                    acUiFlags?.labor_required ||
                    acUiFlags?.tools_required) && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {acUiFlags?.machine_required && (
                    <div>
                      <label className="wf-label">Machine (required)</label>
                      <select
                        className="wf-input"
                        value={machineId}
                        onChange={(e) => setMachineId(e.target.value)}
                      >
                        <option value="">— Select machine —</option>
                        {plantResources.machines.map((m) => (
                          <option key={m.resource_code} value={m.resource_code}>
                            {m.resource_code} · {m.resource_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    )}
                    {acUiFlags?.labor_required && (
                    <div>
                      <label className="wf-label">Labor pool (required)</label>
                      <select
                        className="wf-input"
                        value={laborPoolCode}
                        onChange={(e) => setLaborPoolCode(e.target.value)}
                      >
                        <option value="">— Select crew —</option>
                        {plantResources.labor_pools.map((l) => (
                          <option key={l.resource_code} value={l.resource_code}>
                            {l.resource_code} · {l.resource_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    )}
                    {acUiFlags?.tools_required && (
                    <div className="md:col-span-2">
                      <label className="wf-label">Tools used</label>
                      {plantResources.tools.length === 0 ? (
                        <p className="text-xs text-slate-500">No tools registered in Masters.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {plantResources.tools.map((t) => {
                            const selected = selectedToolCodes.includes(t.resource_code);
                            return (
                              <button
                                key={t.resource_code}
                                type="button"
                                className={`text-xs px-2 py-1 rounded border ${
                                  selected
                                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                                    : "border-slate-600 text-slate-400"
                                }`}
                                onClick={() =>
                                  setSelectedToolCodes((prev) =>
                                    prev.includes(t.resource_code)
                                      ? prev.filter((c) => c !== t.resource_code)
                                      : [...prev, t.resource_code]
                                  )
                                }
                              >
                                {t.resource_code}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}

                {selectedOp.status === "Ready" && selectedOp.can_start && acUiFlags?.is_gate_step && (
                  <p className="mt-4 text-xs text-slate-400">
                    {acUiFlags.is_feasibility_step
                      ? "Feasibility gate — confirm parameters and start; no machine or crew assignment."
                      : "QC / inspection step — record results only; no machine or crew assignment."}
                  </p>
                )}

                {selectedOp.status === "Ready" &&
                  selectedOp.can_start &&
                  !acUiFlags?.is_gate_step &&
                  !acUiFlags?.machine_required &&
                  !acUiFlags?.labor_required &&
                  !acUiFlags?.tools_required && (
                  <p className="mt-4 text-xs text-slate-400">
                    No machine or crew on this step — start and record parameters, then complete.
                  </p>
                )}

                {selectedOp.status === "Ready" && (
                  <div className="mt-5">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        className="wf-btn wf-btn-ghost"
                        onClick={holdOp}
                        disabled={acting || !holdReason.trim()}
                      >
                        Put on hold
                      </button>
                      <button
                        type="button"
                        className="wf-btn wf-btn-primary"
                        onClick={startOp}
                        disabled={acting || !selectedOp.can_start}
                      >
                        {acting ? "Saving…" : "▶ Start"}
                      </button>
                    </div>
                    {selectedOp.can_start &&
                      !isAcExecution &&
                      !operatorName.trim() && (
                      <p className="text-xs text-amber-200/90 mt-2 text-right">
                        Enter operator name above, then click Start.
                      </p>
                    )}
                    {selectedOp.can_start &&
                      isAcExecution &&
                      acUiFlags?.machine_required &&
                      !machineId.trim() && (
                      <p className="text-xs text-amber-200/90 mt-2 text-right">
                        Select a machine, then click Start.
                      </p>
                    )}
                    {selectedOp.can_start &&
                      isAcExecution &&
                      acUiFlags?.labor_required &&
                      !laborPoolCode.trim() && (
                      <p className="text-xs text-amber-200/90 mt-2 text-right">
                        Select a labor pool (crew), then click Start.
                      </p>
                    )}
                    {!selectedOp.can_start && nextStartableOp && (
                      <p className="text-xs text-slate-400 mt-2 text-right">
                        Select step {nextStartableOp.seq} ({nextStartableOp.operation_name}) to start next.
                      </p>
                    )}
                  </div>
                )}

                {selectedOp.status === "On Hold" && (
                  <div className="mt-5">
                    <button
                      type="button"
                      className="wf-btn wf-btn-primary w-full"
                      onClick={resumeOp}
                      disabled={acting}
                    >
                      {acting ? "Saving…" : "Resume operation"}
                    </button>
                  </div>
                )}

                {selectedOp.status === "In Progress" && (
                  <div className="mt-5 space-y-4">
                    {isAcExecution &&
                      (machineId ||
                        laborPoolCode ||
                        selectedOp.actual_machine_id ||
                        selectedOp.actual_labor_pool_code) && (
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                        {(machineId || selectedOp.actual_machine_id) && (
                          <span>
                            Machine:{" "}
                            <span className="font-mono text-slate-100">
                              {machineId || selectedOp.actual_machine_id}
                            </span>
                          </span>
                        )}
                        {(laborPoolCode || selectedOp.actual_labor_pool_code) && (
                          <span>
                            Crew:{" "}
                            <span className="font-mono text-slate-100">
                              {laborPoolCode || selectedOp.actual_labor_pool_code}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`grid grid-cols-1 gap-3 ${
                        isAcExecution || acUiFlags?.skip_machine ? "md:grid-cols-3" : "md:grid-cols-4"
                      }`}
                    >
                      {!isAcExecution && !acUiFlags?.skip_machine && (
                      <div>
                        <label className="wf-label">Machine</label>
                        <input
                          className="wf-input"
                          value={machineId}
                          onChange={(e) => setMachineId(e.target.value)}
                          placeholder={selectedOp.assigned_machine_id || "MCH-…"}
                        />
                        {selectedOp.assigned_machine_id && (
                          <div className="text-[10px] text-slate-500 mt-1">From schedule</div>
                        )}
                      </div>
                      )}
                      {acUiFlags?.is_gate_step && (
                        <div className="md:col-span-4 text-xs text-slate-400">
                          {acUiFlags.is_feasibility_step
                            ? "Feasibility gate — no machine or crew on this step."
                            : "QC / inspection — no machine or crew on this step."}
                        </div>
                      )}
                      <div>
                        <label className="wf-label">Output Qty</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={outputQty}
                          onChange={(e) => setOutputQty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="wf-label">Scrap Qty</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={scrapQty}
                          onChange={(e) => setScrapQty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="wf-label">Downtime (min)</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={downtimeMin}
                          onChange={(e) => setDowntimeMin(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {isAcUnified && isAcOptionalOperation(selectedOp) && (
                        <button
                          type="button"
                          className="wf-btn wf-btn-ghost"
                          onClick={skipOptionalOp}
                          disabled={acting}
                        >
                          Skip optional step
                        </button>
                      )}
                      <button
                        type="button"
                        className="wf-btn wf-btn-ghost"
                        onClick={holdOp}
                        disabled={acting}
                      >
                        Put on hold
                      </button>
                      <button
                        type="button"
                        className="wf-btn wf-btn-primary"
                        onClick={() => completeOp()}
                        disabled={acting}
                      >
                        {acting ? "Saving…" : "Complete →"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {operations.length > 0 && !isAcUnified && (
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                  Full Routing
                </div>
                <FlowDiagram steps={flowSteps} />
              </div>
            )}
          </WfCardBody>
        </WfCard>

        {isAcUnified ? (
          acReportsOpen ? null : (
          <aside className="wf-ac-gate-receipt-flow ac-exec-process-aside">
            <p className="ac-exec-process-flow-title">Process map</p>
            <div className="wf-light-panel rounded-xl p-3">
              <AcProcessMapTabs
                sidebar
                operations={processTabOps}
                activeId={acKilnParamsOpen ? "kiln-parameters" : selectedWoId}
                showReports
                showKilnParameters={execStage === "activation" && !acQualityOnly}
                onSelect={(id) => {
                  if (id === "reports") {
                    setAcExecTab("reports");
                    return;
                  }
                  if (id === "kiln-parameters") {
                    setAcExecTab("kiln-parameters");
                    return;
                  }
                  setAcExecTab("");
                  setSelectedWoId(id);
                }}
              />
              {!processTabOps.length ? (
                <p className="text-xs text-slate-600 mt-2 mb-0">
                  Load the kiln to unlock this stage’s remaining steps.
                </p>
              ) : null}
            </div>
          </aside>
          )
        ) : (
        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="How it works" subtitle="After scheduling" icon={<IconAtom />} />
            <WfCardBody className="space-y-3 text-xs text-slate-400">
              <p>1. Pick the lot scheduled in Stage 06.</p>
              <p>2. Work through each routing step in order.</p>
              {isAcExecution ? (
                <>
                  <p>3. <span className="text-slate-200">Start</span> — pick machine/crew only when the routing step requires them.</p>
                  <p>4. <span className="text-slate-200">Complete</span> — enter capture parameters, output, scrap, and downtime.</p>
                </>
              ) : (
                <>
                  <p>3. <span className="text-slate-200">Start</span> with operator name.</p>
                  <p>4. <span className="text-slate-200">Complete</span> — enter capture parameters, output, scrap, machine, and downtime.</p>
                </>
              )}
              <p>5. <span className="text-slate-200">Put on hold</span> if material or machine is not ready — resume later.</p>
              <OntologyEdge from="WorkOrder" to="Operation" label="executes" />
              <OntologyEdge from="WorkOrder" to="Machine" label="runs on" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Live status" subtitle="All operations" icon={<IconWave />} />
            <WfCardBody>
              {operations.length === 0 ? (
                <EmptyState title="No operations" hint="Pick a lot to view status." icon={<IconWave />} />
              ) : (
                <div className="space-y-2">
                  {sortedOperations.map((op) => (
                    <div key={woId(op)} className="flex items-center gap-3 text-xs">
                      <span className="w-6 h-6 rounded-md bg-slate-900/70 border border-slate-700/50 flex items-center justify-center font-mono text-[10px] text-slate-400">
                        {op.seq}
                      </span>
                      <span className="flex-1 text-slate-200 truncate">{op.operation_name}</span>
                      <StatusPill kind={statusKind(op.status)}>{op.status}</StatusPill>
                    </div>
                  ))}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
        )}
      </div>
    </div>
  );
}

function IconPlay() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>; }
function IconAtom() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconWave() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c2 0 2-4 4-4s2 8 4 8 2-12 4-12 2 16 4 16 2-8 4-8"/></svg>; }

export default ExecutionScreen;
