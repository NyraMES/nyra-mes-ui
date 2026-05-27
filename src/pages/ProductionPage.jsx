import Tabs from "../components/Tabs";

import ProductionOrderPage from "./ProductionOrderPage";
import ProductionLotPage from "./ProductionLotPage";
import FeasibilityPage from "./FeasibilityPage";
import SchedulePage from "./SchedulePage";
import WorkOrderPage from "./WorkOrderPage";

import "../styles/Form.css";


function ProductionPage() {
  const tabs = [
    {
      label: "Production Orders",
      content: <ProductionOrderPage />
    },
    {
      label: "Production Lots",
      content: <ProductionLotPage />
    },
    {
      label: "Feasibility",
      content: <FeasibilityPage />
    },
    {
      label: "Schedules",
      content: <SchedulePage />
    },
    {
      label: "Work Orders",
      content: <WorkOrderPage />
    }
  ];

  return <Tabs tabs={tabs} />;
}

export default ProductionPage;
