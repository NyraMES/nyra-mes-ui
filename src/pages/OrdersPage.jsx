import Tabs from "../components/Tabs";

import OrderPage from "./OrderPage";
import OrderLinePage from "./OrderLinePage";

import "../styles/Form.css";


function OrdersPage() {
  const tabs = [
    {
      label: "Orders",
      content: <OrderPage />
    },
    {
      label: "Order Lines",
      content: <OrderLinePage />
    }
  ];

  return <Tabs tabs={tabs} />;
}

export default OrdersPage;
