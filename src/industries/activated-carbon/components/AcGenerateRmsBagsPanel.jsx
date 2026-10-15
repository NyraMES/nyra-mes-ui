import { useEffect, useMemo, useState } from "react";

import {
  completeAcInboundExecutionStep,
  createAcInwardBag,
  deleteAcInwardBag,
  fetchAcInwardBags,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcRmsBagList from "./AcRmsBagList";
import AcWeightSummaryTable from "./AcWeightSummaryTable";

function asKg(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatKg(value) {
  return asKg(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AcGenerateRmsBagsPanel({
  customerOrderId,
  orderCode,
  ourWeightKg,
  processStep = "PACKING",
  operationCode = "IN-RMS-BAG",
  initialBags = [],
  onBagsChanged,
  onProceedToLab,
  proceedLabel = "Bag split complete"
}) {
  const ourKg = asKg(ourWeightKg);
  const [bags, setBags] = useState(() => (initialBags || []).filter((b) => !b.grade));
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmShort, setConfirmShort] = useState(false);

  const reload = async () => {
    const rows = await fetchAcInwardBags(orderCode);
    const next = (rows || []).filter((b) => !b.grade);
    setBags(next);
    onBagsChanged?.(next);
    return next;
  };

  useEffect(() => {
    if (!orderCode) return undefined;
    let cancelled = false;
    fetchAcInwardBags(orderCode)
      .then((rows) => {
        if (cancelled) return;
        const next = (rows || []).filter((b) => !b.grade);
        setBags(next);
        onBagsChanged?.(next);
      })
      .catch((e) => {
        if (!cancelled) setError(formatAcApiError(e, "Could not load bags"));
      });
    return () => {
      cancelled = true;
    };
  }, [orderCode, customerOrderId]);

  const bagTotal = useMemo(
    () => bags.reduce((sum, bag) => sum + asKg(bag.weight_kg), 0),
    [bags]
  );
  const remaining = Math.max(0, Math.round((ourKg - bagTotal) * 100) / 100);
  const isShort = remaining > 0.01;
  const canAdd = isShort;
  const canProceed = bags.length > 0;

  const generateBag = async () => {
    const kg = asKg(weight);
    if (!kg || kg <= 0) {
      setError("Enter the bag weight in KG.");
      return;
    }
    if (kg > remaining + 0.01) {
      setError(`Only ${formatKg(remaining)} KG remaining of our weight ${formatKg(ourKg)} KG.`);
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    setConfirmShort(false);
    try {
      await createAcInwardBag({
        customer_order_id: customerOrderId,
        weight_kg: kg,
        bag_kind: "rms_500"
      });
      setWeight("");
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not generate bag"));
    } finally {
      setSaving(false);
    }
  };

  const removeBag = async (bag) => {
    if (saving || !bag?.bag_id) return;
    setSaving(true);
    setError("");
    setConfirmShort(false);
    try {
      await deleteAcInwardBag(customerOrderId, bag.bag_id);
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not remove bag"));
    } finally {
      setSaving(false);
    }
  };

  const completeRms = async ({ confirmed = false } = {}) => {
    if (!canProceed) {
      setError("Add at least one bag before finishing Bag split.");
      return;
    }
    if (isShort && !confirmed) {
      setConfirmShort(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: customerOrderId,
        process_step: processStep,
        operation_code: operationCode,
        parameters: {
          bag_count: bags.length,
          bag_total_kg: bagTotal,
          short_confirmed: isShort,
          variance_comment: isShort
            ? `User confirmed short bag total: ${bagTotal} KG of ${ourKg} KG (${remaining} KG remaining)`
            : "User-generated bags"
        }
      });
      setConfirmShort(false);
      await onProceedToLab?.(saved);
    } catch (e) {
      const msg = formatAcApiError(e, "Could not complete Bag split");
      if (/already recorded/i.test(msg)) {
        await onProceedToLab?.({ customer_order_id: customerOrderId, order_code: orderCode });
        return;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700 m-0">
        Enter each bag weight and keep adding bags.
      </p>
      <AcWeightSummaryTable ourKg={ourKg} bagTotal={bagTotal} pendingKg={remaining} />
      {canAdd ? (
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-slate-700">Bag weight (KG)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="w-40 rounded border border-slate-300 px-3 py-2"
              value={weight}
              disabled={saving}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="wf-btn wf-btn-primary"
            disabled={saving || !asKg(weight)}
            onClick={generateBag}
          >
            {saving ? "Saving…" : "Generate bag"}
          </button>
        </div>
      ) : bags.length ? (
        <p className="text-sm text-emerald-800 m-0">
          Bag total matches our weight. Finish Bag split. Lab is with Quality.
        </p>
      ) : null}
      <AcRmsBagList
        bags={bags}
        title={`Bags on ${orderCode}`}
        onRemove={removeBag}
        removing={saving}
      />
      {confirmShort ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-950 m-0">
            You have {bags.length} bag{bags.length === 1 ? "" : "s"} totalling{" "}
            <strong>{formatKg(bagTotal)} KG</strong> against our weight{" "}
            <strong>{formatKg(ourKg)} KG</strong> ({formatKg(remaining)} KG not bagged).
            Finish Bag split with these bags? Lab is recorded by Quality.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={saving}
              onClick={() => completeRms({ confirmed: true })}
            >
              {saving ? "Saving…" : "Yes, finish Bag split"}
            </button>
            <button
              type="button"
              className="wf-btn"
              disabled={saving}
              onClick={() => setConfirmShort(false)}
            >
              Keep adding bags
            </button>
          </div>
        </div>
      ) : canProceed ? (
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          disabled={saving}
          onClick={() => completeRms()}
        >
          {saving ? "Saving…" : proceedLabel}
        </button>
      ) : null}
    </div>
  );
}
