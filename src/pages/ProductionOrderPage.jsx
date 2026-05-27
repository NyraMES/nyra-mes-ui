import { useEffect, useMemo, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


const buildLot = () => ({ lot_quantity: "" });


function ProductionOrderPage() {
  const [productionOrderId, setProductionOrderId] = useState("");
  const [orderLineId, setOrderLineId] = useState("");
  const [plannedQuantity, setPlannedQuantity] = useState("");
  const [status, setStatus] = useState("Planned");
  const [lots, setLots] = useState([buildLot()]);

  const [productionOrders, setProductionOrders] = useState([]);
  const [orderLines, setOrderLines] = useState([]);

  useEffect(() => {
    loadProductionOrders();
    loadOrderLines();
  }, []);

  const loadProductionOrders = async () => {
    try {
      const response = await api.get("/production-orders");
      setProductionOrders(response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadOrderLines = async () => {
    try {
      const ordersResponse = await api.get("/orders");
      const orders = ordersResponse.data || [];

      let allLines = [];
      for (const order of orders) {
        try {
          const lineResponse = await api.get(
            `/order/${order.order_id}/lines`
          );
          const lines = (lineResponse.data || []).map((l) => ({
            ...l,
            order_status: order.status
          }));
          allLines = [...allLines, ...lines];
        } catch (err) {
          console.error(err);
        }
      }
      setOrderLines(allLines);
    } catch (error) {
      console.error(error);
    }
  };

  const usedOrderLineIds = useMemo(() => {
    return new Set(
      productionOrders
        .map((po) => po.order_line_id)
        .filter(Boolean)
    );
  }, [productionOrders]);

  const availableOrderLines = useMemo(() => {
    return orderLines.filter((l) => {
      if (usedOrderLineIds.has(l.order_line_id)) return false;
      const lineStatus = (l.status || "").toLowerCase();
      if (lineStatus === "completed" || lineStatus === "cancelled") return false;
      return true;
    });
  }, [orderLines, usedOrderLineIds]);

  const selectedLine = useMemo(() => {
    return orderLines.find((l) => l.order_line_id === orderLineId) || null;
  }, [orderLines, orderLineId]);

  const handleOrderLineChange = (newLineId) => {
    setOrderLineId(newLineId);
    const line = orderLines.find((l) => l.order_line_id === newLineId);
    if (line && (line.quantity ?? line.line_quantity) !== undefined) {
      setPlannedQuantity(String(line.quantity ?? line.line_quantity));
    }
  };

  const clearForm = () => {
    setProductionOrderId("");
    setOrderLineId("");
    setPlannedQuantity("");
    setStatus("Planned");
    setLots([buildLot()]);
  };

  const addLot = () => {
    setLots((prev) => [...prev, buildLot()]);
  };

  const removeLot = (index) => {
    setLots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLotQty = (index, value) => {
    setLots((prev) =>
      prev.map((lot, i) =>
        i === index ? { ...lot, lot_quantity: value } : lot
      )
    );
  };

  const allocated = useMemo(() => {
    return lots.reduce((sum, l) => {
      const n = Number(l.lot_quantity);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [lots]);

  const planned = Number(plannedQuantity) || 0;

  const allocationOk =
    lots.length > 0 &&
    planned > 0 &&
    allocated === planned &&
    lots.every((l) => Number(l.lot_quantity) > 0);

  const previewLotId = (idx) => {
    if (!productionOrderId) return "(set Production Order ID)";
    const seq = String(idx + 1).padStart(2, "0");
    return `${productionOrderId}-L${seq}`;
  };

  const createProductionOrder = async () => {
    if (!productionOrderId || !orderLineId || !plannedQuantity) {
      alert(
        "Please fill Production Order ID, Order Line and Planned Quantity"
      );
      return;
    }
    if (lots.length === 0) {
      alert("Please add at least one lot");
      return;
    }
    if (lots.some((l) => !l.lot_quantity || Number(l.lot_quantity) <= 0)) {
      alert("Each lot must have a quantity greater than 0");
      return;
    }
    if (allocated !== planned) {
      alert(
        `Sum of lot quantities (${allocated}) must equal Planned Quantity (${planned})`
      );
      return;
    }

    try {
      await api.post("/production-order-with-lots", {
        production_order_id: productionOrderId,
        order_line_id: orderLineId,
        planned_quantity: planned,
        status,
        lots: lots.map((l) => ({
          lot_quantity: Number(l.lot_quantity)
        }))
      });

      alert("Production order and lots created successfully");
      clearForm();
      loadProductionOrders();
      loadOrderLines();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating production order"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Production Orders</h1>
      <p className="page-subtitle">
        Pick an open order line, split its quantity into lots, and release production
      </p>

      <FormCard title="Add Production Order">
        <div className="form-grid">
          <FormField label="Production Order ID">
            <input
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Order Line">
            <select
              value={orderLineId}
              onChange={(e) => handleOrderLineChange(e.target.value)}
            >
              <option value="">-- Select an Order Line --</option>
              {availableOrderLines.map((l) => {
                const qty = l.quantity ?? l.line_quantity ?? "";
                const labelParts = [
                  `${l.order_line_id}`,
                  `Order: ${l.order_id}`,
                  `Part: ${l.part_id}`,
                  `Qty: ${qty}`
                ];
                return (
                  <option
                    key={l.order_line_id}
                    value={l.order_line_id}
                  >
                    {labelParts.join(" · ")}
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Planned Quantity">
            <input
              type="number"
              value={plannedQuantity}
              onChange={(e) => setPlannedQuantity(e.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Planned">Planned</option>
              <option value="Released">Released</option>
              <option value="Completed">Completed</option>
            </select>
          </FormField>
        </div>

        {selectedLine && (
          <div className="form-hint">
            Linked to Order <strong>{selectedLine.order_id}</strong> ·
            Part <strong>{selectedLine.part_id}</strong> ·
            Order Line Qty <strong>{selectedLine.quantity ?? selectedLine.line_quantity}</strong>
          </div>
        )}

        {!selectedLine && availableOrderLines.length === 0 && orderLines.length > 0 && (
          <div className="form-hint">
            All existing order lines already have a production order. Create a new
            order line first.
          </div>
        )}

        <div className="lot-split-section">
          <div className="lot-split-header">
            <h3>Lots</h3>
            <div
              className={`lot-allocation ${allocationOk ? "ok" : "warn"}`}
            >
              Allocated {allocated} / Planned {planned || 0}
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>#</th>
                <th>Auto Lot ID</th>
                <th style={{ width: "180px" }}>Lot Quantity</th>
                <th style={{ width: "100px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td className="muted">{previewLotId(idx)}</td>
                  <td>
                    <input
                      type="number"
                      className="lot-qty-input"
                      value={lot.lot_quantity}
                      onChange={(e) => updateLotQty(idx, e.target.value)}
                      min="1"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => removeLot(idx)}
                      disabled={lots.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="button-group button-group-left">
            <button
              type="button"
              className="secondary-button"
              onClick={addLot}
            >
              + Add Lot
            </button>
          </div>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createProductionOrder}
            disabled={!allocationOk || !orderLineId}
          >
            Save Production Order &amp; Lots
          </button>

          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>
        </div>
      </FormCard>

      <div className="list-section">
        <FormCard title="Production Order List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Production Order ID</th>
                <th>Order Line ID</th>
                <th>Order ID</th>
                <th>Part ID</th>
                <th>Planned Quantity</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {productionOrders.map((po) => {
                const line = orderLines.find(
                  (l) => l.order_line_id === po.order_line_id
                );
                return (
                  <tr key={po.production_order_id}>
                    <td>{po.production_order_id}</td>
                    <td>{po.order_line_id}</td>
                    <td>{line?.order_id || "—"}</td>
                    <td>{line?.part_id || "—"}</td>
                    <td>{po.planned_quantity}</td>
                    <td>{po.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default ProductionOrderPage;
