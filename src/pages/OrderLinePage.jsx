import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function OrderLinePage() {

  const [orderLineId, setOrderLineId] = useState("");

  const [orderId, setOrderId] = useState("");

  const [partId, setPartId] = useState("");

  const [quantity, setQuantity] = useState("");

  const [status, setStatus] = useState("Planned");

  const [orderLines, setOrderLines] = useState([]);


  useEffect(() => {

    loadOrderLines();

  }, []);


  const loadOrderLines = async () => {

    try {

      const ordersResponse = await api.get("/orders");

      let allLines = [];

      for (const order of ordersResponse.data) {

        try {

          const lineResponse = await api.get(
            `/order/${order.order_id}/lines`
          );

          allLines = [
            ...allLines,
            ...lineResponse.data
          ];

        } catch (err) {

          console.error(err);
        }
      }

      setOrderLines(allLines);

    } catch (error) {

      console.error(error);
    }
  };


  const clearForm = () => {

    setOrderLineId("");

    setOrderId("");

    setPartId("");

    setQuantity("");

    setStatus("Planned");
  };


  const createOrderLine = async () => {

    try {

      await api.post(`/order/${orderId}/line`, {
        order_line_id: orderLineId,
        part_id: partId,
        quantity: Number(quantity),
        status: status
      });

      alert("Order line created successfully");

      clearForm();

      loadOrderLines();

    } catch (error) {

      console.error(error);

      alert(
        error.response?.data?.detail ||
        "Error creating order line"
      );
    }
  };


  return (
    <div>

      <h1 className="page-title">
        Order Lines
      </h1>

      <p className="page-subtitle">
        Create and manage customer order lines
      </p>


      <FormCard title="Add Order Line">

        <div className="form-grid">

          <FormField label="Order Line ID">

            <input
              value={orderLineId}
              onChange={(e) =>
                setOrderLineId(e.target.value)
              }
            />

          </FormField>


          <FormField label="Order ID">

            <input
              value={orderId}
              onChange={(e) =>
                setOrderId(e.target.value)
              }
            />

          </FormField>


          <FormField label="Part ID">

            <input
              value={partId}
              onChange={(e) =>
                setPartId(e.target.value)
              }
            />

          </FormField>


          <FormField label="Quantity">

            <input
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
            />

          </FormField>


          <FormField label="Status">

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
            >
              <option value="Planned">
                Planned
              </option>

              <option value="Released">
                Released
              </option>

              <option value="Completed">
                Completed
              </option>

            </select>

          </FormField>

        </div>


        <div className="button-group">

          <button
            className="primary-button"
            onClick={createOrderLine}
          >
            Save Order Line
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

        <FormCard title="Order Line List">

          <table className="data-table">

            <thead>

              <tr>
                <th>Order Line ID</th>
                <th>Order ID</th>
                <th>Part ID</th>
                <th>Quantity</th>
                <th>Status</th>
              </tr>

            </thead>

            <tbody>

              {orderLines.map((line) => (

                <tr key={line.order_line_id}>

                  <td>{line.order_line_id}</td>

                  <td>{line.order_id}</td>

                  <td>{line.part_id}</td>

                  <td>{line.quantity}</td>

                  <td>{line.status}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </FormCard>

      </div>

    </div>
  );
}

export default OrderLinePage;