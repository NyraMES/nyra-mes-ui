import Tabs from "../components/Tabs";

import MaintenanceEventPage from "./MaintenanceEventPage";
import MachineDowntimePage from "./MachineDowntimePage";
import OeeDailySummaryPage from "./OeeDailySummaryPage";

import "../styles/Form.css";


function MaintenancePage() {
  const tabs = [
    {
      label: "Maintenance Events",
      content: <MaintenanceEventPage />
    },
    {
      label: "Machine Downtimes",
      content: <MachineDowntimePage />
    },
    {
      label: "OEE Daily Summary",
      content: <OeeDailySummaryPage />
    }
  ];

  return <Tabs tabs={tabs} />;
}

export default MaintenancePage;
