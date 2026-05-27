import { useEffect, useMemo, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function OrderPage() {
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("Created");

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    loadOrders();
    loadCustomers();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await api.get("/orders");
      setOrders(response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await api.get("/customer");
      setCustomers(response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setOrderId("");
    setCustomerId("");
    setStatus("Created");
  };

  const existingOrderIds = useMemo(() => {
    return new Set(orders.map((o) => o.order_id));
  }, [orders]);

  const trimmedOrderId = orderId.trim();
  const isDuplicateId =
    trimmedOrderId.length > 0 && existingOrderIds.has(trimmedOrderId);

  const canSave =
    trimmedOrderId.length > 0 &&
    customerId.length > 0 &&
    !isDuplicateId;

  const createOrder = async () => {
    if (!trimmedOrderId) {
      alert("Please enter an Order ID");
      return;
    }
    if (!customerId) {
      alert("Please select a Customer");
      return;
    }
    if (isDuplicateId) {
      alert(`Order ID "${trimmedOrderId}" already exists. Please choose a different ID.`);
      return;
    }

    try {
      await api.post("/order", {
        order_id: trimmedOrderId,
        customer_id: customerId,
        status: status
      });

      alert("Order created successfully");
      clearForm();
      loadOrders();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.detail || "Error creating order");
    }
  };

  return (
    <div>
      <h1 className="page-title">Customer Orders</h1>
      <p className="page-subtitle">Create and manage OEM customer orders</p>

      <FormCard title="Add Customer Order">
        <div className="form-grid">
          <FormField label="Order ID">
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-001"
            />
          </FormField>

          <FormField label="Customer">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">-- Select a Customer --</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_id} · {c.customer_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Created">Created</option>
              <option value="Planned">Planned</option>
              <option value="Released">Released</option>
              <option value="Completed">Completed</option>
            </select>
          </FormField>
        </div>

        {isDuplicateId && (
          <div className="form-hint form-hint-warn">
            Order ID <strong>{trimmedOrderId}</strong> already exists. Pick a different ID.
          </div>
        )}

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createOrder}
            disabled={!canSave}
          >
            Save Order
          </button>

          <button className="secondary-button" onClick={clearForm}>
            Clear
          </button>
        </div>
      </FormCard>

      <div className="list-section">
        <FormCard title="Order List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer ID</th>
                <th>Status</th>
                <th>Order Date</th>
                <th>Delivery Date</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td>{order.order_id}</td>
                  <td>{order.customer_id}</td>
                  <td>{order.status}</td>
                  <td>{order.order_date}</td>
                  <td>{order.delivery_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default OrderPage;
