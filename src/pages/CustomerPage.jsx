import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";

function CustomerPage() {

  const [customerId, setCustomerId] = useState("");

  const [customerName, setCustomerName] = useState("");

  const [customerType, setCustomerType] = useState("Automobile OEM");

  const [customers, setCustomers] = useState([]);


  useEffect(() => {

    loadCustomers();

  }, []);


  const loadCustomers = async () => {

    try {

      const response = await api.get("/customer");

      setCustomers(response.data);

    } catch (error) {

      console.error(error);
    }
  };


  const clearForm = () => {

    setCustomerId("");

    setCustomerName("");

    setCustomerType("Automobile OEM");
  };


  const createCustomer = async () => {

    try {

      await api.post("/customer", {
        customer_id: customerId,
        customer_name: customerName,
        customer_type: customerType
      });

      alert("Customer created successfully");

      clearForm();

      loadCustomers();

    } catch (error) {

      console.error(error);

      alert(
        error.response?.data?.detail ||
        "Error creating customer"
      );
    }
  };


  return (
    <div>

      <h1 className="page-title">
        Customer Master
      </h1>

      <p className="page-subtitle">
        Create and manage automobile OEM customers
      </p>


      <FormCard title="Add Customer">

        <div className="form-grid">

          <FormField label="Customer ID">

            <input
              value={customerId}
              onChange={(e) =>
                setCustomerId(e.target.value)
              }
            />

          </FormField>


          <FormField label="Customer Name">

            <input
              value={customerName}
              onChange={(e) =>
                setCustomerName(e.target.value)
              }
            />

          </FormField>


          <FormField label="Customer Type">

            <input
              value={customerType}
              onChange={(e) =>
                setCustomerType(e.target.value)
              }
            />

          </FormField>

        </div>


        <div className="button-group">

          <button
            className="primary-button"
            onClick={createCustomer}
          >
            Save Customer
          </button>


          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>

        </div>

      </FormCard>


      <FormCard title="Customer List">

        <table className="data-table">

          <thead>

            <tr>
              <th>Customer ID</th>
              <th>Customer Name</th>
              <th>Customer Type</th>
            </tr>

          </thead>

          <tbody>

            {customers.map((customer) => (

              <tr key={customer.customer_id}>

                <td>{customer.customer_id}</td>

                <td>{customer.customer_name}</td>

                <td>{customer.customer_type}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </FormCard>

    </div>
  );
}

export default CustomerPage;